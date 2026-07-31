export type FoeSprite = {
  name: string;
  kind: string;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string[];
  scale: number;
};

export const foes: FoeSprite[] = [
  {
    name: 'EMBERFANG',
    kind: 'FIRE',
    level: 3,
    maxHp: 18,
    attack: 6,
    defense: 4,
    speed: 5,
    scale: 5,
    sprite: [
      '....kk....',
      '...kmmk...',
      '..kmmmmk..',
      '.kmmllmmk.',
      'kmmkllkmmk',
      'kmmmmmmmmk',
      '.kmmkkmmk.',
      '..kk..kk..',
      '..........',
    ],
  },
  {
    name: 'GLIMMOTH',
    kind: 'AIR',
    level: 4,
    maxHp: 20,
    attack: 7,
    defense: 3,
    speed: 7,
    scale: 5,
    sprite: [
      '...kk.....',
      '..kmmk....',
      '.kmmmmk...',
      'kmmllmmkk.',
      'kmmmmmmmk.',
      '.kmmddmmk.',
      '..kmmmmk..',
      '...kkkk...',
      '..........',
    ],
  },
  {
    name: 'CRAGHORN',
    kind: 'STONE',
    level: 5,
    maxHp: 25,
    attack: 8,
    defense: 7,
    speed: 2,
    scale: 5,
    sprite: [
      '...kkkk...',
      '..kmmmmk..',
      '.kmmddmmk.',
      'kmmmmmmmmk',
      'kmmkmmkmmk',
      'kmmmmmmmmk',
      '.kmmkkkkk.',
      '..kmm..k..',
      '..........',
    ],
  },
  {
    name: 'RIPPLEFIN',
    kind: 'WATER',
    level: 3,
    maxHp: 19,
    attack: 5,
    defense: 5,
    speed: 6,
    scale: 5,
    sprite: [
      '....kk....',
      '...kmmk...',
      '..kmmmmkk.',
      '.kmmllmmmk',
      'kmmmmmmmmk',
      '.kmmddmmk.',
      '..kmmmmk..',
      '...kkkk...',
      '..........',
    ],
  },
];
