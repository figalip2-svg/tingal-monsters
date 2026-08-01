export type SavedMove = {
  name: string;
  power: number;
  type?: string;
  pp?: number;
  maxPp?: number;
};

export type SavedMonster = {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  xpToNext: number;
  moves: SavedMove[];
  sprite?: string[];
  scale?: number;
  kind?: string;
};

export type SaveData = {
  selectedStarter?: string;
  coins?: number;
  mapId?: string;
  potions?: number;
  playerLevel?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerAttack?: number;
  playerDefense?: number;
  playerXp?: number;
  playerXpToNext?: number;
  playerX?: number;
  playerY?: number;
  captureItems?: number;
  partyNames?: string[];
  party?: SavedMonster[];
  activePartyIndex?: number;
  trainerDefeated?: boolean;
};

const STORAGE_KEY = 'tingal-save';

export function readSaveData(): SaveData {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : {};
  } catch {
    return {};
  }
}

export function writeSaveData(next: SaveData) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const current = readSaveData();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // Ignore storage access errors in browser-only environments.
  }
}
