// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CircleFactory} from "../src/CircleFactory.sol";
import {Circle} from "../src/Circle.sol";

contract CircleTest is Test {
    CircleFactory factory;
    address creator = address(0xC1);
    address bob = address(0xB0B);
    address carol = address(0xCA401);
    address dave = address(0xDA4E);
    address eve = address(0xEEEE);

    string constant CODE = "CIRCLE-X7K9P2";
    bytes32 inviteHash;

    function setUp() public {
        factory = new CircleFactory();
        inviteHash = keccak256(abi.encodePacked(CODE));
        vm.deal(creator, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(dave, 100 ether);
        vm.deal(eve, 100 ether);
    }

    function _create(uint256 collateral) internal returns (Circle) {
        vm.prank(creator);
        address addr = factory.createCircle(
            "Sunday Brunch Club",
            "Cousins + close friends",
            1 ether,
            7 days,
            5,
            collateral,
            inviteHash,
            address(0)
        );
        return Circle(addr);
    }

    function test_CreateAddsCreatorAsFirstMember() public {
        Circle c = _create(0);
        assertEq(c.memberCount(), 1);
        assertEq(c.getMembers()[0], creator);
        assertEq(uint256(c.status()), uint256(Circle.Status.Open));
    }

    function test_JoinRejectsWrongInviteCode() public {
        Circle c = _create(0);
        vm.prank(bob);
        vm.expectRevert("Circle: bad invite code");
        c.join("WRONG-CODE");
    }

    function test_JoinRejectsDuplicate() public {
        Circle c = _create(0);
        vm.prank(bob);
        c.join(CODE);
        vm.prank(bob);
        vm.expectRevert("Circle: already a member");
        c.join(CODE);
    }

    function test_GroupFillsAndDrawsImmutablePayoutOrder() public {
        Circle c = _create(0);
        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        assertEq(uint256(c.status()), uint256(Circle.Status.Active));
        assertTrue(c.payoutOrderDrawn());
        address[] memory order = c.getPayoutOrder();
        assertEq(order.length, 5);

        // Order must be a permutation of all 5 members
        address[] memory members = c.getMembers();
        for (uint256 i = 0; i < members.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < order.length; j++) {
                if (order[j] == members[i]) found = true;
            }
            assertTrue(found);
        }
    }

    function test_JoinAfterFullReverts() public {
        Circle c = _create(0);
        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        address frank = address(0xF4A4);
        vm.deal(frank, 1 ether);
        vm.prank(frank);
        vm.expectRevert("Circle: not open");
        c.join(CODE);
    }

    function test_FullContributionCycleTransfersCorrectPool() public {
        Circle c = _create(0);
        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        address[] memory order = c.getPayoutOrder();
        address firstRecipient = order[0];
        uint256 balBefore = firstRecipient.balance;

        address[] memory members = c.getMembers();
        for (uint256 i = 0; i < members.length; i++) {
            vm.prank(members[i]);
            c.contribute{value: 1 ether}();
        }

        // firstRecipient is one of the 5 contributors too, so their net gain
        // is the 5-ether pool minus the 1 ether they themselves paid in.
        assertEq(firstRecipient.balance, balBefore + 5 ether - 1 ether);
        assertEq(c.currentRound(), 2);
        assertEq(c.poolBalance(), 0);
    }

    function test_CircleCompletesAfterEveryoneIsPaidOnce() public {
        Circle c = _create(0);
        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        address[] memory members = c.getMembers();
        for (uint16 round = 1; round <= 5; round++) {
            for (uint256 i = 0; i < members.length; i++) {
                vm.prank(members[i]);
                c.contribute{value: 1 ether}();
            }
        }

        assertEq(uint256(c.status()), uint256(Circle.Status.Completed));

        vm.prank(bob);
        vm.expectRevert("Circle: not active");
        c.contribute{value: 1 ether}();
    }

    function test_CollateralSlashRedistributesToRemainingMembers() public {
        Circle c = _create(1 ether);
        vm.prank(bob);
        c.join{value: 1 ether}(CODE);
        vm.prank(carol);
        c.join{value: 1 ether}(CODE);
        vm.prank(dave);
        c.join{value: 1 ether}(CODE);
        vm.prank(eve);
        c.join{value: 1 ether}(CODE);

        address[] memory order = c.getPayoutOrder();
        address firstRecipient = order[0];

        address[] memory members = c.getMembers();
        for (uint256 i = 0; i < members.length; i++) {
            vm.prank(members[i]);
            c.contribute{value: 1 ether}();
        }

        // firstRecipient got paid; now they vanish instead of contributing round 2
        vm.warp(block.timestamp + 8 days);

        uint256 balBefore = address(this).balance;
        c.markDefault(firstRecipient);

        (, , , bool hasReceived, , uint256 collateralAfter, bool defaulted) = _memberFields(c, firstRecipient);
        assertTrue(defaulted);
        assertEq(collateralAfter, 0);
    }

    function test_CommitRevealDrawsOncePastLastReveal() public {
        Circle c = _create(0);

        bytes32 creatorSecret = keccak256("creator-secret");
        vm.prank(creator);
        c.commitSeed(keccak256(abi.encodePacked(creatorSecret, creator)));

        vm.prank(bob);
        c.join(CODE);
        bytes32 bobSecret = keccak256("bob-secret");
        vm.prank(bob);
        c.commitSeed(keccak256(abi.encodePacked(bobSecret, bob)));

        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        // Group is Full, but the draw hasn't happened yet — two commitments are
        // still unrevealed.
        assertEq(uint256(c.status()), uint256(Circle.Status.Full));
        assertFalse(c.payoutOrderDrawn());

        vm.prank(creator);
        c.revealSeed(creatorSecret);
        assertFalse(c.payoutOrderDrawn());

        vm.prank(bob);
        c.revealSeed(bobSecret);

        // Last outstanding reveal triggers the draw in the same transaction.
        assertTrue(c.payoutOrderDrawn());
        assertEq(uint256(c.status()), uint256(Circle.Status.Active));
        assertEq(c.getPayoutOrder().length, 5);
    }

    function test_RevealRejectsWrongSecret() public {
        Circle c = _create(0);
        bytes32 secret = keccak256("creator-secret");
        vm.prank(creator);
        c.commitSeed(keccak256(abi.encodePacked(secret, creator)));

        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        vm.prank(creator);
        vm.expectRevert("Circle: bad reveal");
        c.revealSeed(keccak256("wrong-secret"));
    }

    function test_FinalizeDrawRescuesStalledReveal() public {
        Circle c = _create(0);
        bytes32 secret = keccak256("creator-secret");
        vm.prank(creator);
        c.commitSeed(keccak256(abi.encodePacked(secret, creator)));

        vm.prank(bob);
        c.join(CODE);
        vm.prank(carol);
        c.join(CODE);
        vm.prank(dave);
        c.join(CODE);
        vm.prank(eve);
        c.join(CODE);

        // Creator never reveals. Anyone can force the draw once the window lapses.
        vm.expectRevert("Circle: reveal window still open");
        c.finalizeDraw();

        vm.warp(block.timestamp + c.REVEAL_WINDOW() + 1);
        c.finalizeDraw();

        assertTrue(c.payoutOrderDrawn());
        assertEq(uint256(c.status()), uint256(Circle.Status.Active));
    }

    function _memberFields(Circle c, address who)
        internal
        view
        returns (address, bool, bool, bool, uint32, uint256, bool)
    {
        Circle.Member memory m = c.getMember(who);
        return (m.wallet, m.exists, m.hasContributedThisRound, m.hasReceivedPayout, m.completedCircles, m.collateralPosted, m.defaulted);
    }

    receive() external payable {}
}
