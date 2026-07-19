// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ICircleFactory {
    function recordMembership(address member) external;
    function recordInvitation(address invited, address circleAddress) external;
    function recordCompletion(address member) external;
    function recordDefault(address member) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract Circle {
    enum Status {
        Open,
        Full,
        Active,
        Completed,
        Cancelled,
        Deleted
    }

    struct Member {
        address wallet;
        bool exists;
        bool hasContributedThisRound;
        bool hasReceivedPayout;
        uint32 completedCircles;
        uint256 collateralPosted;
        uint256 totalPayoutsReceived;
        bool defaulted;
    }

    address public immutable creator;
    address public immutable factory;

    string public name;
    string public description;
    uint256 public immutable contributionAmount;
    uint256 public immutable frequencySeconds;
    uint8 public immutable maxParticipants;
    uint256 public immutable collateralRequired;
    address public immutable token;

    Status public status;
    address[] public memberList;
    mapping(address => Member) public members;
    mapping(address => bool) public invitedAddresses;
    mapping(address => bool) public deleteVotes;
    mapping(address => uint256) public pendingPayouts;

    address[] public payoutOrder;
    bool public payoutOrderDrawn;

    mapping(address => bytes32) public seedCommitments;
    mapping(address => bool) public seedRevealed;
    uint256 public commitCount;
    uint256 public revealCount;
    bytes32 private revealAccumulator;

    uint256 public constant REVEAL_WINDOW = 1 days;
    uint256 public revealDeadline;

    uint16 public currentRound;
    uint256 public roundDeadline;
    uint256 public roundContributionsCount;
    uint256 public poolBalance;

    event MemberJoined(address indexed member, uint256 memberCount);
    event MemberInvited(address indexed invited);
    event GroupFilled(uint256 timestamp);
    event SeedCommitted(address indexed member);
    event SeedRevealed(address indexed member);
    event PayoutOrderDrawn(address[] order, uint256 seed);
    event ContributionMade(address indexed member, uint16 round, uint256 amount);
    event FundsDeposited(address indexed creator, uint256 amount);
    event PayoutQueued(address indexed recipient, uint16 round, uint256 amount);
    event PayoutWithdrawn(address indexed recipient, uint256 amount);
    event RoundAdvanced(uint16 newRound);
    event CircleCompleted(uint256 timestamp);
    event CircleCancelled(uint256 timestamp);
    event MemberDefaulted(address indexed member, uint256 collateralSlashed);
    event CollateralPosted(address indexed member, uint256 amount);
    event DeleteVoteCast(address indexed voter);
    event CircleDeleted(uint256 timestamp);

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
        token = _token;
        status = Status.Open;

        _addMember(_creator);
    }

    function addInvitedAddress(address invited) external onlyCreator {
        require(status == Status.Open, "Circle: not open");
        require(!members[invited].exists, "Circle: already a member");
        require(!invitedAddresses[invited], "Circle: already invited");
        invitedAddresses[invited] = true;
        try ICircleFactory(factory).recordInvitation(invited, address(this)) {} catch {}
        emit MemberInvited(invited);
    }

    function join() external payable {
        require(status == Status.Open, "Circle: not open");
        require(!members[msg.sender].exists, "Circle: already a member");
        require(memberList.length < maxParticipants, "Circle: full");
        require(invitedAddresses[msg.sender], "Circle: not invited");

        if (token == address(0)) {
            require(msg.value == collateralRequired, "Circle: wrong collateral");
        } else {
            require(msg.value == 0, "Circle: no native value for token circles");
        }

        _addMember(msg.sender);
        if (collateralRequired > 0) {
            members[msg.sender].collateralPosted = collateralRequired;
            emit CollateralPosted(msg.sender, collateralRequired);
        }

        if (token != address(0) && collateralRequired > 0) {
            require(IERC20(token).transferFrom(msg.sender, address(this), collateralRequired), "Circle: collateral transfer failed");
        }

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
            totalPayoutsReceived: 0,
            defaulted: false
        });
        memberList.push(wallet);
        emit MemberJoined(wallet, memberList.length);
    }

    function commitSeed(bytes32 commitment) external onlyMember {
        require(status == Status.Open, "Circle: cannot commit now");
        require(commitment != bytes32(0), "Circle: empty commitment");
        require(seedCommitments[msg.sender] == bytes32(0), "Circle: already committed");

        seedCommitments[msg.sender] = commitment;
        commitCount += 1;
        emit SeedCommitted(msg.sender);
    }

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

    function finalizeDraw() external {
        require(status == Status.Full, "Circle: not awaiting reveal");
        require(!payoutOrderDrawn, "Circle: order already drawn");
        require(block.timestamp > revealDeadline, "Circle: reveal window still open");
        _drawPayoutOrder();
    }

    function cancel() external onlyCreator {
        require(status == Status.Open, "Circle: cannot cancel now");
        status = Status.Cancelled;
        emit CircleCancelled(block.timestamp);
    }

    function fundCircle(uint256 amount) external payable onlyCreator {
        require(amount > 0, "Circle: zero deposit");
        require(status != Status.Deleted, "Circle: deleted");

        if (token == address(0)) {
            require(msg.value == amount, "Circle: wrong native deposit");
        } else {
            require(msg.value == 0, "Circle: no native value for token circles");
            require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Circle: deposit transfer failed");
        }

        poolBalance += amount;
        emit FundsDeposited(msg.sender, amount);
    }

    function contribute() external payable onlyMember {
        require(status == Status.Active, "Circle: not active");
        Member storage m = members[msg.sender];
        require(!m.hasContributedThisRound, "Circle: already contributed this round");

        if (token == address(0)) {
            require(msg.value == contributionAmount, "Circle: wrong amount");
        } else {
            require(msg.value == 0, "Circle: no native value for token circles");
        }

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

    function withdrawPayout() external {
        uint256 amount = pendingPayouts[msg.sender];
        require(amount > 0, "Circle: no pending payout");

        pendingPayouts[msg.sender] = 0;
        members[msg.sender].totalPayoutsReceived += amount;
        emit PayoutWithdrawn(msg.sender, amount);

        if (token == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            require(ok, "Circle: payout transfer failed");
        } else {
            require(IERC20(token).transfer(msg.sender, amount), "Circle: payout transfer failed");
        }
    }

    function voteToDelete() external onlyMember {
        require(status != Status.Completed && status != Status.Cancelled && status != Status.Deleted, "Circle: cannot delete now");
        require(!deleteVotes[msg.sender], "Circle: already voted");

        deleteVotes[msg.sender] = true;
        emit DeleteVoteCast(msg.sender);

        if (_allMembersVoted()) {
            _settleDeletion();
        }
    }

    function deleteCircle() external onlyCreator {
        require(status == Status.Open, "Circle: cannot delete now");
        require(memberList.length == 1, "Circle: use voteToDelete for multi-member circles");

        uint256 reclaim = members[creator].collateralPosted + poolBalance;
        members[creator].collateralPosted = 0;
        poolBalance = 0;
        status = Status.Deleted;
        emit CircleDeleted(block.timestamp);

        if (token == address(0)) {
            (bool ok, ) = payable(creator).call{value: reclaim}("");
            require(ok, "Circle: deletion transfer failed");
        } else {
            require(IERC20(token).transfer(creator, reclaim), "Circle: deletion transfer failed");
        }
    }

    function _fillGroup() internal {
        status = Status.Full;
        revealDeadline = block.timestamp + REVEAL_WINDOW;
        emit GroupFilled(block.timestamp);

        if (commitCount == 0) {
            _drawPayoutOrder();
        }
    }

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

    function _payoutCurrentRound() internal {
        address recipient = payoutOrder[currentRound - 1];
        uint256 amount = poolBalance;
        poolBalance = 0;

        members[recipient].hasReceivedPayout = true;
        pendingPayouts[recipient] += amount;

        for (uint256 i = 0; i < memberList.length; i++) {
            members[memberList[i]].hasContributedThisRound = false;
        }
        roundContributionsCount = 0;

        emit PayoutQueued(recipient, currentRound, amount);

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

    function _allMembersVoted() internal view returns (bool) {
        for (uint256 i = 0; i < memberList.length; i++) {
            if (!deleteVotes[memberList[i]]) return false;
        }
        return true;
    }

    function _settleDeletion() internal {
        uint256 pool = poolBalance;
        uint256 len = memberList.length;
        uint256 share = pool / len;
        uint256 remainder = pool % len;

        for (uint256 i = 0; i < len; i++) {
            address member = memberList[i];
            uint256 memberShare = share + (i < remainder ? 1 : 0);
            uint256 reclaim = members[member].collateralPosted + memberShare + pendingPayouts[member] - members[member].totalPayoutsReceived;
            if (reclaim > 0) {
                if (token == address(0)) {
                    (bool ok, ) = payable(member).call{value: reclaim}("");
                    require(ok, "Circle: settlement transfer failed");
                } else {
                    require(IERC20(token).transfer(member, reclaim), "Circle: settlement transfer failed");
                }
            }
            members[member].collateralPosted = 0;
            pendingPayouts[member] = 0;
        }

        poolBalance = 0;
        status = Status.Deleted;
        emit CircleDeleted(block.timestamp);
    }

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
