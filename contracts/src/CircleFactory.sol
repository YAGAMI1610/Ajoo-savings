// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Circle} from "./Circle.sol";

/// @title CircleFactory
/// @notice Creates private savings circles and gives every wallet a persistent
///         reputation record (circles completed, defaults) across all circles it
///         has been part of. Groups are NEVER enumerable/browsable here on purpose
///         — Ajoo is invite-only. The factory only stores what is needed to
///         validate an invite code cheaply; codes are never stored in plaintext.
contract CircleFactory {
    struct Reputation {
        uint32 circlesCompleted;
        uint32 circlesDefaulted;
    }

    address[] public allCircles;
    mapping(address => bool) public isCircle;
    mapping(address => address[]) public circlesByMember;
    mapping(address => Reputation) public reputationOf;

    event CircleCreated(
        address indexed circle,
        address indexed creator,
        string name,
        uint256 contributionAmount,
        uint256 frequencySeconds,
        uint8 maxParticipants,
        uint256 collateralRequired,
        address token
    );

    /// @param inviteCodeHash keccak256(abi.encodePacked(plaintextInviteCode)),
    ///        computed client-side so the plaintext code never touches chain.
    /// @param token address(0) for the chain's native currency (MON), or an
    ///        ERC20 token address (e.g. USDC) to denominate this circle in
    ///        that token instead.
    function createCircle(
        string calldata circleName,
        string calldata description,
        uint256 contributionAmount,
        uint256 frequencySeconds,
        uint8 maxParticipants,
        uint256 collateralRequired,
        bytes32 inviteCodeHash,
        address token
    ) external returns (address circleAddress) {
        Circle circle = new Circle(
            msg.sender,
            circleName,
            description,
            contributionAmount,
            frequencySeconds,
            maxParticipants,
            collateralRequired,
            inviteCodeHash,
            token
        );

        circleAddress = address(circle);
        allCircles.push(circleAddress);
        isCircle[circleAddress] = true;
        circlesByMember[msg.sender].push(circleAddress);

        emit CircleCreated(
            circleAddress,
            msg.sender,
            circleName,
            contributionAmount,
            frequencySeconds,
            maxParticipants,
            collateralRequired,
            token
        );
    }

    /// @notice Called by a Circle-aware indexer/frontend after a wallet joins a
    ///         circle, so the factory can resolve "my circles" without a public
    ///         registry of all circles being browsable by everyone.
    function recordMembership(address member) external {
        require(isCircle[msg.sender], "Factory: caller is not a known circle");
        circlesByMember[member].push(msg.sender);
    }

    function recordCompletion(address member) external {
        require(isCircle[msg.sender], "Factory: caller is not a known circle");
        reputationOf[member].circlesCompleted += 1;
    }

    function recordDefault(address member) external {
        require(isCircle[msg.sender], "Factory: caller is not a known circle");
        reputationOf[member].circlesDefaulted += 1;
    }

    function getCirclesForMember(address member) external view returns (address[] memory) {
        return circlesByMember[member];
    }

    function totalCirclesCreated() external view returns (uint256) {
        return allCircles.length;
    }

    /// @notice "Trusted Saver" badge threshold: 3+ completed circles, 0 defaults.
    function isTrustedSaver(address member) external view returns (bool) {
        Reputation memory r = reputationOf[member];
        return r.circlesCompleted >= 3 && r.circlesDefaulted == 0;
    }
}
