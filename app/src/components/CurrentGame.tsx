import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { JoinGame } from './JoinGame';
import { GameBattle } from './GameBattle';
import { CONTRACT_ADDRESS, CONTRACT_ABI, GAME_STATE } from '../config/contracts';
import type { GameInfo } from './EncryptedCardGame';

interface CurrentGameProps {
  gameId: number;
  onBackToLobby: () => void;
}

export function CurrentGame({ gameId, onBackToLobby }: CurrentGameProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch game info for current game
  const fetchGameInfo = useCallback(async () => {
    if (!publicClient || gameId === 0) return;

    try {
      setLoading(true);
      setError(null);

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
      console.log('Player index:', getPlayerIndex(newGameInfo));

      setGameInfo(newGameInfo);
    } catch (gameErr) {
      setError('Failed to load game information');
      console.error('Error fetching game info:', gameErr);
    } finally {
      setLoading(false);
    }
  }, [publicClient, gameId, address]);

  // Check if current user is a player
  const getPlayerIndex = (info: GameInfo = gameInfo!) => {
    if (!info || !address) return -1;
    if (info.player1.toLowerCase() === address.toLowerCase()) return 0;
    if (info.player2.toLowerCase() === address.toLowerCase()) return 1;
    return -1;
  };

  const canJoinGame = () => {
    return isConnected &&
           gameInfo &&
           gameInfo.state === GAME_STATE.WAITING &&
           gameInfo.joined < 2 &&
           getPlayerIndex() === -1;
  };

  // Fetch game info when component mounts or gameId changes
  useEffect(() => {
    if (gameId > 0) {
      fetchGameInfo();
    }
  }, [gameId, fetchGameInfo]);


  const getGameStateText = (state: number) => {
    switch (state) {
      case GAME_STATE.WAITING: return 'Waiting for players';
      case GAME_STATE.PLAYING: return 'Game in progress';
      case GAME_STATE.FINISHED: return 'Game finished';
      default: return 'Unknown';
    }
  };

  const getGameStateColor = (state: number) => {
    switch (state) {
      case GAME_STATE.WAITING: return '#f59e0b'; // amber
      case GAME_STATE.PLAYING: return '#10b981'; // emerald
      case GAME_STATE.FINISHED: return '#6b7280'; // gray
      default: return '#6b7280';
    }
  };

  if (!isConnected) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#374151' }}>
          Connect your wallet to view the game
        </h2>
        <button
          onClick={onBackToLobby}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Back Button */}
      <div style={{
        backgroundColor: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#374151', margin: 0 }}>
          Game #{gameId}
        </h1>
        <button
          onClick={onBackToLobby}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: 'medium'
          }}
        >
          ← Back to Lobby
        </button>
      </div>

      {/* Game Status */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>
          Game Status
        </h2>
        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading...</p>
        ) : error ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
            <button
              onClick={fetchGameInfo}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : gameInfo ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span
                style={{
                  backgroundColor: getGameStateColor(gameInfo.state),
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 'medium'
                }}
              >
                {getGameStateText(gameInfo.state)}
              </span>
              <span style={{ color: '#6b7280' }}>
                Players: {gameInfo.joined}/2 • Round: {gameInfo.round}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>Your Position:</strong> {
                  getPlayerIndex() === -1 ? 'Spectator' : `Player ${getPlayerIndex() + 1}`
                }
              </div>
              {gameInfo.player1 !== '0x0000000000000000000000000000000000000000' && (
                <div>
                  <strong>Player 1:</strong> {gameInfo.player1.slice(0, 6)}...{gameInfo.player1.slice(-4)}
                </div>
              )}
              {gameInfo.player2 !== '0x0000000000000000000000000000000000000000' && (
                <div>
                  <strong>Player 2:</strong> {gameInfo.player2.slice(0, 6)}...{gameInfo.player2.slice(-4)}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Game Content */}
      {gameInfo && (
        <>
          {canJoinGame() && (
            <JoinGame gameId={gameId} onJoinSuccess={fetchGameInfo} />
          )}

          {getPlayerIndex() !== -1 && gameInfo.state === GAME_STATE.PLAYING && (
            <GameBattle
              gameId={gameId}
              playerIndex={getPlayerIndex()}
              onGameUpdate={fetchGameInfo}
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
              <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
                The game has ended. Check the final results above.
              </p>
              <button
                onClick={onBackToLobby}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: 'medium'
                }}
              >
                Return to Lobby
              </button>
            </div>
          )}

          {gameInfo.state === GAME_STATE.WAITING && getPlayerIndex() === -1 && !canJoinGame() && (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#374151' }}>
                Spectating Game #{gameId}
              </h2>
              <p style={{ color: '#6b7280' }}>
                This game is full. You can watch as a spectator.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}