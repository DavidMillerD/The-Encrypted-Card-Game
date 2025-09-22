import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Header } from './Header';
import { JoinGame } from './JoinGame';
import { GameBoard } from './GameBoard';
import { CONTRACT_ADDRESS, CONTRACT_ABI, GAME_STATE } from '../config/contracts';

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
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch game info
  const fetchGameInfo = async () => {
    if (!publicClient) return;

    try {
      setLoading(true);
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'getGameInfo',
      }) as [number, number, number, string, string];

      setGameInfo({
        state: result[0],
        round: result[1],
        joined: result[2],
        player1: result[3],
        player2: result[4],
      });
      setError(null);
    } catch (err) {
      setError('Failed to fetch game info');
      console.error(err);
    } finally {
      setLoading(false);
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

  // Refresh game info every 5 seconds
  useEffect(() => {
    if (isConnected) {
      fetchGameInfo();
      const interval = setInterval(fetchGameInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, publicClient]);

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

            {/* Game Actions */}
            {gameInfo && (
              <>
                {canJoinGame() && (
                  <JoinGame onJoinSuccess={fetchGameInfo} />
                )}

                {getPlayerIndex() !== -1 && gameInfo.state === GAME_STATE.PLAYING && (
                  <GameBoard
                    gameInfo={gameInfo}
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
                    <p style={{ color: '#6b7280' }}>
                      The game has ended. Check the final results above.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}