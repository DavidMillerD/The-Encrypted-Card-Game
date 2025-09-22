// EncryptedCardGame contract deployed on Sepolia
export const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

// Generated ABI from contract artifacts - Auto-synced from EncryptedCardGame.json
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "round",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "winner",
        "type": "uint8"
      }
    ],
    "name": "BattleResult",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "round",
        "type": "uint8"
      }
    ],
    "name": "CardPlayed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "name": "GameEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "GameStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "playerIndex",
        "type": "uint8"
      }
    ],
    "name": "PlayerJoined",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "name": "endGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "playerIndex",
        "type": "uint8"
      }
    ],
    "name": "getAliveCount",
    "outputs": [
      {
        "internalType": "euint8",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "round",
        "type": "uint8"
      }
    ],
    "name": "getBattleResult",
    "outputs": [
      {
        "internalType": "euint8",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGameInfo",
    "outputs": [
      {
        "internalType": "enum EncryptedCardGame.GameState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "round",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "joined",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "player1",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "player2",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "playerIndex",
        "type": "uint8"
      }
    ],
    "name": "getPlayerCards",
    "outputs": [
      {
        "internalType": "euint8[6]",
        "name": "types",
        "type": "bytes32[6]"
      },
      {
        "internalType": "euint8[6]",
        "name": "healths",
        "type": "bytes32[6]"
      },
      {
        "internalType": "ebool[6]",
        "name": "aliveStatus",
        "type": "bytes32[6]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint8[6]",
        "name": "encryptedCardTypes",
        "type": "bytes32[6]"
      },
      {
        "internalType": "externalEuint8[6]",
        "name": "encryptedCardHealth",
        "type": "bytes32[6]"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "joinGame",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint8",
        "name": "encryptedCardIndex",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "playCard",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "requestGameEndCheck",
    "outputs": [
      {
        "internalType": "euint8",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "euint8",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentRound",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "gameState",
    "outputs": [
      {
        "internalType": "enum EncryptedCardGame.GameState",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "name": "hasPlayedCard",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "name": "players",
    "outputs": [
      {
        "internalType": "address",
        "name": "playerAddress",
        "type": "address"
      },
      {
        "internalType": "euint8",
        "name": "aliveCount",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "hasJoined",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "playersJoined",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Card type constants
export const CARD_TYPES = {
  EAGLE: 0,
  BEAR: 1,
  SNAKE: 2
} as const;

// Game state constants
export const GAME_STATE = {
  WAITING: 0,
  PLAYING: 1,
  FINISHED: 2
} as const;

// Card type names for display
export const CARD_NAMES = {
  [CARD_TYPES.EAGLE]: 'Eagle',
  [CARD_TYPES.BEAR]: 'Bear',
  [CARD_TYPES.SNAKE]: 'Snake'
} as const;

// Battle result constants
export const BATTLE_RESULT = {
  DRAW: 0,
  PLAYER1_WINS: 1,
  PLAYER2_WINS: 2
} as const;