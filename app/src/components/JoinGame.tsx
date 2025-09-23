import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, CARD_TYPES, CARD_NAMES } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

interface JoinGameProps {
  gameId: number;
  onJoinSuccess: () => void;
}

interface CardConfig {
  type: number;
}

export function JoinGame({ gameId, onJoinSuccess }: JoinGameProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance } = useZamaInstance();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default card configuration - all cards have health 2
  const [cards, setCards] = useState<CardConfig[]>([
    { type: CARD_TYPES.EAGLE },
    { type: CARD_TYPES.BEAR },
    { type: CARD_TYPES.SNAKE },
    { type: CARD_TYPES.EAGLE },
    { type: CARD_TYPES.BEAR },
    { type: CARD_TYPES.SNAKE },
  ]);

  const updateCard = (index: number, type: number) => {
    const newCards = [...cards];
    newCards[index].type = type;
    setCards(newCards);
  };

  const joinGame = async () => {
    if (!instance || !address) {
      setError('Wallet not connected or FHEVM instance not ready');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate cards
      for (const card of cards) {
        if (![0, 1, 2].includes(card.type)) {
          throw new Error('Invalid card type');
        }
      }

      console.log('Creating encrypted inputs...');

      // Create encrypted input
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);

      // Add only card types (the contract expects only card types, not healths)
      cards.forEach(card => input.add8(card.type));

      const encryptedInput = await input.encrypt();

      console.log('Joining game...');

      // Get contract instance with signer
      const { ethers } = await import('ethers');
      const { CONTRACT_ABI } = await import('../config/contracts');

      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        setError('Signer not available');
        return;
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      // Join the game with gameId parameter
      const tx = await contract.joinGame(
        BigInt(gameId),               // Game ID
        encryptedInput.handles.slice(0, 6),  // Card types only
        encryptedInput.inputProof
      );

      console.log('Transaction sent, waiting for confirmation...');
      await tx.wait();

      console.log('Successfully joined game!');
      onJoinSuccess();
    } catch (err: any) {
      console.error('Failed to join game:', err);
      setError(err.message || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '2rem'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#374151' }}>
        Join Game
      </h2>

      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Configure your 6 cards and join the battle! Each card has a type (Eagle beats Snake, Bear beats Eagle, Snake beats Bear) and 2 health points.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {cards.map((card, index) => (
          <div key={index} style={{
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#374151' }}>
              Card {index + 1}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 'medium', color: '#374151', marginBottom: '0.5rem' }}>
                Type:
              </label>
              <select
                value={card.type}
                onChange={(e) => updateCard(index, parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              >
                <option value={CARD_TYPES.EAGLE}>🦅 {CARD_NAMES[CARD_TYPES.EAGLE]}</option>
                <option value={CARD_TYPES.BEAR}>🐻 {CARD_NAMES[CARD_TYPES.BEAR]}</option>
                <option value={CARD_TYPES.SNAKE}>🐍 {CARD_NAMES[CARD_TYPES.SNAKE]}</option>
              </select>
            </div>

            <div style={{
              padding: '0.5rem',
              backgroundColor: '#e5e7eb',
              borderRadius: '6px',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: '#374151',
              fontWeight: 'medium'
            }}>
              Health: 2 HP
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </p>
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={joinGame}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            padding: '0.75rem 2rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 'medium',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Joining Game...' : 'Join Game'}
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e40af' }}>
          Game Rules:
        </h4>
        <ul style={{ fontSize: '0.875rem', color: '#1e40af', paddingLeft: '1.5rem' }}>
          <li>🦅 Eagle beats 🐍 Snake</li>
          <li>🐻 Bear beats 🦅 Eagle</li>
          <li>🐍 Snake beats 🐻 Bear</li>
          <li>Same type: Higher health wins</li>
          <li>Win by having more cards alive at the end!</li>
        </ul>
      </div>
    </div>
  );
}