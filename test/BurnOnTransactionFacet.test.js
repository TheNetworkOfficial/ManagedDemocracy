// BurnOnTransactionFacet.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, burnOnTransactionFacet, erc20Facet, deployer, addr1, diamondAddress;

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    addr1 = fixture.addr1;
    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
    burnOnTransactionFacet = fixture.burnOnTransactionFacet;
  
    // Call initializeBurnModule only if it has not been initialized yet.
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Optionally check if already initialized (if your interface exposed a getter)
    // For now, assume this diamond is fresh.
    await burnFacetContract.initializeBurnModule(100);
  });

  it("diagnostic: should print diamond owner", async () => {
    console.log("Diamond owner should be deployer:", deployer.address);
  });

  it("should transfer without burn when module inactive", async () => {
    const amount = ethers.parseUnits("1000", 18);
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.equal(amount);
  });

  it("should enable BurnOnTransaction module and disable default transfer", async () => {
    // Enable module via ModuleToggleFacet
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(moduleId)).to.be.true;

    // Perform diamondCut Replace: swap ERC20Facet.transfer for BurnOnTransactionFacet.transfer
    let diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    diamondCut = diamondCut.connect(deployer);
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

    // Now check that the diamond routes transfer calls to BurnOnTransactionFacet
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    expect(currentFacetAddress).to.equal(burnFacetAddress, "Default transfer function is still enabled!");
  });

  it("should burn tokens during transfer when active", async () => {
    // Connect diamondCut contract as owner
    let diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    diamondCut = diamondCut.connect(deployer);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
    // Replace the transfer function with the BurnOnTransactionFacet.transfer
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
  
    // Enable the burn module via ModuleToggleFacet
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(moduleId)).to.be.true;
  
    const amount = ethers.parseUnits("1000", 18);
    // For burnPercent of 100, we assume a burn rate of 1% → burnAmount = amount/100
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;
  
    // Call transfer using ERC20Facet interface (which now routes to BurnOnTransactionFacet.transfer)
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
