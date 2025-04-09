/*

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ModuleToggleFacet Tests", function () {
  let moduleToggleFacet;
  let moduleToggle;

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);

    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", fixture.diamondAddress);
    moduleToggle = ethers.keccak256(ethers.toUtf8Bytes("DeflationaryModule"));
  });

  it("should initially disable modules", async () => {
    expect(await moduleToggleFacet.isModuleEnabled(moduleToggle)).to.equal(false);
  });

  it("should allow owner to enable modules", async () => {
    await moduleToggleFacet.setModuleState(moduleToggle, true);
    expect(await moduleToggleFacet.isModuleEnabled(moduleToggle)).to.equal(true);
  });

  it("should allow owner to disable modules", async () => {
    await moduleToggleFacet.setModuleState(moduleToggle, false);
    expect(await moduleToggleFacet.isModuleEnabled(moduleToggle)).to.equal(false);
  });
});

*/