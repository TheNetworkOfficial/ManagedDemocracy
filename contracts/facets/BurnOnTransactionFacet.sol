// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransferLib.sol";
import "../libraries/BurnOnTransactionLib.sol";

interface IModuleToggleFacet {
    function isModuleEnabled(bytes32 moduleId) external view returns (bool);
}

contract BurnOnTransactionFacet {
    // The module identifier used for toggling.
    bytes32 constant MODULE_ID = keccak256("BurnOnTransaction");

    event BurnOnTransactionExecuted(
        address indexed sender,
        address indexed recipient,
        uint256 amountSent,
        uint256 amountBurned
    );

    // Initialize the burn module by setting the burn percentage.
    function initializeBurnModule(uint256 _burnPercent) external {
        BurnOnTransactionLib.Storage storage s = BurnOnTransactionLib.burnStorage();
        require(s.burnPercent == 0, "Already initialized");
        s.burnPercent = _burnPercent;
    }

    // This transfer function must exactly match the ERC20 transfer signature.
    function transfer(address recipient, uint256 amount) public returns (bool) {
        BurnOnTransactionLib.Storage storage s = BurnOnTransactionLib.burnStorage();
        uint256 burnPercent = s.burnPercent;

        if (isModuleActive()) {
            uint256 burnAmount = (amount * burnPercent) / 10000;
            uint256 transferAmount = amount - burnAmount;
            
            // Burn tokens using the shared library logic.
            TransferLib._burn(msg.sender, burnAmount);
            // Transfer remaining tokens.
            TransferLib._transferTokens(msg.sender, recipient, transferAmount);

            emit BurnOnTransactionExecuted(msg.sender, recipient, transferAmount, burnAmount);
            return true;
        } else {
            // Module inactive: perform standard transfer.
            TransferLib._transferTokens(msg.sender, recipient, amount);
            return true;
        }
    }

    function isModuleActive() internal view returns (bool) {
        return IModuleToggleFacet(address(this)).isModuleEnabled(MODULE_ID);
    }
}
