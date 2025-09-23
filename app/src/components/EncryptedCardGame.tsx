import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Header } from './Header';
import { JoinGame } from './JoinGame';
import { GameBoard } from './GameBoard';
import { GameList } from './GameList';
import { CONTRACT_ADDRESS, CONTRACT_ABI, GAME_STATE } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

export interface GameInfo {
  state: number;
  round: number;
  joined: number;
  player1: string;
  player2: string;
}

export interface Card {
  type: number;
  health: number;
  isAlive: boolean;
}

export function EncryptedCardGame() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signer = useEthersSigner();
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number>(0);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createGameLoading, setCreateGameLoading] = useState(false);

  // Get player's current game ID
  const getPlayerGameId = async () => {
    if (!publicClient || !address) return 0;

    try {
      const gameId = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'playerToGame',
        args: [address],
      }) as bigint;

      return Number(gameId);
    } catch (err) {
      console.error('Error getting player game ID:', err);
      return 0;
    }
  };

  // Fetch game info for specific game ID
  const fetchGameInfo = useCallback(async (gameIdToFetch?: number, forceRefreshGameId = false) => {
    if (!publicClient) return;

    try {
      setLoading(true);

      let gameId = gameIdToFetch || currentGameId;

      // If no specific game ID provided and we need to refresh, get player's current game
      if (!gameIdToFetch && (forceRefreshGameId || (gameId === 0 && address))) {
        gameId = await getPlayerGameId();
        // Update currentGameId if we got a new one
        if (gameId !== currentGameId) {
          setCurrentGameId(gameId);
        }
      }

      // If we have a selected game from the list, use that
      if (selectedGameId && !gameIdToFetch) {
        gameId = selectedGameId;
      }

      // If gameId is still 0, try to get the latest available game
      if (gameId === 0) {
        try {
          const nextGameId = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'nextGameId',
          }) as bigint;

          // Use the latest game (nextGameId - 1) or 1 if no games exist
          // Game IDs start from 1, not 0
          gameId = Number(nextGameId) > 1 ? Number(nextGameId) - 1 : 1;
        } catch {
          gameId = 1; // Default to game 1
        }
      }

      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'getGameInfo',
          args: [BigInt(gameId)],
        }) as [number, number, number, string, string];

        const newGameInfo = {
          state: result[0],
          round: result[1],
          joined: result[2],
          player1: result[3],
          player2: result[4],
        };

        console.log('Game info updated:', newGameInfo);
        console.log('Current user address:', address);
        console.log('Player index:', getPlayerIndex());

        setGameInfo(newGameInfo);
        setError(null);
      } catch (gameErr) {
        // Game doesn't exist, set gameInfo to null so we can show "create game" option
        setGameInfo(null);
        setError('No games available. Create a new game to start playing!');
      }
    } catch (err) {
      setError('Failed to fetch game info');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, currentGameId, selectedGameId]);

  // Create a new game
  const createGame = async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setCreateGameLoading(true);
      setError(null);

      // Get contract instance with signer
      const { ethers } = await import('ethers');

      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        setError('Signer not available');
        return;
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      // Create the game
      const tx = await contract.createGame();
      console.log('Transaction sent, waiting for confirmation...');
      const receipt = await tx.wait();

      console.log('Game created successfully!');

      // Get the new game ID from the transaction events
      const gameCreatedEvent = receipt.logs.find((log: any) =>
        log.fragment && log.fragment.name === 'GameCreated'
      );

      if (gameCreatedEvent) {
        const newGameId = Number(gameCreatedEvent.args[0]);
        setCurrentGameId(newGameId);
        console.log('New game ID:', newGameId);
      }

      // Refresh game info to show the new game
      setSelectedGameId(newGameId);
      fetchGameInfo(newGameId);
    } catch (err: any) {
      console.error('Failed to create game:', err);
      setError(err.message || 'Failed to create game');
    } finally {
      setCreateGameLoading(false);
    }
  };

  // Check if current user is a player
  const getPlayerIndex = () => {
    if (!gameInfo || !address) return -1;
    if (gameInfo.player1.toLowerCase() === address.toLowerCase()) return 0;
    if (gameInfo.player2.toLowerCase() === address.toLowerCase()) return 1;
    return -1;
  };

  const canJoinGame = () => {
    return isConnected &&
           gameInfo &&
           gameInfo.state === GAME_STATE.WAITING &&
           gameInfo.joined < 2 &&
           getPlayerIndex() === -1;
  };

  // Handle game selection from the game list
  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
    setCurrentGameId(gameId);
    fetchGameInfo(gameId);
  };

  // Fetch game info when connected
  useEffect(() => {
    if (isConnected) {
      fetchGameInfo();
    }
  }, [isConnected, fetchGameInfo]);

  const getGameStateText = (state: number) => {
    switch (state) {
      case GAME_STATE.WAITING: return 'Waiting for players';
      case GAME_STATE.PLAYING: return 'Game in progress';
      case GAME_STATE.FINISHED: return 'Game finished';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <Header />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
            🦅 Encrypted Card Game 🐻🐍
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#6b7280' }}>
            A fully homomorphic encrypted card battle game
          </p>
        </div>

        {!isConnected ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#374151' }}>
              Connect your wallet to start playing
            </h2>
            <p style={{ color: '#6b7280' }}>
              Use the "Connect Wallet" button above to join the game
            </p>
          </div>
        ) : (
          <>
            {/* Game List */}
            <GameList
              onSelectGame={handleGameSelect}
              selectedGameId={selectedGameId}
              currentUserAddress={address}
            />

            {/* Current Game Status */}
            {(selectedGameId || currentGameId > 0) && (
              <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '2rem'
              }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>
                  Your Game #{selectedGameId || currentGameId} - Status
                </h2>
                {loading ? (
                  <p style={{ color: '#6b7280' }}>Loading...</p>
                ) : error ? (
                  <p style={{ color: '#dc2626' }}>{error}</p>
                ) : gameInfo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <strong>State:</strong> {getGameStateText(gameInfo.state)}
                    </div>
                    <div>
                      <strong>Players:</strong> {gameInfo.joined}/2
                    </div>
                    <div>
                      <strong>Round:</strong> {gameInfo.round}
                    </div>
                    <div>
                      <strong>Your Position:</strong> {
                        getPlayerIndex() === -1 ? 'Spectator' : `Player ${getPlayerIndex() + 1}`
                      }
                    </div>
                  </div>
                ) : null}
              </div>
            )}


            {gameInfo && (selectedGameId || currentGameId > 0) && (
              <>
                {canJoinGame() && (
                  <JoinGame gameId={selectedGameId || currentGameId} onJoinSuccess={() => fetchGameInfo(selectedGameId || currentGameId, true)} />
                )}

                {getPlayerIndex() !== -1 && gameInfo.state === GAME_STATE.PLAYING && (
                  <GameBoard
                    gameId={selectedGameId || currentGameId}
                    playerIndex={getPlayerIndex()}
                    onGameUpdate={() => fetchGameInfo(selectedGameId || currentGameId)}
                  />
                )}

                {gameInfo.state === GAME_STATE.WAITING && !canJoinGame() && getPlayerIndex() !== -1 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#374151' }}>
                      Waiting for another player...
                    </h2>
                    <p style={{ color: '#6b7280' }}>
                      You've joined the game! Waiting for another player to start the battle.
                    </p>
                  </div>
                )}

                {gameInfo.state === GAME_STATE.FINISHED && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#374151' }}>
                      Game Finished!
                    </h2>
                    <p style={{ color: '#6b7280' }}>
                      The game has ended. Check the final results above.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Create New Game Action - Moved to bottom */}
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginTop: '2rem'
            }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#374151' }}>
                Create New Game
              </h2>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                Start a new game and invite others to join!
              </p>
              <button
                onClick={createGame}
                disabled={createGameLoading}
                style={{
                  backgroundColor: createGameLoading ? '#9ca3af' : '#10b981',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: 'medium',
                  cursor: createGameLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {createGameLoading ? 'Creating Game...' : '+ Create New Game'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}