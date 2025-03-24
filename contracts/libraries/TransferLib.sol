// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library TransferLib {
    // Define a struct for ERC20 storage.
    struct TokenStorage {
        mapping(address => uint256) balances;
        uint256 totalSupply;
    }

    // Use a unique storage slot for ERC20 data.
    bytes32 constant TOKEN_STORAGE_POSITION = keccak256("diamond.standard.token.storage");

    // Returns a pointer to our TokenStorage.
    function tokenStorage() internal pure returns (TokenStorage storage ts) {
        bytes32 position = TOKEN_STORAGE_POSITION;
        assembly {
            ts.slot := position
        }
    }

    /// @notice Internal transfer function to move tokens between addresses.
    function _transferTokens(address sender, address recipient, uint256 amount) internal {
        TokenStorage storage ts = tokenStorage();
        require(ts.balances[sender] >= amount, "Insufficient balance");
        ts.balances[sender] -= amount;
        ts.balances[recipient] += amount;
    }

    /// @notice Internal mint function to create tokens.
    function _mint(address account, uint256 amount) internal {
        TokenStorage storage ts = tokenStorage();
        ts.totalSupply += amount;
        ts.balances[account] += amount;
    }

    /// @notice Internal burn function to destroy tokens.
    function _burn(address account, uint256 amount) internal {
        TokenStorage storage ts = tokenStorage();
        require(ts.balances[account] >= amount, "Insufficient balance");
        ts.balances[account] -= amount;
        ts.totalSupply -= amount;
    }
}
