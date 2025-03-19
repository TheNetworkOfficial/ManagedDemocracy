// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IModuleToggleFacet {
    function isModuleEnabled(bytes32 moduleId) external view returns (bool);
}

interface IERC20Facet {
    function burn(address from, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BurnOnTransactionFacet {
    bytes32 constant MODULE_ID = keccak256("BurnOnTransaction");
    uint256 public burnPercent; // 100 = 1%, 250 = 2.5%

    event BurnOnTransactionExecuted(address indexed sender, address indexed recipient, uint256 amountSent, uint256 amountBurned);

    function initializeBurnModule(uint256 _burnPercent) external {
        require(burnPercent == 0, "Already initialized");
        burnPercent = _burnPercent;
    }

    function transfer(address from, address to, uint256 amount) external returns (bool) {
        require(isModuleActive(), "BurnOnTransaction inactive");

        uint256 burnAmount = (amount * burnPercent) / 10000;
        uint256 transferAmount = amount - burnAmount;

        IERC20Facet(address(this)).burn(from, burnAmount);
        IERC20Facet(address(this)).transferFrom(from, to, transferAmount);

        emit BurnOnTransactionExecuted(from, to, transferAmount, burnAmount);

        return true;
    }

    function isModuleActive() internal view returns (bool) {
        return IModuleToggleFacet(address(this)).isModuleEnabled(MODULE_ID);
    }
}
