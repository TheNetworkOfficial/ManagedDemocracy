const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Diamond with:", deployer.address);

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  const diamondCutFacetAddress = await diamondCutFacet.getAddress();
  console.log("DiamondCutFacet deployed to:", diamondCutFacetAddress);

  // Deploy ERC20Facet
  const ERC20Facet = await ethers.getContractFactory("ERC20Facet");
  const erc20Facet = await ERC20Facet.deploy();
  await erc20Facet.waitForDeployment();
  const erc20FacetAddress = await erc20Facet.getAddress();
  console.log("ERC20Facet deployed to:", erc20FacetAddress);

  // Deploy main Diamond contract
  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacetAddress);
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();
  console.log("Diamond deployed to:", diamondAddress);

  // Connect to Diamond contract
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);

  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const selectors = erc20Facet.interface.fragments
    .filter((f) => f.type === "function")
    .map((f) => erc20Facet.interface.getFunction(f.name).selector);

  const cut = [{
    facetAddress: erc20FacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: selectors,
  }];

  const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
  await tx.wait();
  console.log("ERC20Facet added to Diamond");

  // Initialize ERC20Facet explicitly
  const erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
  const initialSupply = ethers.parseUnits("100000000", 18);

  const txInit = await erc20.initializeERC20("Managed Democracy", "MDEM", initialSupply, deployer.address);
  await txInit.wait();
  console.log("ERC20Facet initialized successfully");

  // Deploy ModuleToggleFacet
  const ModuleToggleFacet = await ethers.getContractFactory("ModuleToggleFacet");
  const moduleToggleFacet = await ModuleToggleFacet.deploy();
  await moduleToggleFacet.waitForDeployment();
  const moduleToggleFacetAddress = await moduleToggleFacet.getAddress();
  console.log("ModuleToggleFacet deployed to:", moduleToggleFacetAddress);

  // Add ModuleToggleFacet to Diamond
  const toggleSelectors = moduleToggleFacet.interface.fragments
    .filter((f) => f.type === "function")
    .map((f) => moduleToggleFacet.interface.getFunction(f.name).selector);

  const toggleCut = [{
    facetAddress: moduleToggleFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: toggleSelectors,
  }];

  const toggleTx = await diamondCut.diamondCut(toggleCut, ethers.ZeroAddress, "0x");
  await toggleTx.wait();
  console.log("ModuleToggleFacet added to Diamond");

  // Deploy BurnOnTransactionFacet
  const BurnOnTransactionFacet = await ethers.getContractFactory("BurnOnTransactionFacet");
  const burnOnTransactionFacet = await BurnOnTransactionFacet.deploy();
  await burnOnTransactionFacet.waitForDeployment();
  const burnOnTransactionFacetAddress = await burnOnTransactionFacet.getAddress();
  console.log("BurnOnTransactionFacet deployed to:", burnOnTransactionFacetAddress);

  // Replace ERC20Facet transfer function explicitly
  const transferSelector = ERC20Facet.interface.getFunction("transfer").selector;

  const burnFacetSelectors = [
    transferSelector,
    BurnOnTransactionFacet.interface.getFunction("initializeBurnModule").selector
  ];

  await diamondCut.diamondCut(
    [{
      facetAddress: burnOnTransactionFacetAddress,
      action: FacetCutAction.Replace, // <-- Must use Replace to override existing transfer
      functionSelectors: burnFacetSelectors,
    }],
    ethers.ZeroAddress,
    "0x"
  );

  console.log("BurnOnTransactionFacet added to Diamond, replacing ERC20 transfer");

}

main().catch(console.error);