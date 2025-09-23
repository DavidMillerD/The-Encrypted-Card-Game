import { useState } from 'react';
import { useAccount } from 'wagmi';
import { GameList } from './GameList';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';

interface GameLobbyProps {
  onJoinGame: (gameId: number) => void;
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [createGameLoading, setCreateGameLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setSelectedGameId(newGameId);
        console.log('New game ID:', newGameId);

        // Auto-navigate to the new game
        onJoinGame(newGameId);
      }
    } catch (err: any) {
      console.error('Failed to create game:', err);
      setError(err.message || 'Failed to create game');
    } finally {
      setCreateGameLoading(false);
    }
  };

  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
  };

  const handleJoinSelectedGame = () => {
    if (selectedGameId) {
      onJoinGame(selectedGameId);
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
          Connect your wallet to start playing
        </h2>
        <p style={{ color: '#6b7280' }}>
          Use the "Connect Wallet" button above to join the game
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Game List */}
      <GameList
        onSelectGame={handleGameSelect}
        onJoinGame={onJoinGame}
        selectedGameId={selectedGameId}
        currentUserAddress={address}
      />

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Create New Game Action */}
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
    </div>
  );
}