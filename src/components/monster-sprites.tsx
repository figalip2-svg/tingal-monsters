export const GB = {
  L: "var(--gb-0)", M: "var(--gb-1)", D: "var(--gb-2)", K: "var(--gb-3)",
} as const;

export const palette = { l: GB.L, m: GB.M, d: GB.D, k: GB.K };

/** "Tingal" — originalno stvorenje, 16x16 */
export const critter = [
  "......kk........",
  ".....kmmk...kk..",
  "....kmmmmkkmmk..",
  "...kmmmmmmmmmk..",
  "..kmmllmmllmmk..",
  "..kmlkllmlkllmk.",
  "..kmmllmmllmmk..",
  "..kmmmmmmmmmmk..",
  "..kmdmmmmmmdmk..",
  "...kmmdddddmmk..",
  "...kmmmmmmmmk...",
  "..kmmkkmmkkmmk..",
  "..kmmk.kk.kmmk..",
  "..kkk......kkk..",
  "................",
  "................",
];

/** Igrač (trener), 12x16 */
export const trainer = [
  "....kkkk....",
  "...kmmmmk...",
  "..kmmmmmmk..",
  "..kmllllmk..",
  "..kmlklklk..",
  "..kmllllmk..",
  "...kmmmmk...",
  "..kkdddd kk.",
  ".kmdddddd mk",
  ".kmdddddd mk",
  "..kdddddd k.",
  "..kddddddk..",
  "..kmmk kmmk.",
  "..kmmk kmmk.",
  "..kkk...kkk.",
  "............",
];
