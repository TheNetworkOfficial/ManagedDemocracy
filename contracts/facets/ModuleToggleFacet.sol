// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";

contract ModuleToggleFacet {
    event ModuleToggled(bytes32 indexed module, bool enabled);

    // Extend storage with configuration for each module.
    struct ModuleToggleStorage {
        mapping(bytes32 => bool) moduleEnabled;
        mapping(bytes32 => ModuleConfiguration) moduleConfigs;
    }

    // This struct holds the information needed to update overlapping functions.
    struct ModuleConfiguration {
        address activeFacet; // Facet to use when module is active
        address baseFacet;   // Facet to revert to when module is inactive
        bytes4[] selectors;  // Overlapping function selectors that must be replaced
    }

    function moduleToggleStorage() internal pure returns (ModuleToggleStorage storage mts) {
        bytes32 position = keccak256("manageddemocracy.moduletoggle.storage");
        assembly {
            mts.slot := position
        }
    }

    /// @notice Configure a module by providing its ID, the facet to use when active,
    /// the base facet to use when inactive, and the overlapping function selectors.
    /// This is generic and can be used for any module.
    function setModuleConfiguration(
        bytes32 module,
        address activeFacet,
        address baseFacet,
        bytes4[] calldata selectors
    ) external {
        LibDiamond.enforceIsContractOwner();
        ModuleToggleStorage storage mts = moduleToggleStorage();
        mts.moduleConfigs[module] = ModuleConfiguration({
            activeFacet: activeFacet,
            baseFacet: baseFacet,
            selectors: selectors
        });
    }

    /// @notice Toggle a module’s state and automatically perform a diamond cut
    /// to replace the overlapping functions with the appropriate facet.
    function setModuleState(bytes32 module, bool enabled) external {
        LibDiamond.enforceIsContractOwner();
        ModuleToggleStorage storage mts = moduleToggleStorage();
        mts.moduleEnabled[module] = enabled;
        emit ModuleToggled(module, enabled);

        // If a configuration exists for this module, update the diamond’s routing.
        ModuleConfiguration memory config = mts.moduleConfigs[module];
        if (config.selectors.length > 0) {
            // Explicitly declare and initialize the facetCut array
            IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);

            // Conditionally select active or base facet
            address selectedFacet = enabled ? config.activeFacet : config.baseFacet;

            cut[0] = IDiamondCut.FacetCut({
                facetAddress: selectedFacet,
                action: IDiamondCut.FacetCutAction.Replace,
                functionSelectors: config.selectors
            });

            // Execute the diamond cut
            LibDiamond.diamondCut(cut, address(0), "");
        }
    }

    /// @notice Returns true if the module is enabled.
    function isModuleEnabled(bytes32 module) external view returns (bool) {
        return moduleToggleStorage().moduleEnabled[module];
    }
}