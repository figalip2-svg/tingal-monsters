import Phaser from 'phaser';
import { ENCOUNTER_RATE, HEIGHT, MAP, SIGNS, SOLID, WIDTH } from '@/components/overworld';
import { trainer } from '@/components/monster-sprites';

const TILE_SIZE = 28;
const CHARACTER_SCALE = 1.5;
type MapId = 'town' | 'route' | 'grove' | 'forest';
type MapDefinition = { tiles: string[]; width: number; height: number };

const SIMPLE_MAP = (grassTiles: Array<[number, number]>, obstacles: Array<[number, number]>): MapDefinition => {
  const width = 20;
  const height = 20;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 't' : '.')).join(''),
  );
  grassTiles.forEach(([x, y]) => { tiles[y] = `${tiles[y].slice(0, x)}g${tiles[y].slice(x + 1)}`; });
  obstacles.forEach(([x, y]) => { tiles[y] = `${tiles[y].slice(0, x)}t${tiles[y].slice(x + 1)}`; });
  tiles[10] = `.${tiles[10].slice(1, -1)}.`;
  return { tiles, width, height };
};

const MAPS: Record<MapId, MapDefinition> = {
  town: { tiles: MAP, width: WIDTH, height: HEIGHT },
  route: SIMPLE_MAP([[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4], [14, 14], [15, 14], [16, 14], [14, 15], [15, 15], [16, 15]], [[8, 6], [9, 6], [10, 6], [8, 7], [10, 7], [8, 8], [9, 8], [10, 8]]),
  grove: SIMPLE_MAP([[4, 12], [5, 12], [6, 12], [7, 12], [4, 13], [5, 13], [6, 13], [7, 13], [14, 4], [15, 4], [14, 5], [15, 5]], [[3, 5], [4, 5], [3, 6], [4, 6], [16, 8], [17, 8], [16, 9], [17, 9]]),
  // New forest map: denser grass, a few obstacles, slightly higher encounter density visually
  forest: SIMPLE_MAP([[5,5],[6,5],[7,5],[8,6],[9,6],[10,6],[5,7],[6,7],[7,7],[12,12],[13,12]], [[9,9],[10,9],[11,9],[9,10],[11,10]]),
};

const MAP_NAMES: Record<MapId, string> = {
  town: 'VERDANT TOWN',
  route: 'SUNLIT ROUTE',
  grove: 'MOSSHEART GROVE',
  forest: 'ECHOING FOREST',
};

const COLORS = {
  base: 0xdfe8a4,
  light: 0x9bdc70,
  mid: 0x4aa767,
  dark: 0x1d7b4b,
  shell: 0x4d6d51,
  accent: 0x2f4f3f,
};

function isSolidTile(tile: string, mapId: MapId, x: number, y: number, width: number) {
  if (y === 10 && (x === 0 || x === width - 1)) return false;
  return mapId === 'town' ? SOLID.has(tile as never) : tile === 't';
}

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerTile = { x: 1, y: 1 };
  private npcTile = { x: 8, y: 8 };
  private mapId: MapId = 'town';
  private map!: MapDefinition;
  private onDialogue?: (message: string) => void;
  private onEncounter?: (enemyName: string) => void;
  private onMapChange?: (mapName: string) => void;
  private onPlayerPosition?: (mapId: MapId, x: number, y: number) => void;
  private onHeal?: () => void;
  private onShop?: () => void;
  private onTrainerBattle?: (enemyName: string) => void;
  private trainerDefeated = false;

  constructor() {
    super({ key: 'Overworld' });
  }

  create() {
    this.onDialogue = this.registry.get('onDialogue');
    this.onEncounter = this.registry.get('onEncounter');
    this.onMapChange = this.registry.get('onMapChange');
    this.onPlayerPosition = this.registry.get('onPlayerPosition');
    this.onHeal = this.registry.get('onHeal');
    this.onShop = this.registry.get('onShop');
    this.onTrainerBattle = this.registry.get('onTrainerBattle');
    this.trainerDefeated = this.registry.get('trainerDefeated') ?? false;
    this.mapId = this.registry.get('mapId') ?? 'town';
    this.map = MAPS[this.mapId];
    const savedX = this.registry.get('spawnX') as number | undefined;
    const savedY = this.registry.get('spawnY') as number | undefined;
    this.playerTile = savedX !== undefined && savedY !== undefined
      ? { x: savedX, y: savedY }
      : this.mapId === 'town'
        ? { x: 1, y: 1 }
        : this.mapId === 'route'
          ? { x: 1, y: 10 }
          : this.mapId === 'grove'
            ? { x: this.map.width - 2, y: 10 }
            : { x: Math.floor(this.map.width / 2), y: this.map.height - 3 };
    this.npcTile = this.mapId === 'town' ? { x: 8, y: 8 } : { x: 10, y: 10 };
    this.onMapChange?.(MAP_NAMES[this.mapId]);
    this.onPlayerPosition?.(this.mapId, this.playerTile.x, this.playerTile.y);

    const graphics = this.add.graphics();
    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        this.drawTile(graphics, this.map.tiles[y][x], x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    this.player = this.createCharacter(this.playerTile.x, this.playerTile.y, COLORS.dark, COLORS.mid);
    this.createCharacter(this.npcTile.x, this.npcTile.y, COLORS.mid, COLORS.dark);
    if (this.mapId === 'town') {
      this.createCharacter(6, 7, COLORS.dark, COLORS.light);
      this.createCharacter(10, 7, COLORS.accent, COLORS.light);
    }
    if (this.mapId === 'route') {
      // Add a visible trainer on the route at 6,6
      this.createCharacter(6, 6, COLORS.accent, COLORS.dark);
    }

    this.cameras.main.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);
    this.cameras.main.setRoundPixels(true);
    this.updateCamera();
    this.input.keyboard?.on('keydown-LEFT', () => this.tryMove(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.tryMove(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.tryMove(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.tryMove(0, 1));
    this.input.keyboard?.on('keydown-W', () => this.tryMove(0, -1));
    this.input.keyboard?.on('keydown-A', () => this.tryMove(-1, 0));
    this.input.keyboard?.on('keydown-S', () => this.tryMove(0, 1));
    this.input.keyboard?.on('keydown-D', () => this.tryMove(1, 0));
    this.game.events.on('player-move', this.handleMove, this);
    this.events.once('shutdown', () => this.game.events.off('player-move', this.handleMove, this));
  }

  private drawTile(graphics: Phaser.GameObjects.Graphics, tile: string, px: number, py: number) {
    const fill = tile === 't' ? COLORS.shell : tile === 'g' ? COLORS.light : tile === 'w' ? COLORS.mid : tile === 'f' ? COLORS.dark : COLORS.base;
    graphics.fillStyle(fill, 1);
    graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    graphics.lineStyle(1, tile === 'w' ? COLORS.base : COLORS.mid, 1);
    graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    if (tile === 't') {
      graphics.fillStyle(COLORS.accent, 1);
      graphics.fillRect(px + 2, py + 2, 12, 8);
      graphics.fillRect(px + 4, py + 10, 8, 4);
      graphics.fillStyle(COLORS.mid, 1);
      graphics.fillRect(px + 1, py + 5, 4, 5);
      graphics.fillRect(px + 11, py + 4, 4, 6);
      graphics.fillStyle(COLORS.light, 1);
      graphics.fillRect(px + 4, py + 3, 3, 3);
      graphics.fillRect(px + 9, py + 7, 3, 3);
    } else if (tile === 'g') {
      graphics.fillStyle(COLORS.mid, 1);
      graphics.fillRect(px + 3, py + 7, 2, 6);
      graphics.fillRect(px + 9, py + 4, 2, 9);
      graphics.fillStyle(COLORS.dark, 1);
      graphics.fillRect(px + 13, py + 8, 2, 5);
    } else if (tile === 'w') {
      graphics.fillStyle(COLORS.base, 1);
      graphics.fillRect(px + 3, py + 7, 8, 2);
    } else if (tile === 'h') {
      graphics.fillStyle(COLORS.dark, 1);
      graphics.fillRect(px + 1, py + 1, 14, 5);
      graphics.fillRect(px + 6, py + 9, 5, 7);
    } else if (tile === 's') {
      graphics.fillStyle(COLORS.dark, 1);
      graphics.fillRect(px + 6, py + 3, 4, 10);
      graphics.fillRect(px + 3, py + 3, 10, 3);
    } else if (tile === 'f') {
      graphics.fillStyle(COLORS.accent, 1);
      graphics.fillRect(px + 2, py + 4, 3, 10);
      graphics.fillRect(px + 11, py + 4, 3, 10);
      graphics.fillRect(px + 2, py + 6, 12, 2);
      graphics.fillRect(px + 2, py + 11, 12, 2);
    }
  }

  private createCharacter(tileX: number, tileY: number, primary: number, secondary: number) {
    const container = this.add.container(
      tileX * TILE_SIZE + (TILE_SIZE - 12 * CHARACTER_SCALE) / 2,
      tileY * TILE_SIZE - (16 * CHARACTER_SCALE - TILE_SIZE),
    );
    const sprite = this.add.graphics();
    const colors: Record<string, number> = {
      k: primary,
      m: secondary,
      l: COLORS.base,
      d: COLORS.mid,
    };

    trainer.forEach((row, y) => {
      row.split('').forEach((char, x) => {
        const color = colors[char];
        if (color === undefined || char === ' ') return;
        sprite.fillStyle(color, 1);
        sprite.fillRect(x * CHARACTER_SCALE, y * CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE);
      });
    });
    container.add(sprite);
    return container;
  }

  private handleMove = (direction: string) => {
    if (direction === 'left') this.tryMove(-1, 0);
    if (direction === 'right') this.tryMove(1, 0);
    if (direction === 'up') this.tryMove(0, -1);
    if (direction === 'down') this.tryMove(0, 1);
  };

  private tryMove(dx: number, dy: number) {
    const nextX = this.playerTile.x + dx;
    const nextY = this.playerTile.y + dy;
    // Enter forest if moving off the top edge of the route
    if (nextY < 0 && this.mapId === 'route') {
      this.changeMap('forest', Math.floor(MAPS.forest.width / 2));
      return;
    }

    if (nextY === 10 && nextX < 0) {
      this.changeMap(this.mapId === 'grove' ? 'route' : 'town', MAPS[this.mapId === 'town' ? 'route' : 'town'].width - 2);
      return;
    }
    if (nextY === 10 && nextX >= this.map.width) {
      this.changeMap(this.mapId === 'town' ? 'route' : 'grove', 1);
      return;
    }
    if (nextX < 0 || nextY < 0 || nextX >= this.map.width || nextY >= this.map.height) return;
    const tile = this.map.tiles[nextY][nextX];
    if (isSolidTile(tile, this.mapId, nextX, nextY, this.map.width)) {
      if (tile === 'h') this.onDialogue?.('The house is closed for now. A warm light flickers inside.');
      else if (tile === 'w') this.onDialogue?.('The water is too deep to cross.');
      else if (tile === 't') this.onDialogue?.('A thick wall of trees blocks the path.');
      return;
    }

    this.playerTile = { x: nextX, y: nextY };
    this.player.setPosition(
      nextX * TILE_SIZE + (TILE_SIZE - 12 * CHARACTER_SCALE) / 2,
      nextY * TILE_SIZE - (16 * CHARACTER_SCALE - TILE_SIZE),
    );
    this.updateCamera();
    this.onPlayerPosition?.(this.mapId, nextX, nextY);

    const signKey = `${nextX},${nextY}`;
    if (tile === 's') this.onDialogue?.(SIGNS[signKey] ?? 'The sign is weathered.');
    else if (this.mapId === 'town' && nextX === 6 && nextY === 7) {
      this.onHeal?.();
      this.onDialogue?.('HEALER: Your party is rested and ready for the road!');
    } else if (this.mapId === 'town' && nextX === 10 && nextY === 7) {
      this.onShop?.();
    } else if (this.mapId === 'route' && nextX === this.npcTile.x && nextY === this.npcTile.y && !this.trainerDefeated) {
      this.onDialogue?.('TRAINER RUNE challenges you to a battle!');
      this.onTrainerBattle?.('TRAINER_RUNE');
    } else if (this.mapId === 'route' && nextX === 6 && nextY === 6 && !this.trainerDefeated) {
      // Another trainer on the route
      this.onDialogue?.('TRAINER MIRA challenges you to a battle!');
      this.onTrainerBattle?.('TRAINER_MIRA');
    } else if (nextX === this.npcTile.x && nextY === this.npcTile.y) this.onDialogue?.('Mossy Guide: Tall grass hides wild Tingals. Take care on Route 1.');
    // Forest trainer trigger
    else if (this.mapId === 'forest' && nextX === 6 && nextY === 4 && !this.trainerDefeated) {
      this.onDialogue?.('RANGER: The forest is my domain — battle me!');
      this.onTrainerBattle?.('TRAINER_RANGER');
    }
    else if (tile === 'g') {
      // Per-map encounter rates and pools
      const rate = this.mapId === 'forest' ? 0.22 : ENCOUNTER_RATE;
      if (Math.random() < rate) {
        const mapEncounters: Record<string, string[]> = {
          route: ['EMBERFANG', 'GLIMMOTH', 'CRAGHORN', 'RIPPLEFIN'],
          grove: ['GLIMMOTH', 'CRAGHORN', 'RIPPLEFIN'],
          forest: ['MOSSBUG', 'LEAFFOX', 'GLIMMOTH', 'RIPPLEFIN'],
        };
        const list = mapEncounters[this.mapId] ?? ['EMBERFANG', 'GLIMMOTH', 'CRAGHORN', 'RIPPLEFIN'];
        // Small rare chance in forest for a tougher foe
        if (this.mapId === 'forest' && Math.random() < 0.06) {
          this.onEncounter?.('CRAGHORN');
        } else {
          this.onEncounter?.(list[Math.floor(Math.random() * list.length)]);
        }
      }
    }  }

  private updateCamera() {
    const camera = this.cameras.main;
    const mapWidth = this.map.width * TILE_SIZE;
    const mapHeight = this.map.height * TILE_SIZE;
    const targetX = this.playerTile.x * TILE_SIZE + TILE_SIZE / 2 - camera.width / 2;
    const targetY = this.playerTile.y * TILE_SIZE + TILE_SIZE / 2 - camera.height / 2;
    camera.setScroll(
      Phaser.Math.Clamp(targetX, 0, Math.max(0, mapWidth - camera.width)),
      Phaser.Math.Clamp(targetY, 0, Math.max(0, mapHeight - camera.height)),
    );
  }

  private changeMap(nextMap: MapId, spawnX: number) {
    this.registry.set('mapId', nextMap);
    this.registry.set('spawnX', spawnX);
    this.registry.set('spawnY', 10);
    this.scene.restart();
  }
}
