// Card image mappings and assets
export const CARD_IMAGES = {
  EAGLE: '/card-eagle.png',
  BEAR: '/card-bear.png',
  SNAKE: '/card-snake.png',
  HIDDEN: '/card-back.png',
  UNKNOWN: '/card-unknown.png'
} as const;

// Card emojis as fallback
export const CARD_EMOJIS = {
  EAGLE: '🦅',
  BEAR: '🐻',
  SNAKE: '🐍',
  HIDDEN: '❓',
  UNKNOWN: '❓'
} as const;

// Card type to image mapping
export const getCardImage = (cardType: number, isHidden: boolean = false) => {
  if (isHidden) return CARD_IMAGES.HIDDEN;

  switch (cardType) {
    case 0: return CARD_IMAGES.EAGLE;
    case 1: return CARD_IMAGES.BEAR;
    case 2: return CARD_IMAGES.SNAKE;
    default: return CARD_IMAGES.UNKNOWN;
  }
};

// Card type to emoji mapping
export const getCardEmoji = (cardType: number, isHidden: boolean = false) => {
  if (isHidden) return CARD_EMOJIS.HIDDEN;

  switch (cardType) {
    case 0: return CARD_EMOJIS.EAGLE;
    case 1: return CARD_EMOJIS.BEAR;
    case 2: return CARD_EMOJIS.SNAKE;
    default: return CARD_EMOJIS.UNKNOWN;
  }
};