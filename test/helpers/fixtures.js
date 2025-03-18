const { ethers } = require("hardhat");

async function deployManagedDemocracyFixture() {
  const [deployer, addr1] = await ethers.getSigners();

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();

  // Deploy ERC20Facet
  const ERC20Facet = await ethers.getContractFactory("ERC20Facet");
  const erc20Facet = await ERC20Facet.deploy();
  await erc20Facet.waitForDeployment();

  // Deploy ModuleToggleFacet
  const ModuleToggleFacet = await ethers.getContractFactory("ModuleToggleFacet");
  const moduleToggleFacet = await ModuleToggleFacet.deploy();
  await moduleToggleFacet.waitForDeployment();

  // Deploy main Diamond contract
  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(deployer.address, await diamondCutFacet.getAddress());
  await diamond.waitForDeployment();

  const diamondCut = await ethers.getContractAt("IDiamondCut", await diamond.getAddress());
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

  // Add ERC20Facet to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: await erc20Facet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: erc20Facet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => erc20Facet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  // Initialize ERC20Facet explicitly
  const erc20 = await ethers.getContractAt("ERC20Facet", await diamond.getAddress());
  await erc20.initializeERC20("Managed Democracy", "MDEM", ethers.parseUnits("100000000", 18), deployer.address);

  // Add ModuleToggleFacet to Diamond
  await diamondCut.diamondCut(
    [{
      facetAddress: await moduleToggleFacet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: moduleToggleFacet.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => moduleToggleFacet.interface.getFunction(f.name).selector),
    }],
    ethers.ZeroAddress, "0x"
  );

  return {
    diamondAddress: await diamond.getAddress(),
    deployer,
    addr1
  };
}

module.exports = { deployManagedDemocracyFixture };
