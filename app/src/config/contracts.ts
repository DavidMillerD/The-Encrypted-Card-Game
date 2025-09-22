// EncryptedCardGameV2 contract - Multi-game room architecture
// Note: This will be updated with the deployed V2 contract address
export const CONTRACT_ADDRESS = '0xBce452Dcda757C451459a19a103364BC3728FE59';

// Generated ABI from contract artifacts - Auto-synced from EncryptedCardGameV2.json
export const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "cardIndex",
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
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      }
    ],
    "name": "GameCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
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
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      }
    ],
    "name": "GameStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
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
    "inputs": [],
    "name": "createGame",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "games",
    "outputs": [
      {
        "internalType": "enum EncryptedCardGameV2.GameState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "playersJoined",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "currentRound",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "playerIndex",
        "type": "uint8"
      }
    ],
    "name": "getAliveCount",
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
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      }
    ],
    "name": "getGameInfo",
    "outputs": [
      {
        "internalType": "enum EncryptedCardGameV2.GameState",
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
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
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
        "internalType": "uint8[6]",
        "name": "healths",
        "type": "uint8[6]"
      },
      {
        "internalType": "bool[6]",
        "name": "aliveStatus",
        "type": "bool[6]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "internalType": "externalEuint8[6]",
        "name": "encryptedCardTypes",
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
    "inputs": [],
    "name": "nextGameId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "gameId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "cardIndex",
        "type": "uint8"
      }
    ],
    "name": "playCard",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "playerToGame",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "protocolId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
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