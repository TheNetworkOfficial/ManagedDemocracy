// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "../libraries/LibDiamond.sol";

contract ModuleToggleFacet {
    event ModuleToggled(bytes32 indexed module, bool enabled);

    // Storage for module states
    struct ModuleToggleStorage {
        mapping(bytes32 => bool) moduleEnabled;
    }

    function moduleToggleStorage() internal pure returns (ModuleToggleStorage storage mts) {
        bytes32 position = keccak256("manageddemocracy.moduletoggle.storage");
        assembly {
            mts.slot := position
        }
    }

    // Toggle module on/off (temporarily controlled by contract owner or multi-sig)
    function setModuleState(bytes32 module, bool enabled) external {
        LibDiamond.enforceIsContractOwner();
        ModuleToggleStorage storage mts = moduleToggleStorage();
        mts.moduleEnabled[module] = enabled;
        emit ModuleToggled(module, enabled);
    }

    // Check if module is enabled
    function isModuleEnabled(bytes32 module) external view returns (bool) {
        return moduleToggleStorage().moduleEnabled[module];
    }

}
