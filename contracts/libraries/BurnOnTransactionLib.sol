// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BurnOnTransactionLib {
    struct Storage {
        uint256 burnPercent;
    }

    // Use a unique storage slot for the burn module.
    bytes32 constant STORAGE_POSITION = keccak256("diamond.standard.burnontransaction.storage");

    function burnStorage() internal pure returns (Storage storage s) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }
}