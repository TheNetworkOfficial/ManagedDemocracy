// fixtures.js
const { ethers } = require("hardhat");

async function deployManagedDemocracyFixture() {
  const [deployer, addr1] = await ethers.getSigners();

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("contracts/facets/DiamondCutFacet.sol:DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  const diamondCutFacetAddress = await diamondCutFacet.getAddress();

  // Deploy ERC20Facet
  const ERC20Facet = await ethers.getContractFactory("contracts/facets/ERC20Facet.sol:ERC20Facet");
  const erc20Facet = await ERC20Facet.deploy();
  await erc20Facet.waitForDeployment();
  const erc20FacetAddress = await erc20Facet.getAddress();

  // Deploy ModuleToggleFacet
  const ModuleToggleFacet = await ethers.getContractFactory("contracts/facets/ModuleToggleFacet.sol:ModuleToggleFacet");
  const moduleToggleFacet = await ModuleToggleFacet.deploy();
  await moduleToggleFacet.waitForDeployment();
  const moduleToggleFacetAddress = await moduleToggleFacet.getAddress();

  // Deploy BurnOnTransactionFacet
  const BurnOnTransactionFacet = await ethers.getContractFactory("contracts/facets/BurnOnTransactionFacet.sol:BurnOnTransactionFacet");
  const burnOnTransactionFacet = await BurnOnTransactionFacet.deploy();
  await burnOnTransactionFacet.waitForDeployment();
  const burnOnTransactionFacetAddress = await burnOnTransactionFacet.getAddress();

  // (Optional) Deploy OwnershipFacet if needed...
  const OwnershipFacet = await ethers.getContractFactory("contracts/facets/OwnershipFacet.sol:OwnershipFacet");
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.waitForDeployment();
  const ownershipFacetAddress = await ownershipFacet.getAddress();

  // Deploy main Diamond contract
  const Diamond = await ethers.getContractFactory("Diamond", deployer);
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacetAddress);
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();

  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // Add ERC20Facet to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: erc20FacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: ERC20Facet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => ERC20Facet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  // Initialize ERC20Facet
  const erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
  await erc20.initializeERC20("Managed Democracy", "MDEM", ethers.parseUnits("100000000", 18), deployer.address);

  // Deploy DiamondLoupeFacet and add it to Diamond
  const DiamondLoupeFacet = await ethers.getContractFactory("contracts/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet");
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.waitForDeployment();
  const diamondLoupeFacetAddress = await diamondLoupeFacet.getAddress();

  await diamondCut.diamondCut(
    [{
      facetAddress: diamondLoupeFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: DiamondLoupeFacet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => DiamondLoupeFacet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  // Add ModuleToggleFacet to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: moduleToggleFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: ModuleToggleFacet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => ModuleToggleFacet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  // Add only the initializeBurnModule function from BurnOnTransactionFacet to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: burnOnTransactionFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [
        burnOnTransactionFacet.interface.getFunction("initializeBurnModule").selector,
      ],
    }],
    ethers.ZeroAddress, "0x"
  );

  // Configure the BurnOnTransaction module via ModuleToggleFacet.
  const moduleToggle = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
  const burnModuleId = keccak256(toUtf8Bytes("BurnOnTransaction"));
  // Set configuration: when active use burnOnTransactionFacet; when inactive, use erc20Facet.
  // Overlapping function: transfer(address,uint256)
  await moduleToggle.setModuleConfiguration(
    burnModuleId,
    burnOnTransactionFacetAddress,
    erc20FacetAddress,
    [burnOnTransactionFacet.interface.getFunction("transfer").selector]
  );

  return {
    diamondAddress,
    deployer,
    addr1,
    burnOnTransactionFacet, // instance of BurnOnTransactionFacet (as deployed separately)
    erc20Facet,             // instance of ERC20Facet
    moduleToggleFacet: moduleToggle, // instance of ModuleToggleFacet on diamond
  };
}

module.exports = { deployManagedDemocracyFixture };
