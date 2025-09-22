import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { fhevm } from "hardhat";

task("game:deploy", "Deploy the EncryptedCardGame contract")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    console.log("Deploying EncryptedCardGame with account:", deployer.address);

    const factory = await ethers.getContractFactory("EncryptedCardGame");
    const contract = await factory.connect(deployer).deploy();
    await contract.waitForDeployment();

    console.log("EncryptedCardGame deployed to:", await contract.getAddress());
  });

task("game:join", "Join a game with encrypted cards")
  .addParam("contract", "The contract address")
  .addParam("cards", "Card types comma separated (0=Eagle, 1=Bear, 2=Snake)")
  .addParam("health", "Card health values comma separated")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    const { contract: contractAddress, cards, health } = taskArguments;
    const [signer] = await ethers.getSigners();

    const contract = await ethers.getContractAt("EncryptedCardGame", contractAddress);

    // Parse input
    const cardTypes = cards.split(",").map((x: string) => parseInt(x.trim()));
    const cardHealths = health.split(",").map((x: string) => parseInt(x.trim()));

    if (cardTypes.length !== 6 || cardHealths.length !== 6) {
      throw new Error("Must provide exactly 6 cards and 6 health values");
    }

    // Validate card types (0, 1, 2)
    for (const cardType of cardTypes) {
      if (![0, 1, 2].includes(cardType)) {
        throw new Error("Card types must be 0 (Eagle), 1 (Bear), or 2 (Snake)");
      }
    }

    // Validate health (1-10)
    for (const hp of cardHealths) {
      if (hp < 1 || hp > 10) {
        throw new Error("Card health must be between 1 and 10");
      }
    }

    console.log("Creating encrypted inputs...");

    // Create encrypted input
    const input = fhevm.createEncryptedInput(contractAddress, signer.address);
    
    // Add card types
    for (const cardType of cardTypes) {
      input.add8(cardType);
    }
    
    // Add card healths
    for (const cardHealth of cardHealths) {
      input.add8(cardHealth);
    }

    const encryptedInput = await input.encrypt();

    console.log("Joining game...");

    const tx = await contract.connect(signer).joinGame(
      encryptedInput.handles.slice(0, 6), // Card types
      encryptedInput.handles.slice(6, 12), // Card healths
      encryptedInput.inputProof
    );

    await tx.wait();
    console.log("Successfully joined game!");

    // Check game info
    const gameInfo = await contract.getGameInfo();
    console.log("Game state:", gameInfo.state.toString());
    console.log("Players joined:", gameInfo.joined.toString());
    console.log("Current round:", gameInfo.round.toString());
  });

task("game:play", "Play a card")
  .addParam("contract", "The contract address")
  .addParam("cardindex", "Index of the card to play (0-5)")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    const { contract: contractAddress, cardindex } = taskArguments;
    const [signer] = await ethers.getSigners();

    const cardIndex = parseInt(cardindex);
    if (cardIndex < 0 || cardIndex > 5) {
      throw new Error("Card index must be between 0 and 5");
    }

    const contract = await ethers.getContractAt("EncryptedCardGame", contractAddress);

    console.log("Creating encrypted card index...");

    const input = fhevm.createEncryptedInput(contractAddress, signer.address);
    input.add8(cardIndex);
    const encryptedInput = await input.encrypt();

    console.log(`Playing card at index ${cardIndex}...`);

    const tx = await contract.connect(signer).playCard(
      encryptedInput.handles[0],
      encryptedInput.inputProof
    );

    await tx.wait();
    console.log("Card played successfully!");

    // Check game info
    const gameInfo = await contract.getGameInfo();
    console.log("Current round:", gameInfo.round.toString());
  });

task("game:info", "Get game information")
  .addParam("contract", "The contract address")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const { contract: contractAddress } = taskArguments;

    const contract = await ethers.getContractAt("EncryptedCardGame", contractAddress);

    const gameInfo = await contract.getGameInfo();
    
    console.log("=== Game Information ===");
    console.log("Game state:", gameInfo.state.toString(), getGameStateName(gameInfo.state));
    console.log("Players joined:", gameInfo.joined.toString());
    console.log("Current round:", gameInfo.round.toString());
    console.log("Player 1:", gameInfo.player1);
    console.log("Player 2:", gameInfo.player2);
  });

task("game:mycards", "View your cards (requires decryption)")
  .addParam("contract", "The contract address")
  .addParam("playerindex", "Your player index (0 or 1)")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    const { contract: contractAddress, playerindex } = taskArguments;
    const [signer] = await ethers.getSigners();

    const playerIndex = parseInt(playerindex);
    if (![0, 1].includes(playerIndex)) {
      throw new Error("Player index must be 0 or 1");
    }

    const contract = await ethers.getContractAt("EncryptedCardGame", contractAddress);

    console.log("Getting encrypted cards...");
    const [types, healths, aliveStatus] = await contract.connect(signer).getPlayerCards(playerIndex);

    console.log("Decrypting cards...");
    
    console.log("=== Your Cards ===");
    for (let i = 0; i < 6; i++) {
      const cardType = await fhevm.userDecryptEuint("euint8", types[i], contractAddress, signer);
      const cardHealth = await fhevm.userDecryptEuint("euint8", healths[i], contractAddress, signer);
      const isAlive = await fhevm.userDecryptEbool(aliveStatus[i], contractAddress, signer);
      
      const cardName = getCardName(Number(cardType));
      const status = isAlive ? "Alive" : "Dead";
      
      console.log(`Card ${i}: ${cardName} (${cardHealth} HP) - ${status}`);
    }

    // Get alive count
    const aliveCount = await contract.connect(signer).getAliveCount(playerIndex);
    const decryptedAliveCount = await fhevm.userDecryptEuint("euint8", aliveCount, contractAddress, signer);
    console.log(`\nAlive cards: ${decryptedAliveCount}`);
  });

task("game:battle", "Get battle result for a round")
  .addParam("contract", "The contract address")
  .addParam("round", "The round number")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    const { contract: contractAddress, round } = taskArguments;
    const [signer] = await ethers.getSigners();

    const roundNumber = parseInt(round);
    const contract = await ethers.getContractAt("EncryptedCardGame", contractAddress);

    console.log(`Getting battle result for round ${roundNumber}...`);
    
    const encryptedResult = await contract.getBattleResult(roundNumber);
    const result = await fhevm.userDecryptEuint("euint8", encryptedResult, contractAddress, signer);
    
    console.log("=== Battle Result ===");
    console.log("Round:", roundNumber);
    console.log("Result:", getBattleResultName(Number(result)));
  });

// Helper functions
function getGameStateName(state: any): string {
  const stateNum = Number(state);
  switch (stateNum) {
    case 0: return "(Waiting for players)";
    case 1: return "(Playing)";
    case 2: return "(Finished)";
    default: return "(Unknown)";
  }
}

function getCardName(cardType: number): string {
  switch (cardType) {
    case 0: return "Eagle";
    case 1: return "Bear";
    case 2: return "Snake";
    default: return "Unknown";
  }
}

function getBattleResultName(result: number): string {
  switch (result) {
    case 0: return "Draw";
    case 1: return "Player 1 wins";
    case 2: return "Player 2 wins";
    default: return "Unknown";
  }
}