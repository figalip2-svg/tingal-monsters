import { createRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PixelArt } from '@/components/PixelArt';
import { PhaserGame } from '@/components/PhaserGame';
import { critter, trainer, palette } from '@/components/monster-sprites';
import { foes } from '@/components/foes';
import type { SavedMonster } from '@/lib/storage';
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

type ScreenPhase = 'title' | 'starter' | 'overworld' | 'encounter' | 'battle' | 'reward' | 'party' | 'shop' | 'settings';
type StarterName = 'Pyroshell' | 'Aquataur' | 'Florisaur';
type BattleView = 'menu' | 'moves';
type MoveState = { name: string; power: number; type: string; pp: number; maxPp: number };

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
  moves: MoveState[];
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
  turn: 'ready' | 'busy';
  canCapture: boolean;
};

type RewardState = {
  foeName: string;
  xp: number;
  coins: number;
  level: number;
  leveledUp: boolean;
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
  const moveTypes: Record<string, string> = { EMBER: 'FIRE', TIDE: 'WATER', BARK: 'GRASS', GROW: 'GRASS' };
  return {
    name,
    ...starter.stats,
    hp: starter.stats.hp,
    maxHp: starter.stats.maxHp,
    xp: starter.stats.xp,
    xpToNext: starter.stats.xpToNext,
    kind: name === 'Pyroshell' ? 'FIRE' : name === 'Aquataur' ? 'WATER' : 'GRASS',
    moves: [
      { name: 'EMBER', power: 6, type: moveTypes.EMBER, pp: 12, maxPp: 12 },
      { name: 'TIDE', power: 5, type: moveTypes.TIDE, pp: 14, maxPp: 14 },
      { name: 'BARK', power: 5, type: moveTypes.BARK, pp: 16, maxPp: 16 },
      { name: 'GROW', power: 4, type: moveTypes.GROW, pp: 20, maxPp: 20 },
    ],
  };
}

function createEnemyMonster(name: string, trainerBattle = false): MonsterState {
  if (name === 'TRAINER_RUNE') {
    const monster = createEnemyMonster('GLIMMOTH');
    return {
      ...monster,
      name: 'RUNE\'S GLIMMOTH',
      level: 6,
      maxHp: 26,
      hp: 26,
      attack: 9,
      defense: 5,
      speed: 8,
      moves: [
        { name: 'GUST', power: 6, type: 'AIR', pp: 15, maxPp: 15 },
        { name: 'PECK', power: 4, type: 'AIR', pp: 20, maxPp: 20 },
      ],
    };
  }
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
  return {
    name: foe.name,
    ...base,
    moves: [
      { name: 'PUNCTURE', power: 4, type: foe.kind, pp: 15, maxPp: 15 },
      { name: 'RUST', power: 3, type: 'STONE', pp: 18, maxPp: 18 },
    ],
    kind: trainerBattle ? 'TRAINER' : foe.kind,
  };
}

function toSavedMonster(monster: MonsterState): SavedMonster {
  return {
    ...monster,
    moves: monster.moves.map((move) => ({ ...move })),
  };
}

function fromSavedMonster(saved: SavedMonster): MonsterState {
  return {
    ...saved,
    moves: saved.moves.map((move) => ({
      ...move,
      type: move.type ?? 'NORMAL',
      pp: move.pp ?? move.maxPp ?? 10,
      maxPp: move.maxPp ?? move.pp ?? 10,
    })),
  };
}

const TYPE_ADVANTAGE: Record<string, string> = {
  FIRE: 'GRASS',
  WATER: 'FIRE',
  GRASS: 'WATER',
  AIR: 'GRASS',
  STONE: 'AIR',
};

function typeMultiplier(moveType: string, targetKind: string | undefined) {
  if (TYPE_ADVANTAGE[moveType] === targetKind) return 1.35;
  if (TYPE_ADVANTAGE[targetKind ?? ''] === moveType) return 0.75;
  return 1;
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
  const [playerProgress, setPlayerProgress] = useState<MonsterState>(() => createStarterMonster('Pyroshell'));
  const [party, setParty] = useState<MonsterState[]>(() => [createStarterMonster('Pyroshell')]);
  const [activePartyIndex, setActivePartyIndex] = useState(0);
  const [dialogue, setDialogue] = useState('');
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [battleFlash, setBattleFlash] = useState(false);
  const [battleLog, setBattleLog] = useState('');
  const [encounterName, setEncounterName] = useState('');
  const [coins, setCoins] = useState(0);
  const [reward, setReward] = useState<RewardState | null>(null);
  const [potions, setPotions] = useState(3);
  const [captureItems, setCaptureItems] = useState(5);
  const [mapName, setMapName] = useState('VERDANT TOWN');
  const [mapId, setMapId] = useState<'town' | 'route' | 'grove'>('town');
  const [spawnPosition, setSpawnPosition] = useState({ x: 1, y: 1 });
  const [returnPhase, setReturnPhase] = useState<ScreenPhase>('title');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [trainerDefeated, setTrainerDefeated] = useState(false);

  useEffect(() => {
    const saved = readSaveData();
    if (saved.selectedStarter) {
      const savedStarter = saved.selectedStarter as StarterName;
      setSelectedStarter(savedStarter);
      const starter = createStarterMonster(savedStarter);
      const legacyStarterProgress = {
        ...starter,
        level: saved.playerLevel ?? starter.level,
        hp: saved.playerHp ?? starter.hp,
        maxHp: saved.playerMaxHp ?? starter.maxHp,
        attack: saved.playerAttack ?? starter.attack,
        defense: saved.playerDefense ?? starter.defense,
        xp: saved.playerXp ?? starter.xp,
        xpToNext: saved.playerXpToNext ?? starter.xpToNext,
      };
      const savedParty = saved.party?.map(fromSavedMonster)
        ?? (saved.partyNames ?? []).map((name) => createEnemyMonster(name));
      const starterProgress = saved.party?.[0]?.name === starter.name
        ? savedParty[0]
        : legacyStarterProgress;
      const savedPartyMembers = savedParty[0]?.name === starter.name ? savedParty.slice(1) : savedParty;
      const nextParty = [starterProgress, ...savedPartyMembers];
      const nextActiveIndex = Math.min(saved.activePartyIndex ?? 0, nextParty.length - 1);
      setParty(nextParty);
      setActivePartyIndex(nextActiveIndex);
      setPlayerProgress(nextParty[nextActiveIndex]);
    }
    if (saved.mapId === 'route' || saved.mapId === 'grove') {
      setMapId(saved.mapId);
      setMapName(saved.mapId === 'route' ? 'SUNLIT ROUTE' : 'MOSSHEART GROVE');
    }
    setSpawnPosition({ x: saved.playerX ?? 1, y: saved.playerY ?? 1 });
    setCoins(saved.coins ?? 0);
    setPotions(saved.potions ?? 3);
    setCaptureItems(saved.captureItems ?? 5);
    setTrainerDefeated(saved.trainerDefeated ?? false);
  }, []);

  useEffect(() => {
    writeSaveData({ selectedStarter });
  }, [selectedStarter]);

  const typedDialogue = useTypewriterText(dialogue);

  const playerMonster = useMemo(() => party[activePartyIndex] ?? playerProgress, [activePartyIndex, party, playerProgress]);

  const persistParty = useCallback((nextParty: MonsterState[], nextActiveIndex = activePartyIndex) => {
    setParty(nextParty);
    setActivePartyIndex(nextActiveIndex);
    writeSaveData({
      party: nextParty.map(toSavedMonster),
      partyNames: nextParty.slice(1).map((monster) => monster.name),
      activePartyIndex: nextActiveIndex,
    });
  }, [activePartyIndex]);

  const updateActiveMonster = useCallback((nextMonster: MonsterState) => {
    const nextParty = party.map((monster, index) => index === activePartyIndex ? nextMonster : monster);
    persistParty(nextParty);
    setPlayerProgress(nextMonster);
  }, [activePartyIndex, party, persistParty]);

  const startBattle = useCallback((enemyName: string, canCapture = true) => {
    const enemy = createEnemyMonster(enemyName);
    setReward(null);
    const initialBattle: BattleState = {
      player: playerMonster,
      enemy,
      view: 'menu',
      log: `${playerMonster.name} locks eyes with ${enemy.name}.`,
      status: 'active',
      turn: 'ready',
      canCapture,
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

  const handleMapChange = useCallback((name: string) => {
    setMapName(name);
    const nextMapId = name === 'SUNLIT ROUTE' ? 'route' : name === 'MOSSHEART GROVE' ? 'grove' : 'town';
    if (nextMapId !== mapId) {
      setSpawnPosition(nextMapId === 'town' ? { x: 14, y: 10 } : { x: 1, y: 10 });
    }
    setMapId(nextMapId);
    writeSaveData({ mapId: nextMapId });
  }, [mapId]);

  const handlePlayerPosition = useCallback((nextMapId: string, x: number, y: number) => {
    writeSaveData({ mapId: nextMapId, playerX: x, playerY: y });
  }, []);

  const handleEncounter = useCallback((enemyName: string) => {
    setEncounterName(enemyName);
    setPhase('encounter');
    window.setTimeout(() => startBattle(enemyName), 720);
  }, [startBattle]);

  const handleHeal = useCallback(() => {
    const healedParty = party.map((monster) => ({ ...monster, hp: monster.maxHp }));
    persistParty(healedParty);
    setPlayerProgress(healedParty[activePartyIndex] ?? healedParty[0]);
    setDialogue('The healer restored every Tingal to full health!');
  }, [activePartyIndex, party, persistParty]);

  const handleShop = useCallback(() => {
    setReturnPhase('overworld');
    setPhase('shop');
    setDialogue('Welcome to the item shop. Spend coins to prepare for the wilds.');
  }, []);

  const handleTrainerBattle = useCallback((enemyName: string) => {
    if (trainerDefeated || battleState) return;
    setEncounterName('TRAINER RUNE');
    setPhase('encounter');
    window.setTimeout(() => startBattle(enemyName, false), 720);
  }, [battleState, startBattle, trainerDefeated]);

  const selectStarter = useCallback((starter: StarterName) => {
    const nextStarter = createStarterMonster(starter);
    setSelectedStarter(starter);
    setPlayerProgress(nextStarter);
    setSpawnPosition({ x: 1, y: 1 });
    setActivePartyIndex(0);
    setParty([nextStarter]);
    setCaptureItems(5);
    setTrainerDefeated(false);
    writeSaveData({
      selectedStarter: starter,
      mapId: 'town',
      playerX: 1,
      playerY: 1,
      potions: 3,
      captureItems: 5,
      coins: 0,
      party: [toSavedMonster(nextStarter)],
      partyNames: [],
      activePartyIndex: 0,
      trainerDefeated: false,
    });
    setPotions(3);
    setCoins(0);
    setPhase('overworld');
    setDialogue(`You chose ${starter}. A guide waits beyond the town gate.`);
  }, []);

  const handleBattleMenu = useCallback((action: 'fight' | 'bag' | 'monsters' | 'capture' | 'run') => {
    if (!battleState) return;

    if (action === 'fight') {
      setBattleState({ ...battleState, view: 'moves' });
      return;
    }

    if (action === 'bag') {
      if (potions <= 0) {
        const log = 'THE BAG IS EMPTY.';
        setBattleState({ ...battleState, log });
        setBattleLog(log);
      } else if (battleState.player.hp >= battleState.player.maxHp) {
        const log = 'HP IS ALREADY FULL.';
        setBattleState({ ...battleState, log });
        setBattleLog(log);
      } else {
        const healed = Math.min(8, battleState.player.maxHp - battleState.player.hp);
        const healedPlayer = { ...battleState.player, hp: battleState.player.hp + healed };
        setPotions((current) => {
          const next = current - 1;
          writeSaveData({ potions: next });
          return next;
        });
        updateActiveMonster(healedPlayer);
        const log = `${battleState.player.name} recovered ${healed} HP.`;
        setBattleState({
          ...battleState,
          player: healedPlayer,
          log,
        });
        setBattleLog(log);
      }
      return;
    }

    if (action === 'monsters') {
      setReturnPhase('battle');
      setPhase('party');
      return;
    }

    if (action === 'capture') {
      if (!battleState.canCapture) {
        const log = 'TRAINER TINGALS CANNOT BE CAPTURED.';
        setBattleState({ ...battleState, log });
        setBattleLog(log);
        return;
      }
      if (captureItems <= 0) {
        const log = 'NO CAPTURE ITEMS LEFT.';
        setBattleState({ ...battleState, log });
        setBattleLog(log);
        return;
      }
      const remainingHpRatio = battleState.enemy.hp / battleState.enemy.maxHp;
      const captureChance = Math.min(0.9, 0.35 + (1 - remainingHpRatio) * 0.55);
      const captured = Math.random() < captureChance;
      const nextCaptureItems = captureItems - 1;
      setCaptureItems(nextCaptureItems);
      writeSaveData({ captureItems: nextCaptureItems });
      setBattleState({ ...battleState, turn: 'busy', log: 'YOU THREW A CAPTURE CAPSULE!' });
      setBattleLog('YOU THREW A CAPTURE CAPSULE!');
      window.setTimeout(() => {
        if (captured && party.length < 6) {
          const capturedMonster = { ...battleState.enemy, hp: battleState.enemy.maxHp };
          const nextParty = [...party, capturedMonster];
          persistParty(nextParty);
          const log = `${battleState.enemy.name} was captured and joined your party!`;
          setBattleState({ ...battleState, log, status: 'won', turn: 'ready' });
          setBattleLog(log);
          window.setTimeout(() => {
            setBattleState(null);
            setBattleLog('');
            setPhase('overworld');
            setDialogue(log);
          }, 1200);
          return;
        }

        const breakLog = captured ? `${battleState.enemy.name} was captured, but your party is full.` : `${battleState.enemy.name} broke free!`;
        const enemyMove = battleState.enemy.moves[Math.floor(Math.random() * battleState.enemy.moves.length)];
        const damage = Math.max(1, Math.round(battleState.enemy.attack + enemyMove.power - battleState.player.defense / 2));
        const nextHp = Math.max(0, battleState.player.hp - damage);
        const nextPlayer = { ...battleState.player, hp: nextHp };
        updateActiveMonster(nextPlayer);
        const log = `${breakLog}\n${battleState.enemy.name} struck back for ${damage} damage.`;
        if (nextHp <= 0) {
          const lostBattle: BattleState = { ...battleState, player: nextPlayer, turn: 'ready', log: `${log}\n${nextPlayer.name} fainted.`, status: 'lost' };
          setBattleState(lostBattle);
          setBattleLog(lostBattle.log);
          window.setTimeout(() => {
            setBattleState(null);
            setBattleLog('');
            setPhase('overworld');
            setDialogue('Your Tingal fainted. Visit the healer in town.');
          }, 1400);
        } else {
          const nextBattle: BattleState = { ...battleState, player: nextPlayer, turn: 'ready', log, view: 'menu' };
          setBattleState(nextBattle);
          setBattleLog(log);
        }
      }, 420);
      return;
    }

    if (action === 'run') {
      setBattleState(null);
      setBattleLog('');
      setPhase('overworld');
      setDialogue('You slipped away from the encounter.');
      return;
    }

    setBattleState({ ...battleState, view: 'menu', log: `${battleState.player.name} cannot use ${String(action).toUpperCase()} yet.` });
  }, [activePartyIndex, battleState, captureItems, party, persistParty, potions, updateActiveMonster]);

  const selectPartyMember = useCallback((index: number) => {
    const target = party[index];
    if (!target || target.hp <= 0) {
      setDialogue('That Tingal cannot battle right now.');
      return;
    }
    if (index === activePartyIndex) {
      setDialogue(`${target.name} is already leading the party.`);
      if (!battleState) setPhase(returnPhase);
      return;
    }

    setActivePartyIndex(index);
    setPlayerProgress(target);
    writeSaveData({ activePartyIndex: index });
    if (returnPhase !== 'battle' || !battleState) {
      setPhase(returnPhase);
      return;
    }

    const switchLog = `Go, ${target.name}!`;
    setBattleState({ ...battleState, player: target, turn: 'busy', view: 'menu', log: switchLog });
    setBattleLog(switchLog);
    window.setTimeout(() => {
      const enemyMove = battleState.enemy.moves[Math.floor(Math.random() * battleState.enemy.moves.length)];
      const damage = Math.max(1, Math.round(battleState.enemy.attack + enemyMove.power - target.defense / 2));
      const nextTarget = { ...target, hp: Math.max(0, target.hp - damage) };
      const nextParty = party.map((monster, partyIndex) => partyIndex === index ? nextTarget : monster);
      persistParty(nextParty, index);
      setPlayerProgress(nextTarget);
      const log = `${switchLog}\n${battleState.enemy.name} hit for ${damage} damage.`;
      if (nextTarget.hp <= 0) {
        const lostLog = `${log}\n${nextTarget.name} fainted.`;
        setBattleState({ ...battleState, player: nextTarget, turn: 'ready', log: lostLog, status: 'lost' });
        setBattleLog(lostLog);
        window.setTimeout(() => {
          setBattleState(null);
          setBattleLog('');
          setPhase('overworld');
          setDialogue('Your Tingal fainted. Visit the healer in town.');
        }, 1400);
      } else {
        setBattleState({ ...battleState, player: nextTarget, turn: 'ready', view: 'menu', log });
        setBattleLog(log);
      }
    }, 320);
    setPhase('battle');
  }, [activePartyIndex, battleState, party, persistParty, returnPhase]);

  const resolveMove = useCallback((moveIndex: number) => {
    if (!battleState || battleState.status !== 'active' || battleState.turn === 'busy') return;

    const move = battleState.player.moves[moveIndex];
    if (!move) return;
    if (move.pp <= 0) {
      const log = `${move.name} has no PP left.`;
      setBattleState({ ...battleState, view: 'moves', log });
      setBattleLog(log);
      return;
    }

    const enemyMove = battleState.enemy.moves[Math.floor(Math.random() * battleState.enemy.moves.length)];
    const usedPlayer = {
      ...battleState.player,
      moves: battleState.player.moves.map((entry, index) => index === moveIndex ? { ...entry, pp: entry.pp - 1 } : entry),
    };
    const playerMultiplier = typeMultiplier(move.type, battleState.enemy.kind);
    const enemyMultiplier = typeMultiplier(enemyMove.type, battleState.player.kind);
    const playerDamage = Math.max(1, Math.round((usedPlayer.attack + move.power - battleState.enemy.defense) * playerMultiplier));
    const enemyDamage = Math.max(1, Math.round((battleState.enemy.attack + enemyMove.power - battleState.player.defense / 2) * enemyMultiplier));
    const playerActsFirst = battleState.player.speed >= battleState.enemy.speed;
    const advantageLog = playerMultiplier > 1 ? ' It is super effective!' : playerMultiplier < 1 ? ' It is not very effective.' : '';
    const playerLog = `${battleState.player.name} used ${move.name} for ${playerDamage} damage.${advantageLog}`;
    const enemyLog = `${battleState.enemy.name} used ${enemyMove.name} for ${enemyDamage} damage.`;

    const finishVictory = (winningPlayer: MonsterState, defeatedEnemy: MonsterState, log: string) => {
      const xpGain = battleState.enemy.level * 4 + 2;
      const nextPlayerXp = winningPlayer.xp + xpGain;
      let nextLevel = winningPlayer.level;
      let remainingXp = nextPlayerXp;
      let levelUps = 0;
      while (remainingXp >= nextLevel * 18) {
        remainingXp -= nextLevel * 18;
        nextLevel += 1;
        levelUps += 1;
      }
      const nextPlayer = {
        ...winningPlayer,
        level: nextLevel,
        maxHp: winningPlayer.maxHp + (levelUps > 0 ? 2 : 0),
        attack: winningPlayer.attack + (levelUps > 0 ? 1 : 0),
        defense: winningPlayer.defense + (levelUps > 0 ? 1 : 0),
        xp: remainingXp,
        xpToNext: nextLevel * 18,
      };
      const resultLog = `${log}\nVictory! ${battleState.player.name} earned ${xpGain} XP. ${levelUps > 0 ? `Level up! ${battleState.player.name} is now level ${nextLevel}.` : ''}`;
      updateActiveMonster(nextPlayer);
      writeSaveData({
        playerLevel: nextPlayer.level,
        playerHp: nextPlayer.hp,
        playerMaxHp: nextPlayer.maxHp,
        playerAttack: nextPlayer.attack,
        playerDefense: nextPlayer.defense,
        playerXp: nextPlayer.xp,
        playerXpToNext: nextPlayer.xpToNext,
      });
      setBattleState({ ...battleState, player: nextPlayer, enemy: defeatedEnemy, view: 'menu', log: resultLog, status: 'won', turn: 'ready' });
      setBattleLog(resultLog);
      const coinReward = 5 + battleState.enemy.level * 2;
      setCoins((currentCoins) => {
        const totalCoins = currentCoins + coinReward;
        writeSaveData({ coins: totalCoins });
        return totalCoins;
      });
      setReward({
        foeName: battleState.enemy.name,
        xp: xpGain,
        coins: coinReward,
        level: nextLevel,
        leveledUp: levelUps > 0,
      });
      if (!battleState.canCapture) {
        setTrainerDefeated(true);
        writeSaveData({ trainerDefeated: true });
      }
      setPhase('reward');
    };

    setBattleState({ ...battleState, view: 'moves', turn: 'busy', log: playerActsFirst ? playerLog : `${battleState.enemy.name} is faster.` });
    setBattleLog(playerActsFirst ? playerLog : `${battleState.enemy.name} is faster.`);
    setBattleFlash(true);

    window.setTimeout(() => {
      const firstPlayerHp = playerActsFirst
        ? battleState.player.hp
        : Math.max(0, battleState.player.hp - enemyDamage);
      const firstEnemyHp = playerActsFirst
        ? Math.max(0, battleState.enemy.hp - playerDamage)
        : battleState.enemy.hp;

      if (firstPlayerHp <= 0) {
        const defeatedPlayer = { ...usedPlayer, hp: 0 };
        updateActiveMonster(defeatedPlayer);
        const lostBattle: BattleState = {
          ...battleState,
          player: defeatedPlayer,
          view: 'menu',
          turn: 'ready',
          log: `${enemyLog}\n${battleState.player.name} fainted.`,
          status: 'lost',
        };
        setBattleState(lostBattle);
        setBattleLog(lostBattle.log);
        setBattleFlash(false);
        window.setTimeout(() => {
          setBattleState(null);
          setBattleLog('');
          setPhase('overworld');
          setDialogue('Your starter was defeated. The town healer will restore you.');
        }, 1400);
        return;
      }

      if (firstEnemyHp <= 0) {
        const winningPlayer = { ...usedPlayer, hp: firstPlayerHp };
        finishVictory(winningPlayer, { ...battleState.enemy, hp: 0 }, playerActsFirst ? playerLog : `${enemyLog}\n${playerLog}`);
        setBattleFlash(false);
        return;
      }

      const nextPlayerHp = playerActsFirst
        ? Math.max(0, firstPlayerHp - enemyDamage)
        : firstPlayerHp;
      const nextEnemyHp = playerActsFirst
        ? firstEnemyHp
        : Math.max(0, firstEnemyHp - playerDamage);
      const nextPlayer = { ...usedPlayer, hp: nextPlayerHp };
      const nextEnemy = { ...battleState.enemy, hp: nextEnemyHp };
      const nextLog = playerActsFirst ? `${playerLog}\n${enemyLog}` : `${enemyLog}\n${playerLog}`;

      if (nextEnemyHp <= 0) {
        finishVictory(nextPlayer, nextEnemy, nextLog);
      } else if (nextPlayerHp <= 0) {
        updateActiveMonster(nextPlayer);
        const lostBattle: BattleState = { ...battleState, player: nextPlayer, enemy: nextEnemy, view: 'menu', turn: 'ready', log: `${nextLog}\n${battleState.player.name} fainted.`, status: 'lost' };
        setBattleState(lostBattle);
        setBattleLog(lostBattle.log);
        window.setTimeout(() => {
          setBattleState(null);
          setBattleLog('');
          setPhase('overworld');
          setDialogue('Your starter was defeated. The town healer will restore you.');
        }, 1400);
      } else {
        updateActiveMonster(nextPlayer);
        const nextBattle: BattleState = { ...battleState, player: nextPlayer, enemy: nextEnemy, view: 'menu', turn: 'ready', log: nextLog, status: 'active' };
        setBattleState(nextBattle);
        setBattleLog(nextBattle.log);
      }
      setBattleFlash(false);
    }, 320);
  }, [battleState, updateActiveMonster]);

  const continueAfterReward = useCallback(() => {
    if (!reward) return;
    setReward(null);
    setBattleState(null);
    setBattleLog('');
    setPhase('overworld');
    setDialogue(`${battleState?.player.name ?? selectedStarter} rests after the victory. The path continues.`);
  }, [battleState, reward, selectedStarter]);

  const purchaseItem = useCallback((item: 'potion' | 'capture') => {
    const price = item === 'potion' ? 8 : 12;
    if (coins < price) {
      setDialogue('Not enough coins for that item.');
      return;
    }
    const nextCoins = coins - price;
    setCoins(nextCoins);
    if (item === 'potion') setPotions((count) => count + 1);
    else setCaptureItems((count) => count + 1);
    writeSaveData({
      coins: nextCoins,
      potions: item === 'potion' ? potions + 1 : potions,
      captureItems: item === 'capture' ? captureItems + 1 : captureItems,
    });
    setDialogue(`Purchased ${item === 'potion' ? 'a potion' : 'a capture capsule'}.`);
  }, [captureItems, coins, potions]);

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
                      } else if (item.label === 'CONTINUE') {
                        const saved = readSaveData();
                        if (saved.selectedStarter) {
                          setSelectedStarter(saved.selectedStarter as StarterName);
                          setCoins(saved.coins ?? 0);
                          setPotions(saved.potions ?? 3);
                          setCaptureItems(saved.captureItems ?? 5);
                          setTrainerDefeated(saved.trainerDefeated ?? false);
                          if (saved.party) {
                            const nextParty = saved.party.map(fromSavedMonster);
                            const nextIndex = Math.min(saved.activePartyIndex ?? 0, nextParty.length - 1);
                            setParty(nextParty);
                            setActivePartyIndex(nextIndex);
                            setPlayerProgress(nextParty[nextIndex]);
                          }
                          if (saved.mapId === 'route' || saved.mapId === 'grove') {
                            setMapId(saved.mapId);
                            setMapName(saved.mapId === 'route' ? 'SUNLIT ROUTE' : 'MOSSHEART GROVE');
                          }
                          setPhase('overworld');
                          setDialogue('Save loaded. Your adventure continues.');
                        } else {
                          setDialogue('NO SAVE FILE FOUND. START A NEW ADVENTURE.');
                        }
                      } else if (item.label === 'SETTINGS') {
                        setReturnPhase('title');
                        setPhase('settings');
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
              <p className="font-pixel text-[10px] text-gb-3">{mapName}</p>
              <p className="mt-1 font-pixel text-[7px] text-gb-2">{selectedStarter.toUpperCase()} · {coins} C</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="pixel-box bg-gb-0 px-2 py-2 font-pixel text-[7px] text-gb-3" onClick={() => { setReturnPhase('overworld'); setPhase('party'); }}>
                PARTY
              </button>
              <button type="button" className="pixel-box bg-gb-0 px-2 py-2 font-pixel text-[7px] text-gb-3" onClick={() => { setPhase('title'); setDialogue(''); setBattleState(null); }}>
                MENU
              </button>
            </div>
          </header>
          <section className="relative mt-3 flex flex-1 flex-col px-3">
            <PhaserGame phase={phase} selectedStarter={selectedStarter} mapId={mapId} spawnPosition={spawnPosition} onDialogue={handleDialogue} onEncounter={handleEncounter} onMapChange={handleMapChange} onPlayerPosition={handlePlayerPosition} onHeal={handleHeal} onShop={handleShop} onTrainerBattle={handleTrainerBattle} trainerDefeated={trainerDefeated} />
            <div className="mt-3 min-h-[72px] border-4 border-gb-3 bg-gb-0 p-3">
              <p className="break-words font-pixel text-[7px] leading-relaxed text-gb-3">{typedDialogue || 'Use the touch D-pad below to move.'}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="pixel-box min-w-0 flex-1 px-2 py-2 text-center font-pixel text-[6px] text-gb-2">POTIONS · {potions}</div>
              <div className="pixel-box min-w-0 flex-1 px-2 py-2 text-center font-pixel text-[6px] text-gb-2">CAPSULES · {captureItems}</div>
            </div>
            <div className="mx-auto mt-4 grid grid-cols-3 grid-rows-3 gap-1 pb-5" aria-label="Touch controls">
              {[
                { direction: 'up', label: '↑', className: 'col-start-2 row-start-1' },
                { direction: 'left', label: '←', className: 'col-start-1 row-start-2' },
                { direction: 'down', label: '↓', className: 'col-start-2 row-start-3' },
                { direction: 'right', label: '→', className: 'col-start-3 row-start-2' },
              ].map(({ direction, label, className }) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Move ${direction}`}
                  className={`pixel-box ${className} h-12 w-12 touch-manipulation select-none bg-gb-0 p-0 font-pixel text-[10px] text-gb-3 active:bg-gb-2`}
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
                  <button type="button" disabled={battleState.turn === 'busy'} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => handleBattleMenu('fight')}>FIGHT</button>
                  <button type="button" disabled={battleState.turn === 'busy'} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => handleBattleMenu('bag')}>BAG</button>
                  <button type="button" disabled={battleState.turn === 'busy'} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => handleBattleMenu('monsters')}>MONSTERS</button>
                  <button type="button" disabled={battleState.turn === 'busy' || !battleState.canCapture} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => handleBattleMenu('capture')}>CAPTURE · {captureItems}</button>
                  <button type="button" disabled={battleState.turn === 'busy'} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => handleBattleMenu('run')}>RUN</button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {battleState.player.moves.map((move, index) => (
                    <button key={move.name} type="button" disabled={battleState.turn === 'busy' || move.pp <= 0} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => resolveMove(index)}>
                      {move.name} · {move.type} <span className="float-right">PP {move.pp}/{move.maxPp}</span>
                    </button>
                  ))}
                  <button type="button" disabled={battleState.turn === 'busy'} className="pixel-box bg-gb-0 px-2 py-2 text-left font-pixel text-[8px] text-gb-3 disabled:opacity-40" onClick={() => setBattleState({ ...battleState, view: 'menu' })}>BACK</button>
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

  const rewardContent = reward ? (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0">
          <header className="px-5 pt-12 text-center">
            <p className="font-pixel text-[14px] text-gb-3">VICTORY!</p>
            <p className="mt-3 font-pixel text-[7px] leading-relaxed text-gb-2">{reward.foeName} WAS DEFEATED</p>
          </header>
          <section className="flex flex-1 flex-col justify-center px-5">
            <div className="pixel-box bg-gb-0 p-4">
              <p className="font-pixel text-[9px] text-gb-3">REWARDS</p>
              <div className="mt-5 grid gap-4">
                <div className="flex items-center justify-between border-b-4 border-gb-1 pb-3">
                  <span className="font-pixel text-[8px] text-gb-2">EXPERIENCE</span>
                  <span className="font-pixel text-[10px] text-gb-3">+{reward.xp} XP</span>
                </div>
                <div className="flex items-center justify-between border-b-4 border-gb-1 pb-3">
                  <span className="font-pixel text-[8px] text-gb-2">COINS</span>
                  <span className="font-pixel text-[10px] text-gb-3">+{reward.coins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[8px] text-gb-2">TOTAL COINS</span>
                  <span className="font-pixel text-[10px] text-gb-3">{coins}</span>
                </div>
              </div>
              {reward.leveledUp && (
                <p className="mt-5 border-4 border-gb-3 bg-gb-1 p-3 text-center font-pixel text-[9px] leading-relaxed text-gb-3">
                  LEVEL UP!<br />NOW LEVEL {reward.level}
                </p>
              )}
            </div>
          </section>
          <div className="px-5 pb-8">
            <button type="button" onClick={continueAfterReward} className="pixel-box w-full bg-gb-0 px-3 py-4 text-center font-pixel text-[10px] text-gb-3">
              CONTINUE ▶
            </button>
          </div>
        </div>
      </div>
    </main>
  ) : null;

  const settingsContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0">
          <header className="px-5 pt-12 text-center">
            <p className="font-pixel text-[14px] text-gb-3">SETTINGS</p>
            <p className="mt-3 font-pixel text-[7px] text-gb-2">SOUND · SPEED · TEXT</p>
          </header>
          <section className="flex flex-1 flex-col justify-center gap-3 px-5">
            <button type="button" onClick={() => setSoundEnabled((enabled) => !enabled)} className="pixel-box bg-gb-0 p-4 text-left font-pixel text-[9px] text-gb-3">
              SOUND <span className="float-right">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <div className="pixel-box bg-gb-0 p-4 font-pixel text-[9px] text-gb-3">
              TEXT SPEED <span className="float-right">FAST</span>
            </div>
            <div className="pixel-box bg-gb-0 p-4 font-pixel text-[9px] leading-relaxed text-gb-2">
              MOVE: ARROWS / WASD<br />CONFIRM: ENTER / Z<br />BACK: ESC / X
            </div>
          </section>
          <div className="px-5 pb-8">
            <button type="button" onClick={() => setPhase(returnPhase)} className="pixel-box w-full bg-gb-0 px-3 py-4 text-center font-pixel text-[10px] text-gb-3">
              BACK ▶
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  const shopContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0">
          <header className="px-5 pt-12 text-center">
            <p className="font-pixel text-[14px] text-gb-3">ITEM SHOP</p>
            <p className="mt-3 font-pixel text-[7px] text-gb-2">COINS · {coins}</p>
          </header>
          <section className="flex flex-1 flex-col justify-center gap-3 px-5">
            <button type="button" onClick={() => purchaseItem('potion')} className="pixel-box bg-gb-0 p-4 text-left font-pixel text-[8px] text-gb-3">
              POTION <span className="float-right">8 C</span>
              <span className="mt-2 block font-pixel text-[6px] text-gb-2">RESTORES 8 HP IN BATTLE · OWNED {potions}</span>
            </button>
            <button type="button" onClick={() => purchaseItem('capture')} className="pixel-box bg-gb-0 p-4 text-left font-pixel text-[8px] text-gb-3">
              CAPSULE <span className="float-right">12 C</span>
              <span className="mt-2 block font-pixel text-[6px] text-gb-2">CATCH WILD TINGALS · OWNED {captureItems}</span>
            </button>
          </section>
          <div className="px-5 pb-8">
            <button type="button" onClick={() => setPhase(returnPhase)} className="pixel-box w-full bg-gb-0 px-3 py-4 text-center font-pixel text-[10px] text-gb-3">
              LEAVE SHOP ▶
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  const partyContent = (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[720px] flex-col overflow-hidden border-8 border-gb-3 bg-gb-0">
          <header className="px-5 pt-12 text-center">
            <p className="font-pixel text-[14px] text-gb-3">TINGALS</p>
            <p className="mt-3 font-pixel text-[7px] text-gb-2">YOUR ACTIVE PARTY</p>
          </header>
          <section className="flex flex-1 flex-col justify-center px-5">
            <div className="pixel-box bg-gb-0 p-4">
              <div className="flex items-center gap-4">
                <PixelArt rows={critter} palette={palette} scale={5} />
                <div className="flex-1">
                  <p className="font-pixel text-[10px] text-gb-3">{playerMonster.name}</p>
                  <p className="mt-2 font-pixel text-[7px] text-gb-2">LV {playerMonster.level}</p>
                  <p className="mt-2 font-pixel text-[7px] text-gb-2">HP {playerMonster.hp}/{playerMonster.maxHp}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {party.map((monster, index) => (
                <button type="button" key={`${monster.name}-${index}`} onClick={() => selectPartyMember(index)} className={`border-4 bg-gb-0 p-3 text-left ${index === activePartyIndex ? 'border-gb-3' : 'border-gb-1'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[8px] text-gb-3">{index === activePartyIndex ? '▶ ' : ''}{index + 1}. {monster.name}</span>
                    <span className="font-pixel text-[7px] text-gb-2">LV {monster.level}</span>
                  </div>
                  <p className="mt-2 font-pixel text-[7px] text-gb-2">HP {monster.hp}/{monster.maxHp}</p>
                  <p className="mt-1 font-pixel text-[6px] text-gb-2">{monster.moves.map((move) => `${move.name} ${move.pp}/${move.maxPp}`).join(' · ')}</p>
                </button>
              ))}
            </div>
          </section>
          <div className="px-5 pb-8">
            <button type="button" onClick={() => setPhase(returnPhase)} className="pixel-box w-full bg-gb-0 px-3 py-4 text-center font-pixel text-[10px] text-gb-3">
              BACK ▶
            </button>
          </div>
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
      {phase === 'reward' && rewardContent}
      {phase === 'settings' && settingsContent}
      {phase === 'shop' && shopContent}
      {phase === 'party' && partyContent}
      {battleFlash && <div className="pointer-events-none fixed inset-0 z-50 bg-white/90" />}
    </>
  );
}
