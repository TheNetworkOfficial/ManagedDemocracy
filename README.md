# Managed Democracy

Managed Democracy is a modular and upgradeable blockchain project leveraging Ethereum's ERC20 standard and the EIP-2535 Diamond Standard. This system allows token holders to democratically enable or disable modules affecting inflationary or deflationary mechanisms of the token supply.

## Project Overview

Managed Democracy employs a facet-based structure using the Diamond Standard to maximize modularity, security, and upgradability. It consists of independent smart contract modules (facets) that can be dynamically added, replaced, or removed without affecting the core logic.

## Features

- **ERC20 Token:** Managed Democracy token (MDEM), with a fixed initial supply.
- **Modular Design:** Independent facets for managing token behaviors like inflation, deflation, and staking.
- **Governance:** Future implementation includes a staking and voting mechanism, initially managed through a multi-sig wallet with a time lock.
- **Off-chain Computations:** Utilizing ZK-Rollups to ensure low transaction costs while maintaining a high level of security and trustlessness.

## Directory Structure

```
thenetworkofficial-manageddemocracy/
├── contracts/
│   ├── Diamond.sol
│   ├── Timelock.sol
│   ├── facets/
│   │   ├── DiamondCutFacet.sol
│   │   ├── DiamondLoupeFacet.sol
│   │   ├── ERC20Facet.sol
│   │   ├── OwnershipFacet.sol
│   │   ├── Test1Facet.sol
│   │   └── Test2Facet.sol
│   ├── governance/
│   │   └── MyTimelockController.sol
│   ├── interfaces/
│   │   ├── IDiamondCut.sol
│   │   ├── IDiamondLoupe.sol
│   │   ├── IERC165.sol
│   │   └── IERC173.sol
│   └── libraries/
│       └── LibDiamond.sol
├── Documentation/
│   ├── DEPENDENCIES.md
│   └── TESTING.md
├── scripts/
│   └── deployDiamond.js
├── test/
│   └── ERC20Facet.test.js
├── hardhat.config.js
└── package.json
```

## Installation

Install dependencies using npm:
```sh
npm install
```

## Deployment

To deploy the Managed Democracy smart contracts:

1. Start a local Hardhat network:
```sh
npx hardhat node
```

2. Deploy contracts using the deployment script:
```sh
npx hardhat run scripts/deployDiamond.js --network localhost
```

## Testing

Run tests locally:
```sh
npx hardhat test --network localhost
```

Tests cover token metadata, initial supply correctness, and ownership distribution.

## Governance and Security

Initial governance utilizes a multi-signature wallet with a timelock mechanism to enhance security. The project's long-term vision includes implementing a fully decentralized staking and voting governance model.

## Dependencies

The project relies on:
- [EIP-2535 Diamond Standard](https://github.com/mudgen/diamond-3-hardhat)
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
- [Gnosis Safe Multisig Wallet](https://safe.global/)

Future developments include replacing these external dependencies with proprietary implementations.

## Contributions

Contributions to the Managed Democracy project are welcomed. Please open an issue or submit a pull request on GitHub to discuss potential improvements or feature requests.

## License

Managed Democracy is open-source software licensed under the MIT license.