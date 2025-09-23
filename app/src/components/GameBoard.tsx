import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CARD_NAMES } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import type { GameInfo, Card } from './EncryptedCardGame';

interface GameBoardProps {
  gameInfo: GameInfo;
  gameId: number;
  playerIndex: number;
  onGameUpdate: () => void;
}

interface DecryptedCard extends Card {
  index: number;
}

export function GameBoard({ gameInfo, gameId, playerIndex, onGameUpdate }: GameBoardProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance } = useZamaInstance();
  const [playerCards, setPlayerCards] = useState<DecryptedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch player cards with caching to avoid repeated signatures
  const fetchPlayerCards = useCallback(async (force = false) => {
    if (!instance || !address) return;

    // Avoid fetching too frequently (minimum 5 seconds between fetches)
    const now = Date.now();
    if (!force && (now - lastFetchTime) < 5000) {
      console.log('Skipping fetch - too soon since last fetch');
      return;
    }

    try {
      setCardsLoading(true);

      // Get signer and contract instance
      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      // Get encrypted card data with gameId
      const [types, healths, aliveStatus] = await contract.getPlayerCards(BigInt(gameId), playerIndex);

      // Decrypt the cards
      const cards: DecryptedCard[] = [];
      for (let i = 0; i < 6; i++) {
        try {
          // Use Zama SDK for user decryption on Sepolia
          const handleContractPairs = [
            { handle: types[i], contractAddress: CONTRACT_ADDRESS },
            { handle: healths[i], contractAddress: CONTRACT_ADDRESS },
            { handle: aliveStatus[i], contractAddress: CONTRACT_ADDRESS }
          ];

          const keypair = instance.generateKeypair();
          const startTimeStamp = Math.floor(Date.now() / 1000).toString();
          const durationDays = "10";
          const contractAddresses = [CONTRACT_ADDRESS];

          const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

          const signature = await resolvedSigner.signTypedData(
            eip712.domain,
            {
              UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
            },
            eip712.message,
          );

          const result = await instance.userDecrypt(
            handleContractPairs,
            keypair.privateKey,
            keypair.publicKey,
            signature.replace("0x", ""),
            contractAddresses,
            address,
            startTimeStamp,
            durationDays,
          );

          const cardType = result[types[i]];
          const cardHealth = result[healths[i]];
          const isAlive = result[aliveStatus[i]];

          cards.push({
            index: i,
            type: Number(cardType),
            health: Number(cardHealth),
            isAlive: Boolean(isAlive)
          });
        } catch (err) {
          console.error(`Failed to decrypt card ${i}:`, err);
          // Add a placeholder card if decryption fails
          cards.push({
            index: i,
            type: 0,
            health: 1,
            isAlive: false
          });
        }
      }

      setPlayerCards(cards);
      setLastFetchTime(now);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch player cards:', err);
      setError('Failed to load your cards');
    } finally {
      setCardsLoading(false);
    }
  }, [instance, address, gameId, playerIndex, signer, lastFetchTime]);


  // Play a card
  const playCard = async (cardIndex: number) => {
    if (!instance || !address) {
      setError('Wallet not connected or FHEVM instance not ready');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`Playing card at index ${cardIndex}...`);

      // Get contract instance with signer
      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        setError('Signer not available');
        return;
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      // Play the card with gameId
      const tx = await contract.playCard(
        BigInt(gameId),
        cardIndex
      );

      console.log('Transaction sent, waiting for confirmation...');
      await tx.wait();

      console.log('Card played successfully!');
      setSelectedCard(null);
      onGameUpdate();

      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Refresh cards after a delay (force refresh)
      fetchTimeoutRef.current = setTimeout(() => {
        fetchPlayerCards(true);
      }, 3000);
    } catch (err: any) {
      console.error('Failed to play card:', err);
      setError(err.message || 'Failed to play card');
    } finally {
      setLoading(false);
    }
  };

  // Load cards when component mounts or critical dependencies change
  useEffect(() => {
    fetchPlayerCards(true); // Force initial load
  }, [gameId, playerIndex]); // Only re-fetch when game or player changes

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  const getCardEmoji = (cardType: number) => {
    switch (cardType) {
      case 0: return '🦅';
      case 1: return '🐻';
      case 2: return '🐍';
      default: return '❓';
    }
  };


  const aliveCards = playerCards.filter(card => card.isAlive);

  return (
    <div>
      {/* Player Cards */}
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#374151' }}>
          Your Cards (Player {playerIndex + 1})
        </h2>

        {cardsLoading ? (
          <p style={{ color: '#6b7280' }}>Loading your cards...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {playerCards.map((card) => (
                <div
                  key={card.index}
                  onClick={() => card.isAlive && setSelectedCard(card.index)}
                  style={{
                    border: selectedCard === card.index ? '3px solid #3b82f6' : card.isAlive ? '2px solid #10b981' : '2px solid #ef4444',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: card.isAlive ? '#f0fdf4' : '#fef2f2',
                    cursor: card.isAlive ? 'pointer' : 'not-allowed',
                    opacity: card.isAlive ? 1 : 0.6,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                      {getCardEmoji(card.type)}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151' }}>
                      {CARD_NAMES[card.type as keyof typeof CARD_NAMES]}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {card.health} HP
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.5rem', color: card.isAlive ? '#10b981' : '#ef4444' }}>
                      {card.isAlive ? 'ALIVE' : 'DEAD'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '1.125rem', color: '#374151' }}>
                <strong>Alive Cards: {aliveCards.length}/6</strong>
              </p>
              {selectedCard !== null && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Selected: Card {selectedCard + 1} - Click "Play Selected Card" to use it in battle
                </p>
              )}
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

            {selectedCard !== null && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => playCard(selectedCard)}
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#9ca3af' : '#10b981',
                    color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: 'medium',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginRight: '1rem'
                  }}
                >
                  {loading ? 'Playing Card...' : 'Play Selected Card'}
                </button>
                <button
                  onClick={() => setSelectedCard(null)}
                  disabled={loading}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: 'medium',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}