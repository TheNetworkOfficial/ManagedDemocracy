// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IModuleToggleFacet {
    function isModuleEnabled(bytes32 moduleId) external view returns (bool);
}

interface IERC20Facet {
    function burn(address from, uint256 amount) external;
}

contract BurnOnTransactionFacet {
    bytes32 constant MODULE_ID = keccak256("BurnOnTransaction");
    uint256 public burnPercent;

    event BurnOnTransactionExecuted(address indexed sender, address indexed recipient, uint256 amountSent, uint256 amountBurned);

    function initializeBurnModule(uint256 _burnPercent) external {
        require(burnPercent == 0, "Already initialized");
        burnPercent = _burnPercent;
    }

    // Must exactly match ERC20Facet's transfer signature!
    function transfer(address recipient, uint256 amount) public returns (bool) {
        if (isModuleActive()) {
            uint256 burnAmount = (amount * burnPercent) / 10000;
            uint256 transferAmount = amount - burnAmount;

            IERC20Facet(address(this)).burn(msg.sender, burnAmount);

            (bool success, bytes memory data) = address(this).delegatecall(
                abi.encodeWithSignature("transfer(address,uint256)", recipient, transferAmount)
            );

            require(success, "Transfer failed after burn");

            emit BurnOnTransactionExecuted(msg.sender, recipient, transferAmount, burnAmount);
            return abi.decode(data, (bool));
        } else {
            // Delegatecall to ERC20Facet if inactive
            (bool success, bytes memory data) = address(this).delegatecall(
                abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
            );

            require(success, "Standard transfer failed");
            return abi.decode(data, (bool));
        }
    }

    function isModuleActive() internal view returns (bool) {
        return IModuleToggleFacet(address(this)).isModuleEnabled(MODULE_ID);
    }
}
