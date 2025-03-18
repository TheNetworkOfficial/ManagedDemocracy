const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ERC20Facet Tests", function () {
  let erc20, deployer;

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    deployer = fixture.deployer;

    erc20 = await ethers.getContractAt("ERC20Facet", fixture.diamondAddress);
  });

  it("should return correct ERC20 token details", async () => {
    expect(await erc20.name()).to.equal("Managed Democracy");
    expect(await erc20.symbol()).to.equal("MDEM");
    expect(await erc20.decimals()).to.equal(18);
  });

  it("should have correct initial supply", async () => {
    const totalSupply = await erc20.totalSupply();
    expect(totalSupply).to.equal(ethers.parseUnits("100000000", 18));

    const ownerBalance = await erc20.balanceOf(deployer.address);
    expect(ownerBalance).to.equal(totalSupply);
  });
});
