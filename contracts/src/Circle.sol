// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ICircleFactory {
    function recordMembership(address member) external;
    function recordCompletion(address member) external;
    function recordDefault(address member) external;
}

/// @dev Minimal ERC20 surface — enough to move a stablecoin like USDC in/out
///      of a circle. We intentionally avoid pulling in a full OZ dependency.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Circle
/// @notice A single private savings circle (Ajo / Esusu / ROSCA) between trusted
///         family members and friends. Deployed once per group by CircleFactory.
/// @dev    Payout order is drawn with a commit-reveal scheme: each member locks in
///         keccak256(secret) while the group is still filling, then reveals the
///         secret once it's full. The draw seed is the XOR of every revealed
///         secret, folded together with block data as a defense-in-depth
///         backstop. No single member, and no block producer, controls the seed
///         alone — a member can't change their secret after committing, and the
///         final value isn't fixed until the last reveal (or the reveal window
///         lapses). See contracts/README.md for the full rationale and the
///         no-quorum-revealed fallback.
contract Circle {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        Open, // accepting members, invites unlocked
        Full, // full, waiting for payout order to be drawn
        Active, // running contribution rounds
        Completed, // every member has been paid out exactly once
        Cancelled // creator cancelled before it filled up
    }

    struct Member {
        address wallet;
        bool exists;
        bool hasContributedThisRound;
        bool hasReceivedPayout;
        uint32 completedCircles; // reputation: circles finished elsewhere, set by factory
        uint256 collateralPosted;
        bool defaulted;
    }

    // ---------------------------------------------------------------------
    // Immutable / configuration state
    // ---------------------------------------------------------------------

    address public immutable creator;
    address public immutable factory;

    string public name;
    string public description;
    uint256 public immutable contributionAmount; // in token base units, per member per round
    uint256 public immutable frequencySeconds; // 1 days / 7 days / 30 days
    uint8 public immutable maxParticipants;
    uint256 public immutable collateralRequired; // in token base units, 0 = no collateral

    /// @notice The asset this circle is denominated in. address(0) means the
    ///         chain's native currency (MON on Monad); any other value is an
    ///         ERC20 token address (e.g. USDC) and every contribution/collateral/
    ///         payout moves via transferFrom/transfer instead of msg.value.
    address public immutable token;

    /// @dev keccak256 hash of the invite code. The plaintext code is never stored
    ///      on-chain — only enough to verify a code presented by a joiner.
    bytes32 public inviteCodeHash;
    bool public invitesLocked;

    // ---------------------------------------------------------------------
    // Mutable state
    // ---------------------------------------------------------------------

    Status public status;
    address[] public memberList;
    mapping(address => Member) public members;

    /// @notice Final, immutable payout order — set exactly once when the group fills.
    address[] public payoutOrder;
    bool public payoutOrderDrawn;

    /// @dev Commit-reveal inputs for the payout draw. A member commits
    ///      keccak256(secret, memberAddress) any time before the group fills, then
    ///      reveals the secret once it's Full. Only committed members can reveal,
    ///      and a commitment can never be changed once set.
    mapping(address => bytes32) public seedCommitments;
    mapping(address => bool) public seedRevealed;
    uint256 public commitCount;
    uint256 public revealCount;
    bytes32 private revealAccumulator;

    /// @notice How long members have to reveal after the group fills before
    ///         anyone can force the draw with whatever was revealed so far.
    uint256 public constant REVEAL_WINDOW = 1 days;
    uint256 public revealDeadline;

    uint16 public currentRound; // 1-indexed once Active
    uint256 public roundDeadline; // unix timestamp of when the current round's window closes
    uint256 public roundContributionsCount;
    uint256 public poolBalance;

    event MemberJoined(address indexed member, uint256 memberCount);
    event InviteCodeRotated(bytes32 newHash);
    event InvitesLocked();
    event GroupFilled(uint256 timestamp);
    event SeedCommitted(address indexed member);
    event SeedRevealed(address indexed member);
    event PayoutOrderDrawn(address[] order, uint256 seed);
    event ContributionMade(address indexed member, uint16 round, uint256 amount);
    event PayoutSent(address indexed recipient, uint16 round, uint256 amount);
    event RoundAdvanced(uint16 newRound);
    event CircleCompleted(uint256 timestamp);
    event CircleCancelled(uint256 timestamp);
    event MemberDefaulted(address indexed member, uint256 collateralSlashed);
    event CollateralPosted(address indexed member, uint256 amount);

    modifier onlyCreator() {
        require(msg.sender == creator, "Circle: not creator");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].exists, "Circle: not a member");
        _;
    }

    constructor(
        address _creator,
        string memory _name,
        string memory _description,
        uint256 _contributionAmount,
        uint256 _frequencySeconds,
        uint8 _maxParticipants,
        uint256 _collateralRequired,
        bytes32 _inviteCodeHash,
        address _token
    ) {
        require(_maxParticipants >= 2 && _maxParticipants <= 50, "Circle: bad size");
        require(_contributionAmount > 0, "Circle: bad amount");
        require(
            _frequencySeconds == 1 days || _frequencySeconds == 7 days || _frequencySeconds == 30 days,
            "Circle: bad frequency"
        );

        factory = msg.sender;
        creator = _creator;
        name = _name;
        description = _description;
        contributionAmount = _contributionAmount;
        frequencySeconds = _frequencySeconds;
        maxParticipants = _maxParticipants;
        collateralRequired = _collateralRequired;
        inviteCodeHash = _inviteCodeHash;
        token = _token;
        status = Status.Open;

        _addMember(_creator);
    }

    // ---------------------------------------------------------------------
    // Invitations
    // ---------------------------------------------------------------------

    function join(string calldata inviteCode) external payable {
        require(status == Status.Open, "Circle: not open");
        require(!invitesLocked, "Circle: invites locked");
        require(!members[msg.sender].exists, "Circle: already a member");
        require(memberList.length < maxParticipants, "Circle: full");
        require(keccak256(abi.encodePacked(inviteCode)) == inviteCodeHash, "Circle: bad invite code");

        if (token == address(0)) {
            require(msg.value == collateralRequired, "Circle: wrong collateral");
        } else {
            require(msg.value == 0, "Circle: no native value for token circles");
        }

        // Effects before interactions: record membership first so a malicious
        // or nonstandard ERC20 can't reenter join() mid-transferFrom and pass
        // the "already a member" / "full" checks a second time.
        _addMember(msg.sender);
        if (collateralRequired > 0) {
            members[msg.sender].collateralPosted = collateralRequired;
            emit CollateralPosted(msg.sender, collateralRequired);
        }

        if (token != address(0) && collateralRequired > 0) {
            require(IERC20(token).transferFrom(msg.sender, address(this), collateralRequired), "Circle: collateral transfer failed");
        }

        // best-effort: reputation indexing must never block a join
        try ICircleFactory(factory).recordMembership(msg.sender) {} catch {}

        if (memberList.length == maxParticipants) {
            _fillGroup();
        }
    }

    function _addMember(address wallet) internal {
        members[wallet] = Member({
            wallet: wallet,
            exists: true,
            hasContributedThisRound: false,
            hasReceivedPayout: false,
            completedCircles: 0,
            collateralPosted: 0,
            defaulted: false
        });
        memberList.push(wallet);
        emit MemberJoined(wallet, memberList.length);
    }

    function rotateInviteCode(bytes32 newHash) external onlyCreator {
        require(status == Status.Open, "Circle: cannot rotate now");
        require(!invitesLocked, "Circle: invites locked");
        inviteCodeHash = newHash;
        emit InviteCodeRotated(newHash);
    }

    /// @notice Locks in this member's contribution to the payout-order randomness.
    ///         `commitment` must be `keccak256(abi.encodePacked(secret, msg.sender))`
    ///         for a secret only the member knows. Must be called before the group
    ///         fills; cannot be changed once set. Purely optional — a group that
    ///         collects zero commitments still draws (falling back to block data
    ///         alone), but every commitment strictly narrows who could bias the
    ///         result, since it has to be fixed before anyone knows the final
    ///         member list or fill order.
    function commitSeed(bytes32 commitment) external onlyMember {
        require(status == Status.Open, "Circle: cannot commit now");
        require(commitment != bytes32(0), "Circle: empty commitment");
        require(seedCommitments[msg.sender] == bytes32(0), "Circle: already committed");

        seedCommitments[msg.sender] = commitment;
        commitCount += 1;
        emit SeedCommitted(msg.sender);
    }

    /// @notice Reveals the secret behind an earlier commitment. Only callable once
    ///         the group is Full and only by members who committed. Once every
    ///         committed member has revealed, the payout order is drawn
    ///         automatically in the same transaction as the final reveal.
    function revealSeed(bytes32 secret) external onlyMember {
        require(status == Status.Full, "Circle: not awaiting reveal");
        require(!payoutOrderDrawn, "Circle: order already drawn");
        require(!seedRevealed[msg.sender], "Circle: already revealed");
        bytes32 commitment = seedCommitments[msg.sender];
        require(commitment != bytes32(0), "Circle: nothing committed");
        require(keccak256(abi.encodePacked(secret, msg.sender)) == commitment, "Circle: bad reveal");

        seedRevealed[msg.sender] = true;
        revealCount += 1;
        revealAccumulator ^= secret;
        emit SeedRevealed(msg.sender);

        if (revealCount == commitCount) {
            _drawPayoutOrder();
        }
    }

    /// @notice Forces the draw once the reveal window has lapsed, using whatever
    ///         secrets were actually revealed. Prevents a member who committed but
    ///         then refuses to reveal from stalling the circle forever.
    function finalizeDraw() external {
        require(status == Status.Full, "Circle: not awaiting reveal");
        require(!payoutOrderDrawn, "Circle: order already drawn");
        require(block.timestamp > revealDeadline, "Circle: reveal window still open");
        _drawPayoutOrder();
    }

    function closeInvites() external onlyCreator {
        require(status == Status.Open, "Circle: not open");
        invitesLocked = true;
        emit InvitesLocked();
    }

    function cancel() external onlyCreator {
        require(status == Status.Open, "Circle: cannot cancel now");
        status = Status.Cancelled;
        emit CircleCancelled(block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Fill -> draw payout order -> go active
    // ---------------------------------------------------------------------

    function _fillGroup() internal {
        status = Status.Full;
        invitesLocked = true;
        revealDeadline = block.timestamp + REVEAL_WINDOW;
        emit GroupFilled(block.timestamp);

        // No one committed a seed during Open — nothing to reveal, so draw right
        // away from block data alone (same fallback behavior as before).
        if (commitCount == 0) {
            _drawPayoutOrder();
        }
    }

    /// @dev Fisher-Yates shuffle seeded from the XOR of every revealed member
    ///      secret, folded with block data as a defense-in-depth backstop. Runs
    ///      exactly once (guarded by payoutOrderDrawn) and is then permanent.
    ///      Even in the worst case — zero commitments, or a forced finalizeDraw()
    ///      with nothing revealed — this degrades to the same block-data-only
    ///      randomness the circle always had, never worse.
    function _drawPayoutOrder() internal {
        require(!payoutOrderDrawn, "Circle: order already drawn");

        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    revealAccumulator,
                    block.prevrandao,
                    block.timestamp,
                    block.number,
                    address(this),
                    memberList.length,
                    revealCount
                )
            )
        );

        address[] memory shuffled = memberList;
        for (uint256 i = shuffled.length - 1; i > 0; i--) {
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            uint256 j = seed % (i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }

        payoutOrder = shuffled;
        payoutOrderDrawn = true;
        status = Status.Active;
        currentRound = 1;
        roundDeadline = block.timestamp + frequencySeconds;

        emit PayoutOrderDrawn(shuffled, seed);
    }

    // ---------------------------------------------------------------------
    // Contribution rounds + automatic payout
    // ---------------------------------------------------------------------

    function contribute() external payable onlyMember {
        require(status == Status.Active, "Circle: not active");
        Member storage m = members[msg.sender];
        require(!m.hasContributedThisRound, "Circle: already contributed this round");

        if (token == address(0)) {
            require(msg.value == contributionAmount, "Circle: wrong amount");
        } else {
            require(msg.value == 0, "Circle: no native value for token circles");
        }

        // Effects before interactions: mark the round paid before the token
        // moves, so a malicious/nonstandard ERC20 can't reenter contribute()
        // mid-transferFrom and get counted twice for the same round.
        m.hasContributedThisRound = true;
        roundContributionsCount += 1;
        poolBalance += contributionAmount;

        emit ContributionMade(msg.sender, currentRound, contributionAmount);

        if (token != address(0)) {
            require(IERC20(token).transferFrom(msg.sender, address(this), contributionAmount), "Circle: contribution transfer failed");
        }

        if (roundContributionsCount == memberList.length) {
            _payoutCurrentRound();
        }
    }

    function _payoutCurrentRound() internal {
        address recipient = payoutOrder[currentRound - 1];
        uint256 amount = poolBalance;
        poolBalance = 0;

        members[recipient].hasReceivedPayout = true;

        for (uint256 i = 0; i < memberList.length; i++) {
            members[memberList[i]].hasContributedThisRound = false;
        }
        roundContributionsCount = 0;

        emit PayoutSent(recipient, currentRound, amount);

        if (token == address(0)) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "Circle: payout transfer failed");
        } else {
            require(IERC20(token).transfer(recipient, amount), "Circle: payout transfer failed");
        }

        if (currentRound == maxParticipants) {
            status = Status.Completed;
            for (uint256 i = 0; i < memberList.length; i++) {
                if (!members[memberList[i]].defaulted) {
                    try ICircleFactory(factory).recordCompletion(memberList[i]) {} catch {}
                }
            }
            emit CircleCompleted(block.timestamp);
        } else {
            currentRound += 1;
            roundDeadline = block.timestamp + frequencySeconds;
            emit RoundAdvanced(currentRound);
        }
    }

    // ---------------------------------------------------------------------
    // Defaults / collateral slashing
    // ---------------------------------------------------------------------

    /// @notice Anyone can call after a round's deadline passes if a member who has
    ///         already received their payout still hasn't contributed. Their
    ///         collateral is slashed and redistributed to members still owed a
    ///         payout, pro-rata. This keeps the circle solvent for everyone left.
    function markDefault(address member) external {
        require(status == Status.Active, "Circle: not active");
        require(block.timestamp > roundDeadline, "Circle: round still open");
        Member storage m = members[member];
        require(m.exists, "Circle: not a member");
        require(m.hasReceivedPayout, "Circle: only post-payout defaults are slashed");
        require(!m.hasContributedThisRound, "Circle: member did contribute");
        require(!m.defaulted, "Circle: already marked");
        require(m.collateralPosted > 0, "Circle: no collateral to slash");

        m.defaulted = true;
        uint256 slashed = m.collateralPosted;
        m.collateralPosted = 0;

        uint256 stillOwed = 0;
        for (uint256 i = 0; i < memberList.length; i++) {
            if (!members[memberList[i]].hasReceivedPayout) stillOwed++;
        }

        emit MemberDefaulted(member, slashed);
        try ICircleFactory(factory).recordDefault(member) {} catch {}

        if (stillOwed > 0 && slashed > 0) {
            uint256 share = slashed / stillOwed;
            for (uint256 i = 0; i < memberList.length; i++) {
                address addr = memberList[i];
                if (!members[addr].hasReceivedPayout && share > 0) {
                    if (token == address(0)) {
                        (bool ok, ) = payable(addr).call{value: share}("");
                        require(ok, "Circle: slash distribution failed");
                    } else {
                        require(IERC20(token).transfer(addr, share), "Circle: slash distribution failed");
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function memberCount() external view returns (uint256) {
        return memberList.length;
    }

    function getMembers() external view returns (address[] memory) {
        return memberList;
    }

    function getPayoutOrder() external view returns (address[] memory) {
        return payoutOrder;
    }

    function getMember(address wallet) external view returns (Member memory) {
        return members[wallet];
    }
}
