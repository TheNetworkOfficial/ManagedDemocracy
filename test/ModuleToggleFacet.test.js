const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ModuleToggleFacet Tests", function () {
  let diamond, owner, moduleToggle;

  before(async () => {
    [owner] = await ethers.getSigners();
    diamond = await ethers.getContractAt(
      "ModuleToggleFacet",
      "<your-diamond-address-here>"
    );
    moduleToggle = ethers.keccak256(ethers.toUtf8Bytes("DeflationaryModule"));
  });

  it("should initially disable modules", async () => {
    expect(await diamond.isModuleEnabled(moduleToggle)).to.equal(false);
  });

  it("should allow owner to enable modules", async () => {
    await diamond.setModuleState(moduleToggle, true);
    expect(await diamond.isModuleEnabled(moduleToggle)).to.equal(true);
  });

  it("should allow owner to disable modules", async () => {
    await diamond.setModuleState(moduleToggle, false);
    expect(await diamond.isModuleEnabled(moduleToggle)).to.equal(false);
  });
});
