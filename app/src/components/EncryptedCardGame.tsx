import { useState } from 'react';
import { Header } from './Header';
import { GameLobby } from './GameLobby';
import { CurrentGame } from './CurrentGame';

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

type AppView = 'lobby' | 'game';

export function EncryptedCardGame() {
  const [currentView, setCurrentView] = useState<AppView>('lobby');
  const [currentGameId, setCurrentGameId] = useState<number>(0);

  const handleJoinGame = (gameId: number) => {
    setCurrentGameId(gameId);
    setCurrentView('game');
  };

  const handleBackToLobby = () => {
    setCurrentView('lobby');
    setCurrentGameId(0);
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

        {currentView === 'lobby' ? (
          <GameLobby onJoinGame={handleJoinGame} />
        ) : (
          <CurrentGame
            gameId={currentGameId}
            onBackToLobby={handleBackToLobby}
          />
        )}
      </div>
    </div>
  );
}