const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, burnOnTransactionFacet, deployer, addr1, diamondAddress;

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    addr1 = fixture.addr1;
    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
    burnOnTransactionFacet = fixture.burnOnTransactionFacet;
    
    // Initialize the burn module (attached via diamondCut earlier)
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacetContract.initializeBurnModule(100); // 1% burn
  });

  it("diagnostic: should print diamond owner", async () => {
    // If you have an OwnershipFacet function to query owner, you can use it.
    // For this example, assume the diamond's constructor already set the owner.
    console.log("Diamond owner should be deployer:", deployer.address);
  });

  it("should transfer without burn when module inactive", async () => {
    const amount = ethers.parseUnits("1000", 18);
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.equal(amount);
  });

  it("should enable BurnOnTransaction module", async () => {
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(moduleId)).to.be.true;
  });

  it("should burn tokens during transfer when active", async () => {
    let diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    diamondCut = diamondCut.connect(deployer); // ensure owner is calling
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    const burnFacetAddress = await burnOnTransactionFacet.getAddress();

    await diamondCut.diamondCut(
      [{
        facetAddress: burnFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("transfer").selector,
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );

    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, true);

    const amount = ethers.parseUnits("1000", 18);
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;

    await erc20.transfer(addr1.address, amount);

    const recipientBalance = await erc20.balanceOf(addr1.address);
    expect(recipientBalance).to.equal(receivedAmount);

    const totalSupply = await erc20.totalSupply();
    const expectedTotalSupply = ethers.parseUnits("100000000", 18) - burnAmount;
    expect(totalSupply).to.equal(expectedTotalSupply);
  });

  it("should disable BurnOnTransaction module", async () => {
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, false);
    expect(await moduleToggleFacet.isModuleEnabled(moduleId)).to.be.false;
  });
});
