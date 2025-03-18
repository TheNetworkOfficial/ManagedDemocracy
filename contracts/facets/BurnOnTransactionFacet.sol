// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BurnOnTransactionFacet {
    bytes32 constant MODULE_ID = keccak256("BurnOnTransaction");
    uint256 public burnPercent; // e.g., 100 = 1%, 250 = 2.5%

    event BurnOnTransactionExecuted(address indexed sender, address indexed recipient, uint256 amountSent, uint256 amountBurned);

    function initializeBurnModule(uint256 _burnPercent) external {
        LibDiamond.enforceIsContractOwner();
        require(burnPercent == 0, "Already initialized");
        burnPercent = _burnPercent;
    }

    function transferWithBurn(address _from, address _to, uint256 _amount) external {
        require(isModuleActive(), "BurnOnTransaction module inactive");

        uint256 burnAmount = (_amount * burnPercent) / 10000; // 10000 = 100.00%
        uint256 transferAmount = _amount - burnAmount;

        ERC20 token = ERC20(address(this));
        require(token.balanceOf(_from) >= _amount, "Insufficient balance");

        ERC20(address(this)).transferFrom(_from, address(0), burnAmount); // Burn tokens
        ERC20(address(this)).transferFrom(_from, _to, _amount - burnAmount); // Transfer remaining tokens
    }

    function isModuleActive() internal view returns (bool) {
        return ModuleToggleFacet(address(this)).isModuleEnabled(MODULE_ID);
    }
}

interface ModuleToggleFacet {
    function isModuleEnabled(bytes32 moduleId) external view returns (bool);
}
