// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Circle} from "./Circle.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title CircleFactory
/// @notice Creates private savings circles and keeps a member-to-circle index
///         for the Ajoo dashboard without exposing a public browse surface.
contract CircleFactory {
    struct Reputation {
        uint32 circlesCompleted;
        uint32 circlesDefaulted;
    }

    address[] public allCircles;
    mapping(address => bool) public isCircle;
    mapping(address => address[]) public circlesByMember;
    mapping(address => address[]) public invitedCirclesByMember;
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

    function createCircle(
        string calldata circleName,
        string calldata description,
        uint256 contributionAmount,
        uint256 frequencySeconds,
        uint8 maxParticipants,
        uint256 collateralRequired,
        address token,
        uint256 initialDepositAmount
    ) external payable returns (address circleAddress) {
        Circle circle = new Circle(
            msg.sender,
            circleName,
            description,
            contributionAmount,
            frequencySeconds,
            maxParticipants,
            collateralRequired,
            token
        );

        circleAddress = address(circle);
        allCircles.push(circleAddress);
        isCircle[circleAddress] = true;
        circlesByMember[msg.sender].push(circleAddress);

        if (token == address(0)) {
            require(msg.value >= initialDepositAmount, "Factory: insufficient native deposit");
            if (initialDepositAmount > 0) {
                (bool ok, ) = payable(circleAddress).call{value: initialDepositAmount}("");
                require(ok, "Factory: native deposit failed");
            }
        } else {
            require(msg.value == 0, "Factory: no native value for token circles");
            if (initialDepositAmount > 0) {
                require(IERC20(token).transferFrom(msg.sender, circleAddress, initialDepositAmount), "Factory: token deposit failed");
            }
        }

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

    function recordMembership(address member) external {
        require(isCircle[msg.sender], "Factory: caller is not a known circle");
        circlesByMember[member].push(msg.sender);
    }

    function recordInvitation(address invited, address circleAddress) external {
        require(isCircle[msg.sender], "Factory: caller is not a known circle");
        invitedCirclesByMember[invited].push(circleAddress);
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

    function getInvitedCirclesForMember(address member) external view returns (address[] memory) {
        return invitedCirclesByMember[member];
    }

    function totalCirclesCreated() external view returns (uint256) {
        return allCircles.length;
    }

    function isTrustedSaver(address member) external view returns (bool) {
        Reputation memory r = reputationOf[member];
        return r.circlesCompleted >= 3 && r.circlesDefaulted == 0;
    }
}
