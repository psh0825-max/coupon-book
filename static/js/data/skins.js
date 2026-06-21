// data/skins.js — skin + category data (pure). renderSkinSelector moved to ui.

export const SKINS = {
  stone: {
    name: '아쿠아',
    desc: '병원, 클리닉',
    color: '#22d3ee',
    icon: '🏥'
  },
  sage: {
    name: '블루',
    desc: '마사지, 찜질방',
    color: '#3b82f6',
    icon: '🧘'
  },
  espresso: {
    name: '선셋',
    desc: '카페, 벌크',
    color: '#fb923c',
    icon: '☕'
  },
  midnight: {
    name: '바이올렛',
    desc: '고급 마사지, 호텔',
    color: '#818cf8',
    icon: '🌙'
  },
  coral: {
    name: '로즈',
    desc: '식당, 패스트푸드',
    color: '#fb7185',
    icon: '🍕'
  }
};

export const CATEGORIES = {
  '찜질방': { icon: '🧘', defaultSkin: 'sage' },
  '마사지': { icon: '💆', defaultSkin: 'sage' },
  '병원': { icon: '🏥', defaultSkin: 'stone' },
  '카페': { icon: '☕', defaultSkin: 'espresso' },
  '식당': { icon: '🍽️', defaultSkin: 'coral' },
  '기타': { icon: '🏪', defaultSkin: 'midnight' }
};

export function getCategoryIcon(cat) {
  return CATEGORIES[cat]?.icon || '🏪';
}

export function getDefaultSkin(cat) {
  return CATEGORIES[cat]?.defaultSkin || 'midnight';
}
