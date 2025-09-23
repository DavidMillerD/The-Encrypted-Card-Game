import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CARD_NAMES } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { getCardImage, getCardEmoji } from '../assets/cards';
import type { Card } from './EncryptedCardGame';

interface GameBattleProps {
  gameId: number;
  playerIndex: number;
  onGameUpdate: () => void;
}

interface DecryptedCard extends Card {
  index: number;
}

interface OpponentCard {
  index: number;
  isAlive: boolean;
}

export function GameBattle({ gameId, playerIndex, onGameUpdate }: GameBattleProps) {
  const { address } = useAccount();
  const signer = useEthersSigner();
  const { instance } = useZamaInstance();

  const [myCards, setMyCards] = useState<DecryptedCard[]>([]);
  const [opponentCards, setOpponentCards] = useState<OpponentCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // 获取对手的索引
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  // 获取我方卡牌信息
  const fetchMyCards = useCallback(async () => {
    if (!address) {
      // 如果没有连接钱包，显示默认的6张卡牌
      const cards: DecryptedCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          type: -1, // -1 表示未解密
          health: -1,
          isAlive: true // 默认显示为存活
        });
      }
      setMyCards(cards);
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const [types, healths, aliveStatus] = await contract.getPlayerCards(BigInt(gameId), playerIndex);

      // 初始化我方卡牌为未解密状态
      const cards: DecryptedCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          type: -1, // -1 表示未解密
          health: -1,
          isAlive: aliveStatus[i]
        });
      }

      setMyCards(cards);
    } catch (err: any) {
      console.error('Failed to fetch my cards:', err);
      setError('Failed to load cards');
      // 出错时也显示6张默认卡牌
      const cards: DecryptedCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          type: -1,
          health: -1,
          isAlive: true
        });
      }
      setMyCards(cards);
    }
  }, [address, gameId, playerIndex, signer]);

  // 获取对手卡牌信息（只显示存活状态）
  const fetchOpponentCards = useCallback(async () => {
    if (!address) {
      // 如果没有连接钱包，显示默认的6张卡牌
      const cards: OpponentCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          isAlive: true // 默认显示为存活
        });
      }
      setOpponentCards(cards);
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const [, , aliveStatus] = await contract.getPlayerCards(BigInt(gameId), opponentIndex);

      const cards: OpponentCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          isAlive: aliveStatus[i]
        });
      }

      setOpponentCards(cards);
    } catch (err: any) {
      console.error('Failed to fetch opponent cards:', err);
      // 出错时也显示6张默认卡牌
      const cards: OpponentCard[] = [];
      for (let i = 0; i < 6; i++) {
        cards.push({
          index: i,
          isAlive: true
        });
      }
      setOpponentCards(cards);
    }
  }, [address, gameId, opponentIndex, signer]);

  // 解密指定卡牌
  const decryptCard = async (cardIndex: number) => {
    if (!instance || !address) return;

    try {
      setDecryptLoading(prev => ({ ...prev, [cardIndex]: true }));

      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const [types, healths, aliveStatus] = await contract.getPlayerCards(BigInt(gameId), playerIndex);

      const handleContractPairs = [
        { handle: types[cardIndex], contractAddress: CONTRACT_ADDRESS },
        { handle: healths[cardIndex], contractAddress: CONTRACT_ADDRESS },
        { handle: aliveStatus[cardIndex], contractAddress: CONTRACT_ADDRESS }
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

      const cardType = result[types[cardIndex]];
      const cardHealth = result[healths[cardIndex]];
      const isAlive = result[aliveStatus[cardIndex]];

      // 更新指定卡牌的解密状态
      setMyCards(prev => prev.map(card =>
        card.index === cardIndex
          ? {
              ...card,
              type: Number(cardType),
              health: Number(cardHealth),
              isAlive: Boolean(isAlive)
            }
          : card
      ));

    } catch (err: any) {
      console.error(`Failed to decrypt card ${cardIndex}:`, err);
      setError(`Failed to decrypt card ${cardIndex + 1}`);
    } finally {
      setDecryptLoading(prev => ({ ...prev, [cardIndex]: false }));
    }
  };

  // 出牌
  const playCard = async (cardIndex: number) => {
    if (!instance || !address) return;

    try {
      setLoading(true);
      setError(null);

      const { ethers } = await import('ethers');
      const resolvedSigner = await signer;
      if (!resolvedSigner) return;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      const tx = await contract.playCard(BigInt(gameId), cardIndex);
      await tx.wait();

      setSelectedCard(null);
      onGameUpdate();

      // 刷新卡牌状态
      setTimeout(() => {
        fetchMyCards();
        fetchOpponentCards();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to play card:', err);
      setError(err.message || 'Failed to play card');
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchMyCards();
    fetchOpponentCards();
  }, [fetchMyCards, fetchOpponentCards]);

  // 卡牌组件
  const CardComponent = ({
    card,
    isOpponent = false,
    onClick
  }: {
    card: DecryptedCard | OpponentCard;
    isOpponent?: boolean;
    onClick?: () => void;
  }) => {
    const isDecrypted = 'type' in card && card.type !== -1;
    const isSelected = 'index' in card && selectedCard === card.index;
    const isLoadingDecrypt = 'index' in card && decryptLoading[card.index];

    return (
      <div
        onClick={onClick}
        style={{
          border: isSelected ? '2px solid #3b82f6' : card.isAlive ? '1px solid #10b981' : '1px solid #ef4444',
          borderRadius: '8px',
          padding: '0.5rem',
          backgroundColor: card.isAlive ? '#f0fdf4' : '#fef2f2',
          cursor: onClick ? 'pointer' : 'default',
          opacity: card.isAlive ? 1 : 0.6,
          transition: 'all 0.2s ease',
          position: 'relative',
          aspectRatio: '2/3',
          minHeight: '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: isOpponent ? 'linear-gradient(45deg, #6b7280, #374151)' : undefined
        }}
      >
        {isLoadingDecrypt && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            color: 'white',
            fontSize: '0.75rem'
          }}>
            解密中...
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
            {isOpponent
              ? getCardEmoji(0, true)
              : isDecrypted
                ? getCardEmoji((card as DecryptedCard).type)
                : '🔒'
            }
          </div>

          {!isOpponent && isDecrypted && (
            <>
              <div style={{ fontSize: '0.625rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#374151' }}>
                {CARD_NAMES[(card as DecryptedCard).type as keyof typeof CARD_NAMES]}
              </div>
              <div style={{ fontSize: '0.5rem', color: '#6b7280' }}>
                {(card as DecryptedCard).health} HP
              </div>
            </>
          )}

          {!isOpponent && !isDecrypted && (
            <div style={{ fontSize: '0.5rem', color: '#6b7280', marginTop: '0.25rem' }}>
              点击解密
            </div>
          )}

          <div style={{
            fontSize: '0.5rem',
            fontWeight: 'bold',
            marginTop: '0.25rem',
            color: card.isAlive ? '#10b981' : '#ef4444'
          }}>
            {card.isAlive ? 'ALIVE' : 'DEAD'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem', color: '#374151' }}>
          游戏对局界面
        </h2>
      </div>

        {/* 对手卡牌区域 */}
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#374151' }}>
            对手卡牌 (Player {opponentIndex + 1})
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '0.5rem'
          }}>
            {opponentCards.map((card) => (
              <CardComponent
                key={`opponent-${card.index}`}
                card={card}
                isOpponent={true}
              />
            ))}
          </div>
        </div>

        {/* 我方卡牌区域 */}
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#374151' }}>
            我的卡牌 (Player {playerIndex + 1})
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '0.5rem',
            marginBottom: '2rem'
          }}>
            {myCards.map((card) => (
              <CardComponent
                key={`my-${card.index}`}
                card={card}
                onClick={() => {
                  if (card.type === -1 && card.isAlive) {
                    // 未解密且存活的卡牌，点击解密
                    decryptCard(card.index);
                  } else if (card.type !== -1 && card.isAlive) {
                    // 已解密且存活的卡牌，点击选中
                    setSelectedCard(selectedCard === card.index ? null : card.index);
                  }
                }}
              />
            ))}
          </div>

          {/* 操作按钮 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '1.125rem', color: '#374151' }}>
                <strong>我方存活卡牌: {myCards.filter(card => card.isAlive).length}/6</strong>
              </p>
              <p style={{ fontSize: '1.125rem', color: '#374151' }}>
                <strong>对手存活卡牌: {opponentCards.filter(card => card.isAlive).length}/6</strong>
              </p>
            </div>

            {selectedCard !== null && (
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  已选中卡牌 {selectedCard + 1}，点击"出牌"进行战斗
                </p>
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
                  {loading ? '出牌中...' : '出牌'}
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
                  取消选择
                </button>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                {error}
              </p>
            </div>
          )}
        </div>
    </div>
  );
}