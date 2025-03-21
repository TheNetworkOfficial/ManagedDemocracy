const { ethers } = require("hardhat");

async function deployManagedDemocracyFixture() {
  const [deployer, addr1] = await ethers.getSigners();

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  const diamondCutFacetAddress = await diamondCutFacet.getAddress();

  // Deploy ERC20Facet
  const ERC20Facet = await ethers.getContractFactory("ERC20Facet");
  const erc20Facet = await ERC20Facet.deploy();
  await erc20Facet.waitForDeployment();
  const erc20FacetAddress = await erc20Facet.getAddress();

  // Deploy ModuleToggleFacet
  const ModuleToggleFacet = await ethers.getContractFactory("ModuleToggleFacet");
  const moduleToggleFacet = await ModuleToggleFacet.deploy();
  await moduleToggleFacet.waitForDeployment();
  const moduleToggleFacetAddress = await moduleToggleFacet.getAddress();

  // Deploy BurnOnTransactionFacet (module facet)
  const BurnOnTransactionFacet = await ethers.getContractFactory("BurnOnTransactionFacet");
  const burnOnTransactionFacet = await BurnOnTransactionFacet.deploy();
  await burnOnTransactionFacet.waitForDeployment();
  const burnOnTransactionFacetAddress = await burnOnTransactionFacet.getAddress();

  // (OPTIONAL: Remove OwnershipFacet addition from the fixture)
  // const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
  // const ownershipFacet = await OwnershipFacet.deploy();
  // await ownershipFacet.waitForDeployment();
  // const ownershipFacetAddress = await ownershipFacet.getAddress();

  // Deploy main Diamond contract using the deployer as owner
  const Diamond = await ethers.getContractFactory("Diamond", deployer);
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacetAddress);
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();

  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // Add ERC20Facet functions to Diamond
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

  // Add ModuleToggleFacet functions to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: moduleToggleFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: moduleToggleFacet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => ModuleToggleFacet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  // Attach only the initializeBurnModule function from BurnOnTransactionFacet
  await diamondCut.diamondCut(
    [{
      facetAddress: burnOnTransactionFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [
        BurnOnTransactionFacet.interface.getFunction("initializeBurnModule").selector,
      ],
    }],
    ethers.ZeroAddress, "0x"
  );

  // Do not add the OwnershipFacet here so that diamondCut remains provided by DiamondCutFacet.

  return {
    diamondAddress,
    deployer,
    addr1,
    burnOnTransactionFacet, // for later use in tests
  };
}

module.exports = { deployManagedDemocracyFixture };
