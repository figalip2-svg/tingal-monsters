import { createRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PixelArt } from '@/components/PixelArt';
import { PhaserGame } from '@/components/PhaserGame';
import { critter, trainer, palette } from '@/components/monster-sprites';
import { foes } from '@/components/foes';
import { readSaveData, writeSaveData } from '@/lib/storage';
import { rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  head: () => ({
    meta: [
      { title: 'Tingal Monsters — Retro Handheld Monster RPG' },
      { name: 'description', content: 'Tingal Monsters is a 4-color handheld-style monster RPG. Catch, train and battle original creatures across the Verdant Isles.' },
      { property: 'og:title', content: 'Tingal Monsters — Retro Handheld Monster RPG' },
      { property: 'og:description', content: 'Catch, train and battle original creatures in a 4-color retro monster RPG.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: TitleScreen,
});

type ScreenPhase = 'title' | 'starter' | 'overworld' | 'encounter' | 'battle';
type StarterName = 'Pyroshell' | 'Aquataur' | 'Florisaur';
type BattleView = 'menu' | 'moves';

type MonsterState = {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  xpToNext: number;
  moves: Array<{ name: string; power: number }>;
  sprite?: string[];
  scale?: number;
  kind?: string;
};

type BattleState = {
  player: MonsterState;
  enemy: MonsterState;
  view: BattleView;
  log: string;
  status: 'active' | 'won' | 'lost';
};

const MENU = [
  { label: 'START GAME', hint: 'NEW ADVENTURE' },
  { label: 'CONTINUE', hint: 'FILE 1 · 04:21' },
  { label: 'SETTINGS', hint: 'SOUND · SPEED · TEXT' },
];

const STARTERS: Array<{ name: StarterName; title: string; description: string; stats: Omit<MonsterState, 'name' | 'moves' | 'hp' | 'maxHp' | 'xp' | 'xpToNext'> & { hp: number; maxHp: number; xp: number; xpToNext: number }; }> = [
  {
    name: 'Pyroshell',
    title: 'EMBER SHELL',
    description: 'A molten shell beast with strong front-line attacks.',
    stats: { level: 5, hp: 28, maxHp: 28, attack: 8, defense: 6, speed: 5, xp: 0, xpToNext: 18 },
  },
  {
    name: 'Aquataur',
    title: 'TIDE BRUTE',
    description: 'A patient water guardian with steady defenses.',
    stats: { level: 5, hp: 30, maxHp: 30, attack: 7, defense: 7, speed: 4, xp: 0, xpToNext: 18 },
  },
  {
    name: 'Florisaur',
    title: 'GROWTH BORN',
    description: 'A nimble vine beast with burst damage.',
    stats: { level: 5, hp: 26, maxHp: 26, attack: 9, defense: 5, speed: 6, xp: 0, xpToNext: 18 },
  },
];

function createStarterMonster(name: StarterName): MonsterState {
  const starter = STARTERS.find((entry) => entry.name === name)!;
  return {
    name,
    ...starter.stats,
    hp: starter.stats.hp,
    maxHp: starter.stats.maxHp,
    xp: starter.stats.xp,
    xpToNext: starter.stats.xpToNext,
    moves: [
      { name: 'EMBER', power: 6 },
      { name: 'TIDE', power: 5 },
      { name: 'BARK', power: 5 },
      { name: 'GROW', power: 4 },
    ],
  };
}

function createEnemyMonster(name: string): MonsterState {
  const foe = foes.find((entry) => entry.name === name) ?? foes[0];
  const base = {
    hp: foe.maxHp,
    maxHp: foe.maxHp,
    attack: foe.attack,
    defense: foe.defense,
    speed: foe.speed,
    level: foe.level,
    xp: 0,
    xpToNext: 18,
    sprite: foe.sprite,
    scale: foe.scale,
    kind: foe.kind,
  };
  return { name: foe.name, ...base, moves: [{ name: 'PUNCTURE', power: 4 }, { name: 'RUST', power: 3 }] };
}

function Grass() {
  const blades = Array.from({ length: 32 });
  return (
    <div className="pointer-events-none relative w-full">
      <div className="flex h-10 items-end justify-center overflow-hidden">
        {blades.map((_, i) => (
          <div
            key={i}
            className={'relative mx-[1px] w-[8px] origin-bottom ' + (i % 2 === 0 ? 'animate-gb-grass' : 'animate-gb-grass-alt')}
            style={{ height: 16 + ((i * 11) % 20) }}
          >
            <div className="absolute inset-0 bg-gb-2" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gb-3" />
            <div className="absolute left-0 top-0 h-1 w-1 bg-gb-0" />
          </div>
        ))}
      </div>
      <div className="dither h-6 w-full bg-gb-2" />
      <div className="h-2 w-full bg-gb-3" />
    </div>
  );
}

function useTypewriterText(text: string) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!text) {
      setDisplayed('');
      return undefined;
    }
    setDisplayed('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [text]);

  return displayed;
}

function TitleScreen() {
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState<ScreenPhase>('title');
  const [selectedStarter, setSelectedStarter] = useState<StarterName>('Pyroshell');
  const [dialogue, setDialogue] = useState('');
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [battleFlash, setBattleFlash] = useState(false);
  const [battleLog, setBattleLog] = useState('');
  const [encounterName, setEncounterName] = useState('');

  useEffect(() => {
    const saved = readSaveData();
    if (saved.selectedStarter) {
      setSelectedStarter(saved.selectedStarter as StarterName);
    }
  }, []);

  useEffect(() => {
    writeSaveData({ selectedStarter });
  }, [selectedStarter]);

  const typedDialogue = useTypewriterText(dialogue);

  const playerMonster = useMemo(() => createStarterMonster(selectedStarter), [selectedStarter]);

  const startBattle = useCallback((enemyName: string) => {
    const enemy = createEnemyMonster(enemyName);
    const initialBattle: BattleState = {
      player: playerMonster,
      enemy,
      view: 'menu',
      log: `${playerMonster.name} locks eyes with ${enemy.name}.`,
      status: 'active',
    };

    setBattleState(initialBattle);
    setBattleLog(initialBattle.log);
    setBattleFlash(true);
    setPhase('battle');
    window.setTimeout(() => setBattleFlash(false), 220);
  }, [playerMonster]);

  const handleDialogue = useCallback((message: string) => {
    setDialogue(message);
  }, []);

  const handleEncounter = useCallback((enemyName: string) => {
    setEncounterName(enemyName);
    setPhase('encounter');
    window.setTimeout(() => startBattle(enemyName), 720);
  }, [startBattle]);

  const selectStarter = useCallback((starter: StarterName) => {
    setSelectedStarter(starter);
    setPhase('overworld');
    setDialogue(`You chose ${starter}. A guide waits beyond the town gate.`);
  }, []);

  const handleBattleMenu = useCallback((action: 'fight' | 'bag' | 'monsters' | 'run') => {
    if (!battleState) return;

    if (action === 'fight') {
      setBattleState({ ...battleState, view: 'moves' });
      return;
    }

    if (action === 'run') {
      setBattleState(null);
      setBattleLog('');
      setPhase('overworld');
      setDialogue('You slipped away from the encounter.');
      return;
    }

    setBattleState({ ...battleState, view: 'menu', log: `${battleState.player.name} cannot use ${action.toUpperCase()} yet.` });
  }, [battleState]);

  const resolveMove = useCallback((moveIndex: number) => {
    if (!battleState) return;

    const move = battleState.player.moves[moveIndex];
    if (!move) return;

    const damage = Math.max(1, battleState.player.attack + move.power - battleState.enemy.defense);
    const nextEnemyHp = Math.max(0, battleState.enemy.hp - damage);
    const nextEnemy = { ...battleState.enemy, hp: nextEnemyHp };
    const playerLog = `${battleState.player.name} used ${move.name} for ${damage} damage.`;

    if (nextEnemyHp <= 0) {
      const xpGain = battleState.enemy.level * 4 + 2;
      const nextPlayerXp = battleState.player.xp + xpGain;
      let nextLevel = battleState.player.level;
      let remainingXp = nextPlayerXp;
      let levelUps = 0;
      while (remainingXp >= nextLevel * 18) {
        remainingXp -= nextLevel * 18;
        nextLevel += 1;
        levelUps += 1;
      }
      const nextPlayer = {
        ...battleState.player,
        level: nextLevel,
        hp: battleState.player.hp,
        maxHp: battleState.player.maxHp + (levelUps > 0 ? 2 : 0),
        attack: battleState.player.attack + (levelUps > 0 ? 1 : 0),
        defense: battleState.player.defense + (levelUps > 0 ? 1 : 0),
        xp: remainingXp,
        xpToNext: nextLevel * 18,
      };
      const resultLog = `${playerLog}\nVictory! ${battleState.player.name} earned ${xpGain} XP. ${levelUps > 0 ? `Level up! ${battleState.player.name} is now level ${nextLevel}.` : ''}`;
      setBattleState({ ...battleState, player: nextPlayer, enemy: nextEnemy, view: 'menu', log: resultLog, status: 'won' });
      setBattleLog(resultLog);
      window.setTimeout(() => {
        setBattleState(null);
        setBattleLog('');
        setPhase('overworld');
        setDialogue(`${battleState.player.name} rests after the victory. The path continues.`);
      }, 1400);
      return;
    }

    const enemyDamage = Math.max(1, Math.round((battleState.enemy.attack + 2) - battleState.player.defense / 2));
    const nextPlayerHp = Math.max(0, battleState.player.hp - enemyDamage);
    const nextPlayer = { ...battleState.player, hp: nextPlayerHp };
    const enemyLog = `${battleState.enemy.name} countered for ${enemyDamage} damage.`;
    const nextBattle: BattleState = {
      player: nextPlayer,
      enemy: nextEnemy,
      view: 'menu',
      log: `${playerLog}\n${enemyLog}`,
      status: nextPlayerHp <= 0 ? 'lost' : 'active',
    };

    setBattleState(nextBattle);
    setBattleLog(nextBattle.log);
    if (nextPlayerHp <= 0) {
      window.setTimeout(() => {
        setBattleState(null);
        setBattleLog('');
        setPhase('overworld');
        setDialogue('Your starter was defeated. The town healer will restore you.');
      }, 1400);
    }
  }, [battleState]);

  const titleContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <h1 className="sr-only">Tingal Monsters — retro handheld monster RPG</h1>
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0 sm:min-h-[780px]">
          <header className="relative z-10 px-5 pt-10 text-center">
            <div className="mx-auto inline-block bg-gb-3 px-4 py-3">
              <p className="font-pixel text-[26px] leading-[1.35] tracking-tight text-gb-0">TINGAL</p>
              <p className="font-pixel text-[26px] leading-[1.35] tracking-tight text-gb-1">MONSTERS</p>
            </div>
            <p className="mt-3 font-pixel text-[8px] leading-relaxed text-gb-2">VERDANT ISLES EDITION</p>
          </header>

          <section className="relative z-10 mt-6 flex flex-1 flex-col justify-end">
            <div className="flex w-full items-end justify-between px-8 pb-2">
              <div className="animate-gb-idle">
                <PixelArt rows={trainer} palette={palette} scale={5} />
              </div>
              <div className="animate-gb-idle" style={{ animationDelay: '0.55s' }}>
                <PixelArt rows={critter} palette={palette} scale={6} />
              </div>
            </div>
            <Grass />
          </section>

          <nav className="relative z-10 px-4 pb-5 pt-4" aria-label="Main menu">
            <ul className="pixel-box bg-gb-0 p-3">
              {MENU.map((item, i) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    onClick={() => {
                      setSelected(i);
                      if (item.label === 'START GAME') {
                        setPhase('starter');
                      }
                    }}
                    className="flex w-full items-center gap-3 px-2 py-3 text-left outline-none"
                  >
                    <span className={'font-pixel text-[10px] text-gb-3 ' + (selected === i ? 'opacity-100' : 'opacity-0')}>
                      ▶
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-pixel text-[12px] leading-none text-gb-3">{item.label}</span>
                      <span className="mt-2 block truncate font-pixel text-[7px] leading-none text-gb-2">{item.hint}</span>
                    </span>
                  </button>
                  {i < MENU.length - 1 && <div className="mx-2 h-1 bg-gb-1" />}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center font-pixel text-[7px] text-gb-2">
              <span className="animate-gb-press">PRESS START</span>
            </p>
            <p className="mt-2 text-center font-pixel text-[6px] leading-relaxed text-gb-2">
              © 26XX TINGAL WORKS · ALL ORIGINAL MONSTERS
            </p>
          </nav>
        </div>
      </div>
    </main>
  );

  const starterContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0 sm:min-h-[780px]">
          <header className="px-5 pt-8 text-center">
            <p className="font-pixel text-[12px] text-gb-3">STARTER SELECT</p>
            <p className="mt-2 font-pixel text-[7px] leading-relaxed text-gb-2">CHOOSE YOUR FIRST MONSTER</p>
          </header>
          <section className="mt-4 flex-1 px-4 pb-4">
            <div className="grid gap-3">
              {STARTERS.map((starter) => (
                <button
                  key={starter.name}
                  type="button"
                  onClick={() => selectStarter(starter.name)}
                  className="pixel-box bg-gb-0 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-pixel text-[10px] text-gb-3">{starter.name}</p>
                      <p className="mt-1 font-pixel text-[7px] leading-relaxed text-gb-2">{starter.title}</p>
                    </div>
                    <div className="rounded-none border border-gb-3 px-2 py-1 font-pixel text-[7px] text-gb-2">{starter.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );

  const overworldContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0 sm:min-h-[780px]">
          <header className="flex items-center justify-between px-4 pt-4">
            <div>
              <p className="font-pixel text-[10px] text-gb-3">VERDANT TOWN</p>
              <p className="mt-1 font-pixel text-[7px] text-gb-2">{selectedStarter.toUpperCase()}</p>
            </div>
            <button type="button" className="pixel-box bg-gb-0 px-3 py-2 font-pixel text-[7px] text-gb-3" onClick={() => { setPhase('title'); setDialogue(''); setBattleState(null); }}>
              MENU
            </button>
          </header>
          <section className="relative mt-3 flex-1 px-3">
            <PhaserGame phase={phase} selectedStarter={selectedStarter} onDialogue={handleDialogue} onEncounter={handleEncounter} />
            <div className="pointer-events-none absolute left-3 top-3 max-w-[180px] rounded-none border-4 border-gb-3 bg-gb-0/95 p-2">
              <p className="font-pixel text-[7px] leading-relaxed text-gb-3">{typedDialogue || 'Move with arrow keys or the touch D-pad.'}</p>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex justify-between gap-3">
              <div className="pixel-box bg-gb-0 px-3 py-2 font-pixel text-[7px] text-gb-2">D-PAD · TOUCH READY</div>
              <div className="pixel-box bg-gb-0 px-3 py-2 font-pixel text-[7px] text-gb-2">GRASS · 10% STEP</div>
            </div>
            <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 gap-2">
              {[
                ['up', '↑'],
                ['left', '←'],
                ['down', '↓'],
                ['right', '→'],
              ].map(([direction, label]) => (
                <button
                  key={direction}
                  type="button"
                  className="pixel-box bg-gb-0 px-3 py-2 font-pixel text-[10px] text-gb-3"
                  onClick={() => {
                    if (phase === 'overworld' && battleState === null) {
                      window.dispatchEvent(new CustomEvent('tingal-move', { detail: direction }));
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );

  const battleContent = battleState ? (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0 sm:min-h-[780px]">
          <div className="absolute inset-0 z-0 bg-gb-2" />
          <div className="relative z-10 flex-1 p-4">
            <div className="pixel-box bg-gb-0 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-pixel text-[9px] text-gb-3">{battleState.enemy.name}</p>
                  <p className="mt-1 font-pixel text-[7px] text-gb-2">LV {battleState.enemy.level}</p>
                </div>
                <div className={battleState.enemy.hp === 0 ? 'animate-gb-press opacity-25' : 'animate-gb-idle'}>
                  {battleState.enemy.sprite && <PixelArt rows={battleState.enemy.sprite} palette={palette} scale={battleState.enemy.scale ?? 5} />}
                </div>
                <div className="w-[120px]">
                  <div className="h-3 border border-gb-3 bg-gb-1">
                    <div className="h-full bg-gb-3 transition-all duration-300" style={{ width: `${(battleState.enemy.hp / battleState.enemy.maxHp) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-right font-pixel text-[7px] text-gb-2">{battleState.enemy.hp}/{battleState.enemy.maxHp} HP</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pixel-box bg-gb-0 p-3">
              <div className="flex items-end justify-between">
                <div className="animate-gb-idle">
                  <PixelArt rows={critter} palette={palette} scale={5} />
                </div>
                <div>
                  <p className="font-pixel text-[9px] text-gb-3">{battleState.player.name}</p>
                  <p className="mt-1 font-pixel text-[7px] text-gb-2">LV {battleState.player.level}</p>
                </div>
                <div className="w-[120px]">
                  <div className="h-3 border border-gb-3 bg-gb-1">
                    <div className="h-full bg-gb-3 transition-all duration-300" style={{ width: `${(battleState.player.hp / battleState.player.maxHp) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-right font-pixel text-[7px] text-gb-2">{battleState.player.hp}/{battleState.player.maxHp} HP</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pixel-box bg-gb-0 p-3">
              {battleState.view === 'menu' ? (
                <div className="grid gap-2">
                  <button type="button" className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3" onClick={() => handleBattleMenu('fight')}>FIGHT</button>
                  <button type="button" className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3" onClick={() => handleBattleMenu('bag')}>BAG</button>
                  <button type="button" className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3" onClick={() => handleBattleMenu('monsters')}>MONSTERS</button>
                  <button type="button" className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3" onClick={() => handleBattleMenu('run')}>RUN</button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {battleState.player.moves.map((move, index) => (
                    <button key={move.name} type="button" className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3" onClick={() => resolveMove(index)}>{move.name}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-none border-4 border-gb-3 bg-gb-0 p-3">
              <p className="font-pixel text-[7px] leading-relaxed text-gb-2">{battleLog}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  ) : null;

  const encounterContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col items-center justify-center overflow-hidden border-8 border-gb-3 bg-gb-0">
          <div className="animate-gb-grass-alt">
            <Grass />
          </div>
          <p className="mt-8 animate-gb-press font-pixel text-[10px] text-gb-3">RUSTLING GRASS...</p>
          <p className="mt-3 font-pixel text-[7px] text-gb-2">{encounterName} APPROACHES</p>
        </div>
      </div>
    </main>
  );

  return (
    <>
      {phase === 'title' && titleContent}
      {phase === 'starter' && starterContent}
      {phase === 'overworld' && overworldContent}
      {phase === 'encounter' && encounterContent}
      {phase === 'battle' && battleContent}
      {battleFlash && <div className="pointer-events-none fixed inset-0 z-50 bg-white/90" />}
    </>
  );
}
