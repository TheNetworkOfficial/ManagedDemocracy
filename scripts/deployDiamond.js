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
}

main().catch(console.error);