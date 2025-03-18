const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20Facet Tests", function () {
  let diamond, owner, addr1;

  before(async () => {
    [owner, addr1] = await ethers.getSigners();

    // Deploy the Diamond contract with all facets via your deploy script logic
    // You can replicate the deployDiamond logic here, or use a fixture
    // For simplicity, here's an inline deploy example:

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

    // Deploy main Diamond contract
    const Diamond = await ethers.getContractFactory("Diamond");
    const diamondContract = await Diamond.deploy(owner.address, diamondCutFacetAddress);
    await diamondContract.waitForDeployment();
    const diamondAddress = await diamondContract.getAddress();

    // Add ERC20Facet to the Diamond
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

    // Initialize ERC20Facet explicitly
    const erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    const initialSupply = ethers.parseUnits("100000000", 18);
    const txInit = await erc20.initializeERC20("Managed Democracy", "MDEM", initialSupply, owner.address);
    await txInit.wait();

    // Set diamond for tests
    diamond = erc20;
  });

  it("should return correct ERC20 token details", async () => {
    expect(await diamond.name()).to.equal("Managed Democracy");
    expect(await diamond.symbol()).to.equal("MDEM");
    expect(await diamond.decimals()).to.equal(18);
  });

  it("should have correct initial supply", async () => {
    const totalSupply = await diamond.totalSupply();
    expect(totalSupply).to.equal(ethers.parseUnits("100000000", 18));

    const ownerBalance = await diamond.balanceOf(owner.address);
    expect(ownerBalance).to.equal(totalSupply);
  });
});