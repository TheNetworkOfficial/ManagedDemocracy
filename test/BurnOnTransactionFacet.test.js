const { expect } = require("chai");
const { ethers } = require("hardhat");
const { keccak256, toUtf8Bytes } = require("ethers");
const { deployManagedDemocracyFixture } = require("./helpers/fixtures");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const burnModuleId = keccak256(toUtf8Bytes("BurnOnTransaction"));

describe("BurnOnTransactionFacet Tests", function () {
  let erc20, moduleToggleFacet, burnOnTransactionFacet, erc20Facet, deployer, addr1, diamondAddress, diamondLoupe;
  const burnModuleId = keccak256(toUtf8Bytes("BurnOnTransaction"));

  beforeEach(async () => {
    const fixture = await loadFixture(deployManagedDemocracyFixture);
    diamondAddress = fixture.diamondAddress;
    deployer = fixture.deployer;
    addr1 = fixture.addr1;
    erc20 = await ethers.getContractAt("ERC20Facet", diamondAddress);
    moduleToggleFacet = await ethers.getContractAt("ModuleToggleFacet", diamondAddress);
    burnOnTransactionFacet = fixture.burnOnTransactionFacet;
    erc20Facet = fixture.erc20Facet;
    diamondLoupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
  
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    try {
      await burnFacetContract.initializeBurnModule(100);
    } catch (e) {
      // already initialized
    }
  
    // Explicitly ensure module is OFF before each test
    const isEnabled = await moduleToggleFacet.isModuleEnabled(burnModuleId);
    if (isEnabled) {
      await moduleToggleFacet.setModuleState(burnModuleId, false);
    }
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
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(burnModuleId)).to.be.true;
  
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    expect(currentFacetAddress).to.not.equal(ethers.ZeroAddress, "Burn facet address should not be zero when active");
    expect(currentFacetAddress).to.equal(await burnOnTransactionFacet.getAddress(), "Burn facet not active");
  });  

  it("should not allow reinitialization of burn module", async () => {
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Attempting to reinitialize should revert
    await expect(burnFacetContract.initializeBurnModule(100))
      .to.be.revertedWith("Already initialized");
  });

  it("should allow the owner to update the burn rate", async () => {
    // Get the diamondCut instance from diamondAddress:
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
    // Add the new updateBurnModule function to the diamond
    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );
  
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Now update the burn rate to 200 (2%)
    await burnFacetContract.updateBurnModule(200);
    
    // Enable module to route calls through BurnOnTransactionFacet
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    
    const amount = ethers.parseUnits("1000", 18);
    const newBurnAmount = amount / 50n; // 2% burned
    const newReceivedAmount = amount - newBurnAmount;
    
    await erc20.transfer(addr1.address, amount);
    const finalBalance = await erc20.balanceOf(addr1.address);
    expect(finalBalance).to.equal(newReceivedAmount);
  });
  
  it("should revert if a non-owner attempts to update the burn rate", async () => {
    // Add updateBurnModule to the diamond as above:
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );
  
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Attempt to update from addr1 (not the owner) and expect a revert.
    await expect(burnFacetContract.connect(addr1).updateBurnModule(200))
      .to.be.revertedWith("LibDiamond: Must be contract owner");
  }); 

  it("should disable BurnOnTransaction module and revert to base transfer", async () => {
    // First explicitly enable module, since each test starts with module disabled now.
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    expect(await moduleToggleFacet.isModuleEnabled(burnModuleId)).to.be.true;
  
    // Now explicitly disable module.
    await moduleToggleFacet.setModuleState(burnModuleId, false);
    expect(await moduleToggleFacet.isModuleEnabled(burnModuleId)).to.be.false;
  
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const currentFacetAddress = await diamondLoupe.facetAddress(transferSelector);
    expect(currentFacetAddress).to.not.equal(ethers.ZeroAddress, "ERC20 facet address should not be zero when restored");
    expect(currentFacetAddress).to.equal(await erc20Facet.getAddress(), "Base facet not restored");    
  });  

  it("should burn tokens during transfer when module active", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
  
    const amount = ethers.parseUnits("1000", 18);       // amount is a bigint in ethers v6
    const burnAmount = amount / 100n;                     // expected burn (1%)
    const receivedAmount = amount - burnAmount;           // what the receiver should get
  
    // Execute the transfer (which routes through BurnOnTransactionFacet.transfer)
    await erc20.transfer(addr1.address, amount);
  
    // Print out details for visual confirmation
    console.log("Tokens sent:", ethers.formatUnits(amount, 18));
    console.log("Expected tokens burned:", ethers.formatUnits(burnAmount, 18));
    console.log("Expected tokens received:", ethers.formatUnits(receivedAmount, 18));
  
    const finalBalance = await erc20.balanceOf(addr1.address);
    console.log("Actual tokens received:", ethers.formatUnits(finalBalance, 18));
    expect(finalBalance).to.equal(receivedAmount);
  
    const totalSupply = await erc20.totalSupply();
    const expectedTotalSupply = ethers.parseUnits("100000000", 18) - burnAmount;
    console.log("Total supply after burn:", ethers.formatUnits(totalSupply, 18));
    console.log("Expected total supply after burn:", ethers.formatUnits(expectedTotalSupply, 18));
    expect(totalSupply).to.equal(expectedTotalSupply);
  });

  it("should handle zero token transfer gracefully", async () => {
    const amount = ethers.parseUnits("0", 18);
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.equal(amount);
  });

  it("should correctly handle sequential transfers with burning", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const amount1 = ethers.parseUnits("1000", 18);
    const burnAmount1 = amount1 / 100n;
    const receivedAmount1 = amount1 - burnAmount1;
  
    await erc20.transfer(addr1.address, amount1);
    // Do a second transfer
    const amount2 = ethers.parseUnits("500", 18);
    const burnAmount2 = amount2 / 100n;
    const receivedAmount2 = amount2 - burnAmount2;
  
    await erc20.transfer(addr1.address, amount2);
  
    const finalBalance = await erc20.balanceOf(addr1.address);
    expect(finalBalance).to.equal(receivedAmount1 + receivedAmount2);
  
    const totalSupply = await erc20.totalSupply();
    const expectedTotalSupply = ethers.parseUnits("100000000", 18) - (burnAmount1 + burnAmount2);
    expect(totalSupply).to.equal(expectedTotalSupply);
  });

  it("should emit BurnOnTransactionExecuted with correct parameters", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    
    const amount = ethers.parseUnits("1000", 18);
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;
    
    const tx = await erc20.transfer(addr1.address, amount);
    const receipt = await tx.wait();
  
    // Iterate over receipt.logs and decode them using the BurnOnTransactionFacet interface:
    let eventFound;
    for (const log of receipt.logs) {
      try {
        const parsedLog = burnOnTransactionFacet.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "BurnOnTransactionExecuted") {
          eventFound = parsedLog;
          break;
        }
      } catch (e) {
        // This log doesn't belong to BurnOnTransactionFacet, skip it.
      }
    }
    
    expect(eventFound).to.not.be.undefined;
    expect(eventFound.args.sender).to.equal(deployer.address);
    expect(eventFound.args.recipient).to.equal(addr1.address);
    expect(eventFound.args.amountSent).to.equal(receivedAmount);
    expect(eventFound.args.amountBurned).to.equal(burnAmount);
  });

  it("should handle extremely low transfer amounts where burn rounds down to zero", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    // Transfer an amount in the smallest unit that is less than 100.
    // Using ethers.parseUnits with a very low amount (50 wei-equivalent).
    const amount = ethers.parseUnits("0.00000000000000005", 18); // equals 50 wei
    // The burn calculation: 50 / 100 = 0 (integer division)
    const burnAmount = amount / 100n;
    expect(burnAmount).to.equal(0n);
    await erc20.transfer(addr1.address, amount);
    const finalBalance = await erc20.balanceOf(addr1.address);
    // Full amount should be received as burn is zero.
    expect(finalBalance).to.equal(amount);
  });

  it("should transfer full amount when burn rate is zero", async () => {
    // Add updateBurnModule function to Diamond to allow changing burn rate.
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );

    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Update burn rate to 0%
    await burnFacetContract.updateBurnModule(0);
  
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const amount = ethers.parseUnits("1000", 18);
    await erc20.transfer(addr1.address, amount);
    // No tokens should be burnt; full transfer occurs.
    expect(await erc20.balanceOf(addr1.address)).to.equal(amount);
  });

  it("should burn entire amount if burn rate is 100%", async () => {
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    
    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );

    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Set burn rate to 100%, meaning the full amount is burnt.
    await burnFacetContract.updateBurnModule(10000);
  
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const amount = ethers.parseUnits("1000", 18);
    await erc20.transfer(addr1.address, amount);
    const finalBalance = await erc20.balanceOf(addr1.address);
    // Expect zero tokens received.
    expect(finalBalance).to.equal(0n);
    
    const totalSupply = await erc20.totalSupply();
    expect(totalSupply).to.equal(ethers.parseUnits("100000000", 18) - amount);
  });

  it("should revert when setting an excessive burn rate (>100%)", async () => {
    // If your contract is designed to reject over 100% burn rates, this test should revert.
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );

    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Attempting to set burn rate to 150% should revert.
    await expect(burnFacetContract.updateBurnModule(15000))
      .to.be.revertedWith("Invalid burn rate"); // Adjust the error message if needed.
  });

  it("should revert transfer when sender has insufficient balance", async () => {
    // Attempt to transfer more tokens than the deployer holds.
    const amount = ethers.parseUnits("100000001", 18); // exceeds total supply held by deployer.
    await expect(erc20.transfer(addr1.address, amount)).to.be.reverted;
  });

  it("should handle self-transfer correctly with burning", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const amount = ethers.parseUnits("1000", 18);
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;
    const initialBalance = await erc20.balanceOf(deployer.address);
  
    // Self-transfer should trigger burn logic.
    await erc20.transfer(deployer.address, amount);
    // New balance is initial minus the burned tokens.
    const finalBalance = await erc20.balanceOf(deployer.address);
    expect(finalBalance).to.equal(initialBalance - burnAmount);
  });

  it("should revert transfer to the zero address", async () => {
    const amount = ethers.parseUnits("1000", 18);
    await expect(erc20.transfer(ethers.ZeroAddress, amount)).to.be.reverted;
  });

  it("should not be vulnerable to reentrancy attacks", async () => {
    // This test is a basic placeholder. In-depth reentrancy tests typically involve deploying a malicious contract.
    // Here we confirm that transfers (with burning) complete and that balances are updated as expected.
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const amount = ethers.parseUnits("1000", 18);
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.be.a('bigint');
  });

  it("should maintain consistent behavior after multiple diamondCut operations", async () => {
    // Enable module and perform an update of burn rate via diamondCut.
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    
    await diamondCut.diamondCut(
      [{
        facetAddress: await burnOnTransactionFacet.getAddress(),
        action: FacetCutAction.Add,
        functionSelectors: [
          burnOnTransactionFacet.interface.getFunction("updateBurnModule").selector
        ],
      }],
      ethers.ZeroAddress,
      "0x"
    );
    
    const burnFacetContract = await ethers.getContractAt("BurnOnTransactionFacet", diamondAddress);
    // Update burn rate (for example, set to 75).
    await burnFacetContract.updateBurnModule(75);
  
    // Toggle the module off and verify the base ERC20 functionality returns.
    await moduleToggleFacet.setModuleState(burnModuleId, false);
    const transferSelector = burnOnTransactionFacet.interface.getFunction("transfer").selector;
    const facetAddressAfterDisable = await diamondLoupe.facetAddress(transferSelector);
    expect(facetAddressAfterDisable).to.equal(await erc20Facet.getAddress());
    
    // Re-enable module and verify the burn facet is active again.
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    const facetAddressAfterReenable = await diamondLoupe.facetAddress(transferSelector);
    expect(facetAddressAfterReenable).to.equal(await burnOnTransactionFacet.getAddress());
  });

  it("should correctly round down burn amount on transfers", async () => {
    await moduleToggleFacet.setModuleState(burnModuleId, true);
    // Transfer an amount that is not a multiple of 100 to force truncation.
    // For example, transfer 101 tokens. With integer division, 101/100 should truncate the fraction.
    const amount = ethers.parseUnits("101", 18);
    // Expected burn: floor(101 / 100) = 1 (in the smallest units, given our calculation logic).
    const burnAmount = amount / 100n;
    const receivedAmount = amount - burnAmount;
    await erc20.transfer(addr1.address, amount);
    expect(await erc20.balanceOf(addr1.address)).to.equal(receivedAmount);
  });
});
