// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CircleFactory} from "../src/CircleFactory.sol";

/// @notice Deploys CircleFactory to Monad testnet.
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url monad_testnet \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    function run() external returns (address factory) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        CircleFactory f = new CircleFactory();
        factory = address(f);

        vm.stopBroadcast();

        console.log("CircleFactory deployed at:", factory);
        console.log("Set VITE_CIRCLE_FACTORY_ADDRESS to this value in your frontend .env");
    }
}
