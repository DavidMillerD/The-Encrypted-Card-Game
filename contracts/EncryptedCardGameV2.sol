// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedCardGameV2 is SepoliaConfig {
    enum GameState { Waiting, Playing, Finished }

    struct Card {
        euint8 cardType; // 0: Eagle, 1: Bear, 2: Snake (encrypted)
        uint8 health;    // Health points (always 2)
        bool isAlive;    // Whether card is alive (not encrypted)
    }

    struct Game {
        GameState state;
        address[2] players;
        uint8 playersJoined;
        uint8 currentRound;
        Card[6][2] cards; // [cardIndex][playerIndex]
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
        require(
            msg.sender == game.players[0] || msg.sender == game.players[1],
            "Not a player in this game"
        );
        _;
    }

    modifier onlyInGameState(uint256 gameId, GameState _state) {
        require(games[gameId].state == _state, "Invalid game state");
        _;
    }

    function createGame() external returns (uint256) {
        require(
            playerToGame[msg.sender] == 0 ||
            games[playerToGame[msg.sender]].state == GameState.Finished,
            "Already in a game"
        );

        uint256 gameId = nextGameId++;
        Game storage newGame = games[gameId];
        newGame.state = GameState.Waiting;
        newGame.playersJoined = 0;
        newGame.currentRound = 0;

        playerToGame[msg.sender] = gameId;
        emit GameCreated(gameId, msg.sender);
        return gameId;
    }

    function joinGame(
        uint256 gameId,
        externalEuint8[6] calldata encryptedCardTypes,
        bytes calldata inputProof
    ) external gameExists(gameId) onlyInGameState(gameId, GameState.Waiting) {
        Game storage game = games[gameId];
        require(game.playersJoined < 2, "Game is full");
        require(
            game.players[0] != msg.sender && game.players[1] != msg.sender,
            "Already joined this game"
        );
        require(
            playerToGame[msg.sender] == 0 ||
            games[playerToGame[msg.sender]].state == GameState.Finished,
            "Already in another game"
        );

        uint8 playerIndex = game.playersJoined;
        require(playerIndex < 2, "Player index out of bounds");
        game.players[playerIndex] = msg.sender;
        game.aliveCount[playerIndex] = 6;
        playerToGame[msg.sender] = gameId;

        // Initialize player's cards
        for (uint8 i = 0; i < 6; i++) {
            // Debug: Check if we can access the encrypted card type
            require(i < encryptedCardTypes.length, "Card type index out of bounds");
            euint8 cardType = FHE.fromExternal(encryptedCardTypes[i], inputProof);

            // Validate card type (0, 1, or 2)
            ebool validType1 = FHE.eq(cardType, 0);
            ebool validType2 = FHE.eq(cardType, 1);
            ebool validType3 = FHE.eq(cardType, 2);
            ebool isValidType = FHE.or(FHE.or(validType1, validType2), validType3);

            game.cards[i][playerIndex] = Card({
                cardType: FHE.select(isValidType, cardType, FHE.asEuint8(0)),
                health: 2, // All cards have health 2
                isAlive: true
            });

            // Set ACL permissions
            FHE.allowThis(game.cards[i][playerIndex].cardType);
            FHE.allow(game.cards[i][playerIndex].cardType, msg.sender);
        }

        game.playersJoined++;
        emit PlayerJoined(gameId, msg.sender, playerIndex);

        if (game.playersJoined == 2) {
            game.state = GameState.Playing;
            emit GameStarted(gameId);
        }
    }

    function playCard(
        uint256 gameId,
        uint8 cardIndex
    ) external gameExists(gameId) onlyGamePlayer(gameId) onlyInGameState(gameId, GameState.Playing) {
        Game storage game = games[gameId];
        uint8 playerIndex = (msg.sender == game.players[0]) ? 0 : 1;

        require(cardIndex < 6, "Invalid card index");
        require(game.cards[cardIndex][playerIndex].isAlive, "Card is dead");
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
        euint8 card1Type = game.cards[card1Index][0].cardType;
        euint8 card2Type = game.cards[card2Index][1].cardType;

        // Calculate battle result directly without intermediate variables
        // Player 1 wins conditions: Eagle(0) > Snake(2), Bear(1) > Eagle(0), Snake(2) > Bear(1)
        ebool player1Wins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(card1Type, 0), FHE.eq(card2Type, 2)), // Eagle vs Snake
                FHE.and(FHE.eq(card1Type, 1), FHE.eq(card2Type, 0))  // Bear vs Eagle
            ),
            FHE.and(FHE.eq(card1Type, 2), FHE.eq(card2Type, 1))      // Snake vs Bear
        );

        // Player 2 wins conditions: same logic but swapped
        ebool player2Wins = FHE.or(
            FHE.or(
                FHE.and(FHE.eq(card2Type, 0), FHE.eq(card1Type, 2)), // Eagle vs Snake
                FHE.and(FHE.eq(card2Type, 1), FHE.eq(card1Type, 0))  // Bear vs Eagle
            ),
            FHE.and(FHE.eq(card2Type, 2), FHE.eq(card1Type, 1))      // Snake vs Bear
        );

        // For simplicity, both cards take damage in this version
        // In production, you'd use the decryption oracle to properly resolve battles
        game.cards[card1Index][0].isAlive = false;
        game.cards[card2Index][1].isAlive = false;
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
    function getGameInfo(uint256 gameId) external view gameExists(gameId) returns (
        GameState state,
        uint8 round,
        uint8 joined,
        address player1,
        address player2
    ) {
        Game storage game = games[gameId];
        return (
            game.state,
            game.currentRound,
            game.playersJoined,
            game.players[0],
            game.players[1]
        );
    }

    function getPlayerCards(uint256 gameId, uint8 playerIndex) external view gameExists(gameId) returns (
        euint8[6] memory types,
        uint8[6] memory healths,
        bool[6] memory aliveStatus
    ) {
        require(playerIndex < 2, "Invalid player index");
        Game storage game = games[gameId];
        require(msg.sender == game.players[playerIndex], "Not authorized");

        for (uint8 i = 0; i < 6; i++) {
            types[i] = game.cards[i][playerIndex].cardType;
            healths[i] = game.cards[i][playerIndex].health;
            aliveStatus[i] = game.cards[i][playerIndex].isAlive;
        }
    }

    function getAliveCount(uint256 gameId, uint8 playerIndex) external view gameExists(gameId) returns (uint8) {
        require(playerIndex < 2, "Invalid player index");
        Game storage game = games[gameId];
        require(msg.sender == game.players[playerIndex], "Not authorized");

        return game.aliveCount[playerIndex];
    }
}