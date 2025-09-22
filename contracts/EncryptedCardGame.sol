// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedCardGame is SepoliaConfig {
    enum GameState { Waiting, Playing, Finished }
    enum CardType { Eagle, Bear, Snake }
    
    struct Card {
        euint8 cardType; // 0: Eagle, 1: Bear, 2: Snake
        euint8 health;   // Health points
        ebool isAlive;   // Whether card is alive
    }
    
    struct Player {
        address playerAddress;
        Card[6] cards;
        euint8 aliveCount;
        bool hasJoined;
    }
    
    GameState public gameState;
    Player[2] public players;
    uint8 public playersJoined;
    uint8 public currentRound;
    
    euint8[2] public currentPlayedCards; // Indexes of cards played this round
    bool[2] public hasPlayedCard; // Track if player has played card this round
    euint8[2] public battleResults; // 0: draw, 1: player0 wins, 2: player1 wins
    
    event PlayerJoined(address indexed player, uint8 playerIndex);
    event GameStarted();
    event CardPlayed(address indexed player, uint8 round);
    event BattleResult(uint8 round, uint8 winner);
    event GameEnded(address winner);
    
    modifier onlyValidPlayer() {
        require(msg.sender == players[0].playerAddress || msg.sender == players[1].playerAddress, "Not a valid player");
        _;
    }
    
    modifier onlyInState(GameState _state) {
        require(gameState == _state, "Invalid game state");
        _;
    }
    
    constructor() {
        gameState = GameState.Waiting;
        playersJoined = 0;
        currentRound = 0;
    }
    
    function joinGame(
        externalEuint8[6] calldata encryptedCardTypes,
        externalEuint8[6] calldata encryptedCardHealth,
        bytes calldata inputProof
    ) external onlyInState(GameState.Waiting) {
        require(playersJoined < 2, "Game is full");
        require(!players[0].hasJoined || players[0].playerAddress != msg.sender, "Player already joined");
        require(!players[1].hasJoined || players[1].playerAddress != msg.sender, "Player already joined");
        
        uint8 playerIndex = playersJoined;
        players[playerIndex].playerAddress = msg.sender;
        players[playerIndex].hasJoined = true;
        players[playerIndex].aliveCount = FHE.asEuint8(6);
        
        // Initialize player's cards
        for (uint8 i = 0; i < 6; i++) {
            euint8 cardType = FHE.fromExternal(encryptedCardTypes[i], inputProof);
            euint8 health = FHE.fromExternal(encryptedCardHealth[i], inputProof);
            
            // Validate card type (0, 1, or 2)
            ebool validType1 = FHE.eq(cardType, 0);
            ebool validType2 = FHE.eq(cardType, 1);
            ebool validType3 = FHE.eq(cardType, 2);
            ebool isValidType = FHE.or(FHE.or(validType1, validType2), validType3);
            
            // Validate health (1-10)
            ebool validHealth = FHE.and(FHE.ge(health, 1), FHE.le(health, 10));
            
            players[playerIndex].cards[i] = Card({
                cardType: FHE.select(FHE.and(isValidType, validHealth), cardType, FHE.asEuint8(0)),
                health: FHE.select(FHE.and(isValidType, validHealth), health, FHE.asEuint8(1)),
                isAlive: FHE.asEbool(true)
            });
            
            // Set ACL permissions
            FHE.allowThis(players[playerIndex].cards[i].cardType);
            FHE.allowThis(players[playerIndex].cards[i].health);
            FHE.allowThis(players[playerIndex].cards[i].isAlive);
            FHE.allow(players[playerIndex].cards[i].cardType, msg.sender);
            FHE.allow(players[playerIndex].cards[i].health, msg.sender);
            FHE.allow(players[playerIndex].cards[i].isAlive, msg.sender);
        }
        
        // Set ACL for alive count
        FHE.allowThis(players[playerIndex].aliveCount);
        FHE.allow(players[playerIndex].aliveCount, msg.sender);
        
        playersJoined++;
        emit PlayerJoined(msg.sender, playerIndex);
        
        if (playersJoined == 2) {
            gameState = GameState.Playing;
            emit GameStarted();
        }
    }
    
    function playCard(
        externalEuint8 encryptedCardIndex,
        bytes calldata inputProof
    ) external onlyValidPlayer onlyInState(GameState.Playing) {
        uint8 playerIndex = (msg.sender == players[0].playerAddress) ? 0 : 1;
        
        euint8 cardIndex = FHE.fromExternal(encryptedCardIndex, inputProof);
        
        // Validate card index (0-5)
        ebool validIndex = FHE.le(cardIndex, 5);

        // Check if the selected card is alive
        ebool cardIsAlive = getCardAliveByIndex(playerIndex, cardIndex);
        ebool canPlayCard = FHE.and(validIndex, cardIsAlive);

        // If card is not playable, default to first card (for safety)
        euint8 safeIndex = FHE.select(canPlayCard, cardIndex, FHE.asEuint8(0));
        
        // Store the played card index
        currentPlayedCards[playerIndex] = safeIndex;
        hasPlayedCard[playerIndex] = true;
        
        // Set ACL permissions
        FHE.allowThis(currentPlayedCards[playerIndex]);
        
        emit CardPlayed(msg.sender, currentRound);
        
        // If both players have played, resolve battle
        if (hasPlayedCard[0] && hasPlayedCard[1]) {
            resolveBattle();
        }
    }
    
    function resolveBattle() internal {
        // Get played cards using indexes
        
        // Get actual cards using FHE.select based on indexes
        euint8 actualCard1Type = getCardByIndex(0, currentPlayedCards[0]);
        euint8 actualCard1Health = getCardHealthByIndex(0, currentPlayedCards[0]);
        ebool actualCard1Alive = getCardAliveByIndex(0, currentPlayedCards[0]);
        
        euint8 actualCard2Type = getCardByIndex(1, currentPlayedCards[1]);
        euint8 actualCard2Health = getCardHealthByIndex(1, currentPlayedCards[1]);
        ebool actualCard2Alive = getCardAliveByIndex(1, currentPlayedCards[1]);
        
        // Check if both cards are alive
        ebool bothAlive = FHE.and(actualCard1Alive, actualCard2Alive);
        
        // Battle logic: Eagle(0) > Snake(2), Bear(1) > Eagle(0), Snake(2) > Bear(1)
        ebool card1Wins = calculateWinner(actualCard1Type, actualCard2Type, actualCard1Health, actualCard2Health);
        ebool card2Wins = calculateWinner(actualCard2Type, actualCard1Type, actualCard2Health, actualCard1Health);
        
        // Determine result: 0=draw, 1=player1 wins, 2=player2 wins
        euint8 result = FHE.select(
            FHE.and(bothAlive, card1Wins),
            FHE.asEuint8(1),
            FHE.select(
                FHE.and(bothAlive, card2Wins),
                FHE.asEuint8(2),
                FHE.asEuint8(0) // Draw or one card already dead
            )
        );
        
        // Update card status based on battle result
        updateCardStatus(result, currentPlayedCards[0], currentPlayedCards[1]);
        
        battleResults[currentRound] = result;
        FHE.allowThis(battleResults[currentRound]);
        FHE.allow(battleResults[currentRound], players[0].playerAddress);
        FHE.allow(battleResults[currentRound], players[1].playerAddress);
        
        emit BattleResult(currentRound, 0); // Note: We can't decrypt result here, so using 0 as placeholder
        
        currentRound++;
        
        // Reset played cards for next round
        hasPlayedCard[0] = false;
        hasPlayedCard[1] = false;
        
        // Check if game should end
        checkGameEnd();
    }
    
    function calculateWinner(
        euint8 attacker,
        euint8 defender,
        euint8 attackerHealth,
        euint8 defenderHealth
    ) internal returns (ebool) {
        // Eagle(0) beats Snake(2)
        ebool eagleVsSnake = FHE.and(FHE.eq(attacker, 0), FHE.eq(defender, 2));
        
        // Bear(1) beats Eagle(0)
        ebool bearVsEagle = FHE.and(FHE.eq(attacker, 1), FHE.eq(defender, 0));
        
        // Snake(2) beats Bear(1)
        ebool snakeVsBear = FHE.and(FHE.eq(attacker, 2), FHE.eq(defender, 1));
        
        // Type advantage
        ebool hasTypeAdvantage = FHE.or(FHE.or(eagleVsSnake, bearVsEagle), snakeVsBear);
        
        // Same type, compare health
        ebool sameType = FHE.eq(attacker, defender);
        ebool higherHealth = FHE.gt(attackerHealth, defenderHealth);
        
        return FHE.or(hasTypeAdvantage, FHE.and(sameType, higherHealth));
    }
    
    function getCardByIndex(uint8 playerIndex, euint8 cardIndex) internal returns (euint8) {
        euint8 result = players[playerIndex].cards[0].cardType;
        
        for (uint8 i = 0; i < 6; i++) {
            ebool isIndex = FHE.eq(cardIndex, i);
            result = FHE.select(isIndex, players[playerIndex].cards[i].cardType, result);
        }
        
        return result;
    }
    
    function getCardHealthByIndex(uint8 playerIndex, euint8 cardIndex) internal returns (euint8) {
        euint8 result = players[playerIndex].cards[0].health;
        
        for (uint8 i = 0; i < 6; i++) {
            ebool isIndex = FHE.eq(cardIndex, i);
            result = FHE.select(isIndex, players[playerIndex].cards[i].health, result);
        }
        
        return result;
    }
    
    function getCardAliveByIndex(uint8 playerIndex, euint8 cardIndex) internal returns (ebool) {
        ebool result = players[playerIndex].cards[0].isAlive;
        
        for (uint8 i = 0; i < 6; i++) {
            ebool isIndex = FHE.eq(cardIndex, i);
            result = FHE.select(isIndex, players[playerIndex].cards[i].isAlive, result);
        }
        
        return result;
    }
    
    function updateCardStatus(euint8 result, euint8 card1Index, euint8 card2Index) internal {
        // If player 1 wins (result == 1), kill player 2's card
        // If player 2 wins (result == 2), kill player 1's card
        // If draw (result == 0), kill both cards
        
        ebool player1Wins = FHE.eq(result, 1);
        ebool player2Wins = FHE.eq(result, 2);
        ebool isDraw = FHE.eq(result, 0);
        
        // Kill cards based on result
        for (uint8 i = 0; i < 6; i++) {
            // Update player 1's cards
            ebool isPlayer1Card = FHE.eq(card1Index, i);
            ebool killPlayer1Card = FHE.and(isPlayer1Card, FHE.or(player2Wins, isDraw));
            players[0].cards[i].isAlive = FHE.select(
                killPlayer1Card,
                FHE.asEbool(false),
                players[0].cards[i].isAlive
            );

            // Set ACL permissions for updated player 1 cards
            FHE.allowThis(players[0].cards[i].isAlive);
            FHE.allow(players[0].cards[i].isAlive, players[0].playerAddress);

            // Update player 2's cards
            ebool isPlayer2Card = FHE.eq(card2Index, i);
            ebool killPlayer2Card = FHE.and(isPlayer2Card, FHE.or(player1Wins, isDraw));
            players[1].cards[i].isAlive = FHE.select(
                killPlayer2Card,
                FHE.asEbool(false),
                players[1].cards[i].isAlive
            );

            // Set ACL permissions for updated player 2 cards
            FHE.allowThis(players[1].cards[i].isAlive);
            FHE.allow(players[1].cards[i].isAlive, players[1].playerAddress);
        }
        
        // Update alive counts
        updateAliveCount(0);
        updateAliveCount(1);
    }
    
    function updateAliveCount(uint8 playerIndex) internal {
        euint8 count = FHE.asEuint8(0);
        
        for (uint8 i = 0; i < 6; i++) {
            euint8 increment = FHE.select(players[playerIndex].cards[i].isAlive, FHE.asEuint8(1), FHE.asEuint8(0));
            count = FHE.add(count, increment);
        }
        
        players[playerIndex].aliveCount = count;
        FHE.allowThis(players[playerIndex].aliveCount);
        FHE.allow(players[playerIndex].aliveCount, players[playerIndex].playerAddress);
    }
    
    function checkGameEnd() internal {
        // Game end checking will be done externally by calling a view function
        // and then calling endGame() with decryption results
        // This is because we cannot decrypt inside the contract in FHEVM v0.7
    }
    
    function requestGameEndCheck() external view returns (euint8, euint8) {
        // Return both players' alive counts for external decryption and game end decision
        return (players[0].aliveCount, players[1].aliveCount);
    }
    
    function endGame(address winner) external {
        require(gameState == GameState.Playing, "Game not in playing state");
        // In a real implementation, you would verify the winner through decryption oracle
        // For now, we trust the caller (this would be done by the frontend/relayer)
        
        gameState = GameState.Finished;
        emit GameEnded(winner);
    }
    
    // View functions
    function getPlayerCards(uint8 playerIndex) external view returns (euint8[6] memory types, euint8[6] memory healths, ebool[6] memory aliveStatus) {
        require(playerIndex < 2, "Invalid player index");
        require(msg.sender == players[playerIndex].playerAddress, "Not authorized");
        
        for (uint8 i = 0; i < 6; i++) {
            types[i] = players[playerIndex].cards[i].cardType;
            healths[i] = players[playerIndex].cards[i].health;
            aliveStatus[i] = players[playerIndex].cards[i].isAlive;
        }
    }
    
    function getAliveCount(uint8 playerIndex) external view returns (euint8) {
        require(playerIndex < 2, "Invalid player index");
        require(msg.sender == players[playerIndex].playerAddress, "Not authorized");
        
        return players[playerIndex].aliveCount;
    }
    
    function getBattleResult(uint8 round) external view returns (euint8) {
        require(round < currentRound, "Round not finished");
        return battleResults[round];
    }
    
    function getGameInfo() external view returns (
        GameState state,
        uint8 round,
        uint8 joined,
        address player1,
        address player2
    ) {
        return (
            gameState,
            currentRound,
            playersJoined,
            players[0].playerAddress,
            players[1].playerAddress
        );
    }
}