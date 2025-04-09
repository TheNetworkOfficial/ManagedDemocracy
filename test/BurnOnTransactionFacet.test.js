const { expect } = require("chai");
const { ethers } = require("hardhat");
const { keccak256, toUtf8Bytes } = require("ethers");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const burnModuleId = keccak256(toUtf8Bytes("BurnOnTransaction"));

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, burnOnTransactionFacet, erc20Facet, deployer, addr1, diamondAddress, diamondLoupe;
  const burnModuleId = keccak256(toUtf8Bytes("BurnOnTransaction"));

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    addr1 = fixture.addr1;
    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
    burnOnTransactionFacet = fixture.burnOnTransactionFacet;
    erc20Facet = fixture.erc20Facet;
    diamondLoupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

    // Initialize BurnOnTransactionFacet's burn percentage (e.g. 100 means 1% burn if divided by 10000)
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacetContract.initializeBurnModule(100);
  });

  it("diagnostic: should print diamond owner", async () => {
    console.log("Diamond owner should be deployer:", deployer.address);
  });

  it("should transfer without burn when module inactive", async () => {
    const amount = ethers.parseUnits("1000", 18);
    // With module inactive, ERC20Facet.transfer is active.
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.equal(amount);
  });

  it("should enable BurnOnTransaction module and replace default transfer", async () => {
    // Enable the module via ModuleToggleFacet; this will trigger the diamond cut automatically.
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(burnModuleId)).to.be.true;

    // Check that the diamond routes the transfer selector to the burn facet.
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    expect(currentFacetAddress).to.equal(burnOnTransactionFacet.address, "Burn facet not active");
  });

  it("should disable BurnOnTransaction module and revert to base transfer", async () => {
    // Disable the module.
    await moduleToggleFacet.setModuleState(burnModuleId, false);
    expect(await moduleToggleFacet.isModuleEnabled(burnModuleId)).to.be.false;

    // Now the transfer selector should route to the ERC20Facet.
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    expect(currentFacetAddress).to.equal(erc20Facet.address, "Base facet not restored");
  });

  it("should burn tokens during transfer when module active", async () => {
    // Enable the module.
    await moduleToggleFacet.setModuleState(burnModuleId, true);

    const amount = ethers.parseUnits("1000", 18);
    // Assuming initializeBurnModule(100) makes burnAmount = amount / 100 (i.e. 1% burn)
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;

    // Call transfer via the diamond (now routed to BurnOnTransactionFacet.transfer)
    const burnFacet = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacet.transfer(addr1.address, amount);

    // Verify that the recipient's balance is as expected.
    const finalBalance = await erc20.balanceOf(addr1.address);
    expect(finalBalance).to.equal(receivedAmount);

    // Verify that the total supply decreased by the burn amount.
    const totalSupply = await erc20.totalSupply();
    const expectedTotalSupply = ethers.parseUnits("100000000", 18) - burnAmount;
    expect(totalSupply).to.equal(expectedTotalSupply);
  });
});
