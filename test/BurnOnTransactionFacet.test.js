// BurnOnTransactionFacet.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, burnOnTransactionFacet, erc20Facet, deployer, addr1, diamondAddress;

  let diamondLoupe; // Declare at the top along with other variables

  before(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    addr1 = fixture.addr1;
    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
    burnOnTransactionFacet = fixture.burnOnTransactionFacet;
    erc20Facet = fixture.erc20Facet;
  
    // Initialize BurnOnTransactionFacet
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacetContract.initializeBurnModule(100);
  
    // Initialize diamondLoupe variable here:
    diamondLoupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
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

  it("should disable base transfer when burn module is active", async function () {
    const burnModuleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BurnOnTransaction"));
    // Enable the burn module via the ModuleToggleFacet
    await moduleToggleFacet.setModuleState(burnModuleId, true);

    // Verify that calling the default transfer function reverts.
    await expect(erc20Facet.transfer(recipient.address, 1000))
        .to.be.revertedWith("Default transfer disabled when burn module is active");

    // Now simulate a transfer using the BurnOnTransactionFacet (which should perform the burn and transfer)
    // (Assuming you have initialized the burn module in BurnOnTransactionFacet with the desired burn percentage)
    await burnOnTransactionFacet.initializeBurnModule(1000); // e.g., 10% if your math divides by 10000
    const tx = await burnOnTransactionFacet.transfer(recipient.address, 1000);
    await tx.wait();

    // Further assertions can verify that the recipient got the correct net amount and tokens were burned.
  });

  it("should burn tokens during transfer when active", async () => {
    let diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    diamondCut = diamondCut.connect(deployer);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
    const burnFacetAddress = await burnOnTransactionFacet.getAddress();
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
  
    // Replace the transfer function
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    if (currentFacetAddress !== burnFacetAddress) {
      await diamondCut.diamondCut(
        [{
          facetAddress: burnFacetAddress,
          action: FacetCutAction.Replace,
          functionSelectors: [transferSelector],
        }],
        ethers.ZeroAddress,
        "0x"
      );
    }
  
    // Enable the burn module explicitly
    const moduleId = ethers.keccak256(ethers.toUtf8Bytes("BurnOnTransaction"));
    await moduleToggleFacet.setModuleState(moduleId, true);
  
    const amount = ethers.parseUnits("1000", 18);
    const burnAmount = amount / 100n; // 1% burn
    const receivedAmount = amount - burnAmount;
  
    // Call explicitly through the diamond address with the correct ABI directly (DO NOT use old ERC20 ABI here!)
    const burnFacet = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    await burnFacet.transfer(addr1.address, amount);
  
    // Verify balances explicitly using diamond address again
    const finalBalance = await erc20.balanceOf(addr1.address);
    expect(finalBalance).to.equal(receivedAmount);
  
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
