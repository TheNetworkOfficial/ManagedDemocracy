// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

contract ERC20Facet is ERC20 {
    bool private initialized;

    constructor() ERC20("Managed Democracy", "MDEM") {
        initialized = true;
    }

    function initializeERC20(string memory _name, string memory _symbol, uint256 _initialSupply, address owner) external {
        require(!initialized, "Already initialized");
        initialized = true;

        _nameERC20 = _name;
        _symbolERC20 = _symbol;

        _mint(owner, _initialSupply);
    }

    string private _nameERC20;
    string private _symbolERC20;

    function name() public view override returns (string memory) {
        return _nameERC20;
    }

    function symbol() public view override returns (string memory) {
        return _symbolERC20;
    }

    // Explicit transfer declaration to allow Diamond replacement
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        return super.transfer(recipient, amount);
    }

    // Modified burn method: Removed owner check so that burn can be called via delegatecall.
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
