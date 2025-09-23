import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, GAME_STATE } from '../config/contracts';
import type{ GameInfo } from './EncryptedCardGame';

interface GameListProps {
  onSelectGame: (gameId: number) => void;
  onJoinGame: (gameId: number) => void;
  selectedGameId: number | null;
  currentUserAddress?: string;
}

interface GameListItem extends GameInfo {
  gameId: number;
  canJoin: boolean;
  canEnter: boolean;
}

export function GameList({ onSelectGame, onJoinGame, selectedGameId, currentUserAddress }: GameListProps) {
  const publicClient = usePublicClient();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllGames = async () => {
    if (!publicClient) return;

    try {
      setLoading(true);
      setError(null);

      // Get the next game ID to know how many games exist
      const nextGameId = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'nextGameId',
      }) as bigint;

      const totalGames = Number(nextGameId) - 1; // Games start from ID 1
      const gamesList: GameListItem[] = [];

      // Fetch info for each game
      for (let gameId = 1; gameId <= totalGames; gameId++) {
        try {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'getGameInfo',
            args: [BigInt(gameId)],
          }) as [number, number, number, string, string];

          const gameInfo = {
            state: result[0],
            round: result[1],
            joined: result[2],
            player1: result[3],
            player2: result[4],
          };

          // Check if current user can join this game
          const isPlayer1 = currentUserAddress && gameInfo.player1.toLowerCase() === currentUserAddress.toLowerCase();
          const isPlayer2 = currentUserAddress && gameInfo.player2.toLowerCase() === currentUserAddress.toLowerCase();
          const isPlayerInGame = isPlayer1 || isPlayer2;
          const canJoin = gameInfo.state === GAME_STATE.WAITING &&
                          gameInfo.joined < 2 &&
                          !isPlayerInGame;
          const canEnter = isPlayerInGame || canJoin; // 可以进入：要么已经在游戏中，要么可以加入

          gamesList.push({
            gameId,
            ...gameInfo,
            canJoin,
            canEnter,
          });
        } catch (gameErr) {
          console.warn(`Failed to fetch game ${gameId}:`, gameErr);
        }
      }

      setGames(gamesList);
    } catch (err) {
      setError('Failed to fetch games list');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllGames();
  }, [publicClient, currentUserAddress]);

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

  const getPlayerStatus = (game: GameListItem) => {
    if (!currentUserAddress) return 'Not connected';

    const isPlayer1 = game.player1.toLowerCase() === currentUserAddress.toLowerCase();
    const isPlayer2 = game.player2.toLowerCase() === currentUserAddress.toLowerCase();

    if (isPlayer1) return 'You are Player 1';
    if (isPlayer2) return 'You are Player 2';
    if (game.canJoin) return 'Can join';
    return 'Cannot join';
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>
          Available Games
        </h2>
        <p style={{ color: '#6b7280' }}>Loading games...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>
          Available Games
        </h2>
        <p style={{ color: '#dc2626' }}>{error}</p>
        <button
          onClick={fetchAllGames}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '2rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#374151' }}>
          Available Games ({games.length})
        </h2>
        <button
          onClick={fetchAllGames}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: 'medium'
          }}
        >
          Refresh
        </button>
      </div>

      {games.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No games found. Create a new game to start playing!</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {games.map((game) => (
            <div
              key={game.gameId}
              onClick={() => onSelectGame(game.gameId)}
              style={{
                border: selectedGameId === game.gameId ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: selectedGameId === game.gameId ? '#eff6ff' : 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#374151', margin: 0 }}>
                  Game #{game.gameId}
                </h3>
                <span
                  style={{
                    backgroundColor: getGameStateColor(game.state),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'medium'
                  }}
                >
                  {getGameStateText(game.state)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div>
                  <strong>Players:</strong> {game.joined}/2
                </div>
                <div>
                  <strong>Round:</strong> {game.round}
                </div>
                <div>
                  <strong>Status:</strong> {getPlayerStatus(game)}
                </div>
              </div>

              {game.state === GAME_STATE.WAITING && game.joined > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  {game.player1 !== '0x0000000000000000000000000000000000000000' && (
                    <div>Player 1: {game.player1.slice(0, 6)}...{game.player1.slice(-4)}</div>
                  )}
                  {game.player2 !== '0x0000000000000000000000000000000000000000' && (
                    <div>Player 2: {game.player2.slice(0, 6)}...{game.player2.slice(-4)}</div>
                  )}
                </div>
              )}

              {selectedGameId === game.gameId && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#dbeafe',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: '#1e40af',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>✓ Selected - {getPlayerStatus(game)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinGame(game.gameId);
                    }}
                    disabled={!game.canEnter}
                    style={{
                      backgroundColor: game.canEnter ? '#10b981' : '#6b7280',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '0.875rem',
                      cursor: game.canEnter ? 'pointer' : 'not-allowed',
                      fontWeight: 'medium'
                    }}
                  >
                    Enter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}