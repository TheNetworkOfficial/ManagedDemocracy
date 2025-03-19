const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, deployer, user1;

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    const diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    [, addr1] = await ethers.getSigners();

    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);

    const burnFacet = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacet.initializeBurnModule(100); // 1% burn
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
    const amount = ethers.parseUnits("1000", 18);
    const burnAmount = amount / 100; // 1%
    const receivedAmount = amount - burnAmount;

    await erc20.transfer(addr1.address, amount);

    const recipientBalance = await erc20.balanceOf(addr1.address);
    expect(recipientBalance).to.equal(ethers.parseUnits("990", 18));

    const totalSupply = await erc20.totalSupply();
    expect(totalSupply).to.equal(ethers.parseUnits("99999999", 18));
  });

  it("should disable BurnOnTransaction module", async () => {
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, false);
    expect(await moduleToggleFacet.isModuleEnabled(moduleId)).to.be.false;
  });
});
