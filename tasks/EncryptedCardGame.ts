import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with Encrypted Card Game Locally (--network localhost)
 * =================================================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the EncryptedCardGameV2 contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the Encrypted Card Game contract
 *
 *   npx hardhat --network localhost game:create
 *   npx hardhat --network localhost game:join --gameid 0 --cards "2,1,0,2,1,0"
 *   npx hardhat --network localhost game:info --gameid 0
 *   npx hardhat --network localhost game:play --gameid 0 --card 0
 *   npx hardhat --network localhost game:cards --gameid 0 --player 0
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the EncryptedCardGameV2 contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the Encrypted Card Game contract
 *
 *   npx hardhat --network sepolia game:create
 *   npx hardhat --network sepolia game:join --gameid 0 --cards "2,1,0,2,1,0"
 *   npx hardhat --network sepolia game:info --gameid 0
 *   npx hardhat --network sepolia game:play --gameid 0 --card 0
 *   npx hardhat --network sepolia game:cards --gameid 0 --player 0
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost game:address
 *   - npx hardhat --network sepolia game:address
 */
task("game:address", "Prints the EncryptedCardGameV2 address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const cardGame = await deployments.get("EncryptedCardGameV2");

  console.log("EncryptedCardGameV2 address is " + cardGame.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost game:create
 *   - npx hardhat --network sepolia game:create
 */
task("game:create", "Creates a new game")
  .addOptionalParam("address", "Optionally specify the EncryptedCardGameV2 contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const CardGameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedCardGameV2");
    console.log(`EncryptedCardGameV2: ${CardGameDeployment.address}`);

    const signers = await ethers.getSigners();
    const cardGameContract = await ethers.getContractAt("EncryptedCardGameV2", CardGameDeployment.address);

    const tx = await cardGameContract.connect(signers[0]).createGame();
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    // Parse the GameCreated event to get the gameId
    const gameCreatedEvent = receipt?.logs.find((log: any) => {
      try {
        const parsed = cardGameContract.interface.parseLog(log);
        return parsed?.name === "GameCreated";
      } catch {
        return false;
      }
    });

    if (gameCreatedEvent) {
      const parsed = cardGameContract.interface.parseLog(gameCreatedEvent);
      const gameId = parsed?.args.gameId;
      console.log(`Game created with ID: ${gameId}`);
    }

    console.log("Game creation succeeded!");
  });

/**
 * Example:
 *   - npx hardhat --network localhost game:join --gameid 0 --cards "2,1,0,2,1,0"
 *   - npx hardhat --network sepolia game:join --gameid 0 --cards "2,1,0,2,1,0"
 */
task("game:join", "Joins a game with encrypted cards")
  .addOptionalParam("address", "Optionally specify the EncryptedCardGameV2 contract address")
  .addParam("gameid", "The game ID to join")
  .addParam("cards", "Comma-separated list of 6 card types (0=Eagle, 1=Bear, 2=Snake)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId < 0) {
      throw new Error(`Argument --gameid is not a valid non-negative integer`);
    }

    const cardTypesStr = taskArguments.cards;
    const cardTypes = cardTypesStr.split(",").map((x: string) => parseInt(x.trim()));

    if (cardTypes.length !== 6) {
      throw new Error("Must provide exactly 6 card types");
    }

    for (const cardType of cardTypes) {
      if (!Number.isInteger(cardType) || cardType < 0 || cardType > 2) {
        throw new Error("Card types must be 0 (Eagle), 1 (Bear), or 2 (Snake)");
      }
    }

    await fhevm.initializeCLIApi();

    const CardGameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedCardGameV2");
    console.log(`EncryptedCardGameV2: ${CardGameDeployment.address}`);

    const signers = await ethers.getSigners();
    const cardGameContract = await ethers.getContractAt("EncryptedCardGameV2", CardGameDeployment.address);

    console.log(`Joining game ${gameId} with card types: ${cardTypes.join(", ")}`);

    // Encrypt the card types
    const encryptedInput = fhevm.createEncryptedInput(CardGameDeployment.address, signers[0].address);
    for (const cardType of cardTypes) {
      encryptedInput.add8(cardType);
    }
    const encryptedCards = await encryptedInput.encrypt();

    const tx = await cardGameContract
      .connect(signers[0])
      .joinGame(gameId, encryptedCards.handles, encryptedCards.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Successfully joined game ${gameId}!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost game:play --gameid 0 --card 0
 *   - npx hardhat --network sepolia game:play --gameid 0 --card 0
 */
task("game:play", "Plays a card in the current round")
  .addOptionalParam("address", "Optionally specify the EncryptedCardGameV2 contract address")
  .addParam("gameid", "The game ID")
  .addParam("card", "The card index to play (0-5)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId < 0) {
      throw new Error(`Argument --gameid is not a valid non-negative integer`);
    }

    const cardIndex = parseInt(taskArguments.card);
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex > 5) {
      throw new Error(`Argument --card must be between 0 and 5`);
    }

    const CardGameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedCardGameV2");
    console.log(`EncryptedCardGameV2: ${CardGameDeployment.address}`);

    const signers = await ethers.getSigners();
    const cardGameContract = await ethers.getContractAt("EncryptedCardGameV2", CardGameDeployment.address);

    console.log(`Playing card ${cardIndex} in game ${gameId}`);

    const tx = await cardGameContract.connect(signers[0]).playCard(gameId, cardIndex);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Successfully played card ${cardIndex} in game ${gameId}!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost game:info --gameid 0
 *   - npx hardhat --network sepolia game:info --gameid 0
 */
task("game:info", "Gets information about a game")
  .addOptionalParam("address", "Optionally specify the EncryptedCardGameV2 contract address")
  .addParam("gameid", "The game ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId < 0) {
      throw new Error(`Argument --gameid is not a valid non-negative integer`);
    }

    const CardGameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedCardGameV2");
    console.log(`EncryptedCardGameV2: ${CardGameDeployment.address}`);

    const signers = await ethers.getSigners();
    const cardGameContract = await ethers.getContractAt("EncryptedCardGameV2", CardGameDeployment.address);

    try {
      const gameInfo = await cardGameContract.getGameInfo(gameId);

      const stateNames = ["Waiting", "Playing", "Finished"];

      console.log(`Game ${gameId} Information:`);
      console.log(`- State: ${stateNames[gameInfo.state]}`);
      console.log(`- Round: ${gameInfo.round}`);
      console.log(`- Players Joined: ${gameInfo.joined}/2`);
      console.log(`- Player 1: ${gameInfo.player1}`);
      console.log(`- Player 2: ${gameInfo.player2}`);
    } catch (error) {
      console.error(`Error getting game info: ${error}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost game:cards --gameid 0 --player 0
 *   - npx hardhat --network sepolia game:cards --gameid 0 --player 0
 */
task("game:cards", "Gets player's cards in a game (requires decryption)")
  .addOptionalParam("address", "Optionally specify the EncryptedCardGameV2 contract address")
  .addParam("gameid", "The game ID")
  .addParam("player", "The player index (0 or 1)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const gameId = parseInt(taskArguments.gameid);
    if (!Number.isInteger(gameId) || gameId < 0) {
      throw new Error(`Argument --gameid is not a valid non-negative integer`);
    }

    const playerIndex = parseInt(taskArguments.player);
    if (!Number.isInteger(playerIndex) || (playerIndex !== 0 && playerIndex !== 1)) {
      throw new Error(`Argument --player must be 0 or 1`);
    }

    await fhevm.initializeCLIApi();

    const CardGameDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedCardGameV2");
    console.log(`EncryptedCardGameV2: ${CardGameDeployment.address}`);

    const signers = await ethers.getSigners();
    const cardGameContract = await ethers.getContractAt("EncryptedCardGameV2", CardGameDeployment.address);

    try {
      const playerCards = await cardGameContract.getPlayerCards(gameId, playerIndex);

      console.log(`Player ${playerIndex} Cards in Game ${gameId}:`);

      const cardTypeNames = ["Eagle", "Bear", "Snake"];

      for (let i = 0; i < 6; i++) {
        // Decrypt the card type
        let cardTypeName = "Unknown";
        try {
          if (playerCards.types[i] !== ethers.ZeroHash) {
            const decryptedType = await fhevm.userDecryptEuint(
              FhevmType.euint8,
              playerCards.types[i],
              CardGameDeployment.address,
              signers[0],
            );
            cardTypeName = cardTypeNames[decryptedType] || `Unknown(${decryptedType})`;
          }
        } catch (decryptError) {
          console.log(`Cannot decrypt card ${i} type: ${decryptError}`);
        }

        console.log(`- Card ${i}: ${cardTypeName}, Health: ${playerCards.healths[i]}, Alive: ${playerCards.aliveStatus[i]}`);
      }

      const aliveCount = await cardGameContract.getAliveCount(gameId, playerIndex);
      console.log(`Total Alive Cards: ${aliveCount}`);
    } catch (error) {
      console.error(`Error getting player cards: ${error}`);
    }
  });