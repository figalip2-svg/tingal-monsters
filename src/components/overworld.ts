/** Detailed Route 1 tile data for the Verdant Isles overworld. */
export type Tile = '.' | 'g' | 't' | 'w' | 'h' | 's' | 'f';

export const MAP: string[] = [
  'tttttttttttttttt',
  't....gg....ttttt',
  't.hh.gg.....s..t',
  't.hh........gg.t',
  't...........gg.t',
  't.gggg..tt.....t',
  't.gggg..tt..ff.t',
  't.......tt..ff.t',
  't..s...........t',
  't.....gggg.....t',
  't.....gggg..tt.t',
  't...........tt.t',
  't.wwww.........t',
  't.wwww....gggg.t',
  't.wwww....gggg.t',
  't..........s...t',
  't..hh..........t',
  'tttttttttttttttt',
];

export const WIDTH = MAP[0].length;
export const HEIGHT = MAP.length;
export const SOLID: ReadonlySet<Tile> = new Set(['t', 'w', 'h', 'f']);

export function tileAt(x: number, y: number): Tile {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return 't';
  return MAP[y][x] as Tile;
}

export function walkable(x: number, y: number) {
  return !SOLID.has(tileAt(x, y));
}

export const SIGNS: Record<string, string> = {
  '12,2': 'ROUTE 1 - TALL GRASS AHEAD. WILD TINGALS LURK!',
  '3,8': 'VERDANT ISLES - POPULATION: MOSTLY MONSTERS.',
  '11,15': 'SOUTH SHORE. THE TIDE CREATURES SWIM HERE.',
};

export const ENCOUNTER_RATE = 0.18;
