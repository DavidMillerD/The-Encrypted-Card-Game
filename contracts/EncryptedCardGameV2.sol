// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "hardhat/console.sol";

contract EncryptedCardGameV2 is SepoliaConfig {
    enum GameState {
        Waiting,
        Playing,
        Finished
    }

    struct Card {
        euint8 cardType; // 0: Eagle, 1: Bear, 2: Snake (encrypted)
        uint8 health; // Health points (always 2)
        bool isAlive; // Whether card is alive (not encrypted)
    }

    struct Game {
        GameState state;
        address[2] players;
        uint8 playersJoined;
        uint8 currentRound;
        Card[6][2] cards; // [playerIndex][cardIndex]
        uint8[2] aliveCount;
        uint8[2] currentPlayedCards;
        bool[2] hasPlayedCard;
        address winner;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) public games;
    mapping(address => uint256) public playerToGame;

    event GameCreated(uint256 indexed gameId, address indexed creator);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 playerIndex);
    event GameStarted(uint256 indexed gameId);
    event CardPlayed(uint256 indexed gameId, address indexed player, uint8 cardIndex);
    event GameEnded(uint256 indexed gameId, address winner);

    modifier gameExists(uint256 gameId) {
        require(gameId < nextGameId, "Game does not exist");
        _;
    }

    modifier onlyGamePlayer(uint256 gameId) {
        Game storage game = games[gameId];
        require(msg.sender == game.players[0] || msg.sender == game.players[1], "Not a player in this game");
        _;
    }

    modifier onlyInGameState(uint256 gameId, GameState _state) {
        require(games[gameId].state == _state, "Invalid game state");
        _;
    }

    function createGame() external returns (uint256) {
        require(
            playerToGame[msg.sender] == 0 || games[playerToGame[msg.sender]].state == GameState.Finished,
            "Already in a game"
        );

        uint256 gameId = nextGameId++;
        Game storage newGame = games[gameId];
        newGame.state = GameState.Waiting;
        newGame.playersJoined = 0;
        newGame.currentRound = 0;

        // Don't set playerToGame here, let them join like any other player
        emit GameCreated(gameId, msg.sender);
        return gameId;
    }

    function joinGame(
        uint256 gameId,
        externalEuint8[6] calldata encryptedCardTypes,
        bytes calldata inputProof
    ) external gameExists(gameId) onlyInGameState(gameId, GameState.Waiting) {
        console.log("=== joinGame START ===");
        console.log("gameId:", gameId);
        console.log("msg.sender:", msg.sender);

        Game storage game = games[gameId];
        console.log("Game current state:", uint(game.state));
        console.log("Players joined:", game.playersJoined);

        // Check 1: Game is not full
        console.log("Check 1: Game not full");
        if (game.playersJoined >= 2) {
            console.log("ERROR: Game is full, playersJoined =", game.playersJoined);
            require(false, "Game is full");
        }
        console.log("Game not full - OK");

        // Check 2: Player not already in this game
        console.log("Check 2: Player not already in this game");
        console.log("game.players[0]:", game.players[0]);
        console.log("game.players[1]:", game.players[1]);
        if (game.players[0] == msg.sender || game.players[1] == msg.sender) {
            console.log("ERROR: Already joined this game");
            require(false, "Already joined this game");
        }
        console.log("Player not already in this game - OK");

        // Check 3: Player not in another active game
        console.log("Check 3: Player not in another active game");
        uint256 currentGameId = playerToGame[msg.sender];
        console.log("playerToGame[msg.sender]:", currentGameId);
        if (currentGameId != 0) {
            console.log("Player has previous game, state:", uint(games[currentGameId].state));
            if (games[currentGameId].state != GameState.Finished) {
                console.log("ERROR: Already in another active game");
                require(false, "Already in another game");
            }
        }
        console.log("Player not in another active game - OK");

        uint8 playerIndex = game.playersJoined;
        console.log("playerIndex will be:", playerIndex);
        if (playerIndex >= 2) {
            console.log("ERROR: Player index out of bounds");
            require(false, "Player index out of bounds");
        }
        console.log("Player index valid - OK");

        console.log("=== Setting player data ===");
        // Set player data
        game.players[playerIndex] = msg.sender;
        game.aliveCount[playerIndex] = 6;
        playerToGame[msg.sender] = gameId;
        console.log("Player data set - playerIndex:", playerIndex, "address:", msg.sender);

        // Initialize player's cards
        console.log("=== Initializing cards ===");
        console.log("encryptedCardTypes.length:", encryptedCardTypes.length);

        for (uint8 i = 0; i < 6; i++) {
            console.log("Processing card", i);

            // Check array bounds
            if (i >= encryptedCardTypes.length) {
                console.log("ERROR: Card type index out of bounds, i:", i, "length:", encryptedCardTypes.length);
                require(false, "Card type index out of bounds");
            }

            console.log("Converting external encrypted input for card", i);
            // Convert external encrypted input
            euint8 cardType = FHE.fromExternal(encryptedCardTypes[i], inputProof);
            console.log("FHE.fromExternal successful for card", i);

            console.log("Validating card type for card", i);
            // Validate card type (0, 1, or 2)
            ebool validType1 = FHE.eq(cardType, 0);
            ebool validType2 = FHE.eq(cardType, 1);
            ebool validType3 = FHE.eq(cardType, 2);
            ebool isValidType = FHE.or(FHE.or(validType1, validType2), validType3);
            console.log("Card type validation complete for card", i);

            console.log("Storing card data for card", i);
            // Store card
            game.cards[playerIndex][i] = Card({
                cardType: FHE.select(isValidType, cardType, FHE.asEuint8(0)),
                health: 2, // All cards have health 2
                isAlive: true
            });
            console.log("Card data stored for card", i);

            console.log("Setting ACL permissions for card", i);
            // Set ACL permissions
            FHE.allowThis(game.cards[playerIndex][i].cardType);
            FHE.allow(game.cards[playerIndex][i].cardType, msg.sender);
            console.log("ACL permissions set for card", i);

            console.log("Card", i, "processing complete");
        }

        console.log("=== All cards processed ===");

        // Increment players joined count
        console.log("Incrementing playersJoined from", game.playersJoined, "to", game.playersJoined + 1);
        game.playersJoined++;
        console.log("New playersJoined count:", game.playersJoined);
        emit PlayerJoined(gameId, msg.sender, playerIndex);

        // Check if game should start
        console.log("Checking if game should start");
        if (game.playersJoined == 2) {
            console.log("Starting game - 2 players joined");
            game.state = GameState.Playing;
            emit GameStarted(gameId);
            console.log("Game started - OK");
        } else {
            console.log("Game not started yet, waiting for more players");
        }

        console.log("=== joinGame COMPLETE ===");
        console.log("Final game state:", uint(game.state));
        console.log("Final playersJoined:", game.playersJoined);
    }

    function playCard(
        uint256 gameId,
        uint8 cardIndex
    ) external gameExists(gameId) onlyGamePlayer(gameId) onlyInGameState(gameId, GameState.Playing) {
        Game storage game = games[gameId];
        uint8 playerIndex = (msg.sender == game.players[0]) ? 0 : 1;

        require(cardIndex < 6, "Invalid card index");
        require(game.cards[playerIndex][cardIndex].isAlive, "Card is dead");
        require(!game.hasPlayedCard[playerIndex], "Already played this round");

        game.currentPlayedCards[playerIndex] = cardIndex;
        game.hasPlayedCard[playerIndex] = true;

        emit CardPlayed(gameId, msg.sender, cardIndex);

        // If both players have played, process battle
        if (game.hasPlayedCard[0] && game.hasPlayedCard[1]) {
            processBattle(gameId);
        }
    }

    function processBattle(uint256 gameId) internal {
        Game storage game = games[gameId];

        uint8 card1Index = game.currentPlayedCards[0];
        uint8 card2Index = game.currentPlayedCards[1];

        // Get card types (encrypted)
        euint8 card1Type = game.cards[0][card1Index].cardType;
        euint8 card2Type = game.cards[1][card2Index].cardType;

        // Calculate battle result directly without intermediate variables
        // Player 1 wins conditions: Eagle(0) > Snake(2), Bear(1) > Eagle(0), Snake(2) > Bear(1)
        ebool player1Wins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(card1Type, 0), FHE.eq(card2Type, 2)), // Eagle vs Snake
                FHE.and(FHE.eq(card1Type, 1), FHE.eq(card2Type, 0)) // Bear vs Eagle
            ),
            FHE.and(FHE.eq(card1Type, 2), FHE.eq(card2Type, 1)) // Snake vs Bear
        );

        // Player 2 wins conditions: same logic but swapped
        ebool player2Wins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(card2Type, 0), FHE.eq(card1Type, 2)), // Eagle vs Snake
                FHE.and(FHE.eq(card2Type, 1), FHE.eq(card1Type, 0)) // Bear vs Eagle
            ),
            FHE.and(FHE.eq(card2Type, 2), FHE.eq(card1Type, 1)) // Snake vs Bear
        );

        // For simplicity, both cards take damage in this version
        // In production, you'd use the decryption oracle to properly resolve battles
        game.cards[0][card1Index].isAlive = false;
        game.cards[1][card2Index].isAlive = false;
        game.aliveCount[0]--;
        game.aliveCount[1]--;

        // Reset for next round
        game.hasPlayedCard[0] = false;
        game.hasPlayedCard[1] = false;
        game.currentRound++;

        // Check if game is over
        if (game.aliveCount[0] == 0 || game.aliveCount[1] == 0) {
            game.state = GameState.Finished;
            if (game.aliveCount[0] > game.aliveCount[1]) {
                game.winner = game.players[0];
            } else if (game.aliveCount[1] > game.aliveCount[0]) {
                game.winner = game.players[1];
            } // No winner if both have 0 cards

            emit GameEnded(gameId, game.winner);
        }
    }

    // View functions
    function getGameInfo(
        uint256 gameId
    )
        external
        view
        gameExists(gameId)
        returns (GameState state, uint8 round, uint8 joined, address player1, address player2)
    {
        Game storage game = games[gameId];
        return (game.state, game.currentRound, game.playersJoined, game.players[0], game.players[1]);
    }

    function getPlayerCards(
        uint256 gameId,
        uint8 playerIndex
    )
        external
        view
        gameExists(gameId)
        returns (euint8[6] memory types, uint8[6] memory healths, bool[6] memory aliveStatus)
    {
        require(playerIndex < 2, "Invalid player index");
        Game storage game = games[gameId];

        for (uint8 i = 0; i < 6; i++) {
            types[i] = game.cards[playerIndex][i].cardType;
            healths[i] = game.cards[playerIndex][i].health;
            aliveStatus[i] = game.cards[playerIndex][i].isAlive;
        }
    }

    function getAliveCount(uint256 gameId, uint8 playerIndex) external view gameExists(gameId) returns (uint8) {
        require(playerIndex < 2, "Invalid player index");
        Game storage game = games[gameId];

        return game.aliveCount[playerIndex];
    }
}
