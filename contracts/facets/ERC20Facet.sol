// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransferLib.sol";

// Add a minimal interface to check module toggling status
interface IModuleToggleFacet {
    function isModuleEnabled(bytes32 module) external view returns (bool);
}

contract ERC20Facet {
    bool private initialized;
    string private _nameERC20;
    string private _symbolERC20;

    // Initialize the token with a name, symbol, initial supply, and owner.
    function initializeERC20(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address owner
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;
        _nameERC20 = _name;
        _symbolERC20 = _symbol;
        TransferLib._mint(owner, _initialSupply);
    }

    function name() public view returns (string memory) {
        return _nameERC20;
    }

    function symbol() public view returns (string memory) {
        return _symbolERC20;
    }
    
    // Provide decimals (as expected by many ERC20 UIs/tests)
    function decimals() public pure returns (uint8) {
        return 18;
    }

    function totalSupply() public view returns (uint256) {
        return TransferLib.tokenStorage().totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return TransferLib.tokenStorage().balances[account];
    }

    // Modified transfer function: if the burn module is active, revert so that
    // the BurnOnTransactionFacet.transfer is the only active logic.
    function transfer(address recipient, uint256 amount) public returns (bool) {
        bytes32 burnModuleId = keccak256("BurnOnTransaction");
        bool burnActive = IModuleToggleFacet(address(this)).isModuleEnabled(burnModuleId);
        require(!burnActive, "Default transfer disabled when burn module is active");
        TransferLib._transferTokens(msg.sender, recipient, amount);
        return true;
    }

    // Expose burn so it can be called by modules (e.g. BurnOnTransactionFacet).
    function burn(address from, uint256 amount) external {
        TransferLib._burn(from, amount);
    }

    // Expose an internal transfer function that modules can use (if needed).
    function _transferTokens(address sender, address recipient, uint256 amount) external {
        TransferLib._transferTokens(sender, recipient, amount);
    }
}
