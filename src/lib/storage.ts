type SaveData = {
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
