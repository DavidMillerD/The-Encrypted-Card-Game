const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  console.log("Current deployer address:", signers[0].address);

  const balance = await ethers.provider.getBalance(signers[0].address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});