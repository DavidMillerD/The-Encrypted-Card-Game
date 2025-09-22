import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedCardGameV2, EncryptedCardGameV2__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

enum CardType {
  Eagle = 0,
  Bear = 1,
  Snake = 2
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedCardGameV2")) as EncryptedCardGameV2__factory;
  const gameContract = (await factory.deploy()) as EncryptedCardGameV2;
  const gameContractAddress = await gameContract.getAddress();

  return { gameContract, gameContractAddress };
}

async function createEncryptedCards(
  contractAddress: string,
  userAddress: string,
  cardTypes: number[],
  cardHealths: number[]
) {
  const input = fhevm.createEncryptedInput(contractAddress, userAddress);
  
  // Add card types
  for (const cardType of cardTypes) {
    input.add8(cardType);
  }
  
  // Add card healths
  for (const cardHealth of cardHealths) {
    input.add8(cardHealth);
  }
  
  return await input.encrypt();
}

describe("EncryptedCardGame", function () {
  let signers: Signers;
  let gameContract: EncryptedCardGame;
  let gameContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ gameContract, gameContractAddress } = await deployFixture());
  });

  it("should initialize game correctly", async function () {
    const gameInfo = await gameContract.getGameInfo();
    expect(gameInfo.state).to.eq(0); // Waiting state
    expect(gameInfo.round).to.eq(0);
    expect(gameInfo.joined).to.eq(0);
    expect(gameInfo.player1).to.eq(ethers.ZeroAddress);
    expect(gameInfo.player2).to.eq(ethers.ZeroAddress);
  });

  it("should allow first player to join", async function () {
    // Alice's deck: 2 Eagles(3hp), 2 Bears(4hp), 2 Snakes(5hp)
    const aliceCardTypes = [CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear, CardType.Snake, CardType.Snake];
    const aliceCardHealths = [3, 3, 4, 4, 5, 5];

    const encryptedCards = await createEncryptedCards(
      gameContractAddress,
      signers.alice.address,
      aliceCardTypes,
      aliceCardHealths
    );

    const cardTypeHandles = encryptedCards.handles.slice(0, 6);
    const cardHealthHandles = encryptedCards.handles.slice(6, 12);

    const tx = await gameContract
      .connect(signers.alice)
      .joinGame(cardTypeHandles, cardHealthHandles, encryptedCards.inputProof);
    
    await expect(tx).to.emit(gameContract, "PlayerJoined").withArgs(signers.alice.address, 0);

    const gameInfo = await gameContract.getGameInfo();
    expect(gameInfo.joined).to.eq(1);
    expect(gameInfo.player1).to.eq(signers.alice.address);
  });

  it("should allow second player to join and start game", async function () {
    // Alice joins first
    const aliceCardTypes = [CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear, CardType.Snake, CardType.Snake];
    const aliceCardHealths = [3, 3, 4, 4, 5, 5];

    const aliceEncryptedCards = await createEncryptedCards(
      gameContractAddress,
      signers.alice.address,
      aliceCardTypes,
      aliceCardHealths
    );

    await gameContract
      .connect(signers.alice)
      .joinGame(
        aliceEncryptedCards.handles.slice(0, 6),
        aliceEncryptedCards.handles.slice(6, 12),
        aliceEncryptedCards.inputProof
      );

    // Bob joins second
    const bobCardTypes = [CardType.Snake, CardType.Snake, CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear];
    const bobCardHealths = [2, 2, 3, 3, 4, 4];

    const bobEncryptedCards = await createEncryptedCards(
      gameContractAddress,
      signers.bob.address,
      bobCardTypes,
      bobCardHealths
    );

    const tx = await gameContract
      .connect(signers.bob)
      .joinGame(
        bobEncryptedCards.handles.slice(0, 6),
        bobEncryptedCards.handles.slice(6, 12),
        bobEncryptedCards.inputProof
      );
    
    await expect(tx).to.emit(gameContract, "PlayerJoined").withArgs(signers.bob.address, 1);
    await expect(tx).to.emit(gameContract, "GameStarted");

    const gameInfo = await gameContract.getGameInfo();
    expect(gameInfo.state).to.eq(1); // Playing state
    expect(gameInfo.joined).to.eq(2);
    expect(gameInfo.player2).to.eq(signers.bob.address);
  });

  it("should not allow third player to join", async function () {
    // Setup game with Alice and Bob - use setupGame helper which resets game state
    await setupGame();

    // Try to join with deployer (third player) - game should now be in Playing state
    const thirdPlayerCards = await createEncryptedCards(
      gameContractAddress,
      signers.deployer.address,
      [CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear, CardType.Snake, CardType.Snake],
      [3, 3, 4, 4, 5, 5]
    );

    await expect(
      gameContract
        .connect(signers.deployer)
        .joinGame(
          thirdPlayerCards.handles.slice(0, 6),
          thirdPlayerCards.handles.slice(6, 12),
          thirdPlayerCards.inputProof
        )
    ).to.be.revertedWith("Invalid game state");
  });

  it("should allow players to play cards", async function () {
    // Setup game
    await setupGame();

    // Alice plays card at index 0 (Eagle with 3 hp)
    const aliceCardIndex = await fhevm
      .createEncryptedInput(gameContractAddress, signers.alice.address)
      .add8(0)
      .encrypt();

    const tx1 = await gameContract
      .connect(signers.alice)
      .playCard(aliceCardIndex.handles[0], aliceCardIndex.inputProof);
    
    await expect(tx1).to.emit(gameContract, "CardPlayed").withArgs(signers.alice.address, 0);

    // Bob plays card at index 0 (Snake with 2 hp)
    const bobCardIndex = await fhevm
      .createEncryptedInput(gameContractAddress, signers.bob.address)
      .add8(0)
      .encrypt();

    const tx2 = await gameContract
      .connect(signers.bob)
      .playCard(bobCardIndex.handles[0], bobCardIndex.inputProof);
    
    await expect(tx2).to.emit(gameContract, "CardPlayed").withArgs(signers.bob.address, 0);
    await expect(tx2).to.emit(gameContract, "BattleResult");
  });

  it("should handle battle resolution correctly", async function () {
    await setupGame();

    // Alice plays Eagle (index 0), Bob plays Snake (index 0)
    // Eagle should beat Snake
    await playRound(0, 0);

    const gameInfo = await gameContract.getGameInfo();
    expect(gameInfo.round).to.eq(1);

    // Check battle result
    const battleResult = await gameContract.getBattleResult(0);
    const decryptedResult = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      battleResult,
      gameContractAddress,
      signers.alice
    );
    
    // Result should be 1 (player 1 wins) since Eagle beats Snake
    expect(decryptedResult).to.eq(1);
  });

  it("should track alive card counts correctly", async function () {
    await setupGame();

    // Play first round - Alice's Eagle vs Bob's Snake
    await playRound(0, 0);

    // Check Alice's alive count (should still be 6)
    const aliceAliveCount = await gameContract.connect(signers.alice).getAliveCount(0);
    const decryptedAliceCount = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      aliceAliveCount,
      gameContractAddress,
      signers.alice
    );
    expect(decryptedAliceCount).to.eq(6);

    // Check Bob's alive count (should be 5 now)
    const bobAliveCount = await gameContract.connect(signers.bob).getAliveCount(1);
    const decryptedBobCount = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      bobAliveCount,
      gameContractAddress,
      signers.bob
    );
    expect(decryptedBobCount).to.eq(5);
  });

  it("should allow player to view their own cards", async function () {
    await setupGame();

    // Alice should be able to view her cards
    const [types, healths, aliveStatus] = await gameContract.connect(signers.alice).getPlayerCards(0);
    
    expect(types.length).to.eq(6);
    expect(healths.length).to.eq(6);
    expect(aliveStatus.length).to.eq(6);

    // Decrypt first card type (should be Eagle = 0)
    const firstCardType = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      types[0],
      gameContractAddress,
      signers.alice
    );
    expect(firstCardType).to.eq(CardType.Eagle);

    // Decrypt first card health (should be 3)
    const firstCardHealth = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      healths[0],
      gameContractAddress,
      signers.alice
    );
    expect(firstCardHealth).to.eq(3);
  });

  it("should not allow unauthorized access to player cards", async function () {
    await setupGame();

    // Bob should not be able to view Alice's cards
    await expect(gameContract.connect(signers.bob).getPlayerCards(0))
      .to.be.revertedWith("Not authorized");

    // Alice should not be able to view Bob's cards
    await expect(gameContract.connect(signers.alice).getPlayerCards(1))
      .to.be.revertedWith("Not authorized");
  });

  // Helper function to setup a complete game
  async function setupGame() {
    // Alice's deck: 2 Eagles(3hp), 2 Bears(4hp), 2 Snakes(5hp)
    const aliceCardTypes = [CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear, CardType.Snake, CardType.Snake];
    const aliceCardHealths = [3, 3, 4, 4, 5, 5];

    const aliceEncryptedCards = await createEncryptedCards(
      gameContractAddress,
      signers.alice.address,
      aliceCardTypes,
      aliceCardHealths
    );

    await gameContract
      .connect(signers.alice)
      .joinGame(
        aliceEncryptedCards.handles.slice(0, 6),
        aliceEncryptedCards.handles.slice(6, 12),
        aliceEncryptedCards.inputProof
      );

    // Bob's deck: 2 Snakes(2hp), 2 Eagles(3hp), 2 Bears(4hp)
    const bobCardTypes = [CardType.Snake, CardType.Snake, CardType.Eagle, CardType.Eagle, CardType.Bear, CardType.Bear];
    const bobCardHealths = [2, 2, 3, 3, 4, 4];

    const bobEncryptedCards = await createEncryptedCards(
      gameContractAddress,
      signers.bob.address,
      bobCardTypes,
      bobCardHealths
    );

    await gameContract
      .connect(signers.bob)
      .joinGame(
        bobEncryptedCards.handles.slice(0, 6),
        bobEncryptedCards.handles.slice(6, 12),
        bobEncryptedCards.inputProof
      );
  }

  // Helper function to play a round
  async function playRound(aliceCardIndex: number, bobCardIndex: number) {
    const aliceCardIndexEncrypted = await fhevm
      .createEncryptedInput(gameContractAddress, signers.alice.address)
      .add8(aliceCardIndex)
      .encrypt();

    const bobCardIndexEncrypted = await fhevm
      .createEncryptedInput(gameContractAddress, signers.bob.address)
      .add8(bobCardIndex)
      .encrypt();

    await gameContract
      .connect(signers.alice)
      .playCard(aliceCardIndexEncrypted.handles[0], aliceCardIndexEncrypted.inputProof);

    await gameContract
      .connect(signers.bob)
      .playCard(bobCardIndexEncrypted.handles[0], bobCardIndexEncrypted.inputProof);
  }
});