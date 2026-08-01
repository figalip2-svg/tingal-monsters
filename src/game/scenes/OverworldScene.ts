import Phaser from 'phaser';
import { ENCOUNTER_RATE, HEIGHT, MAP, SIGNS, SOLID, WIDTH } from '@/components/overworld';

const TILE_SIZE = 16;
type MapId = 'town' | 'route' | 'grove';
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
};

const MAP_NAMES: Record<MapId, string> = {
  town: 'VERDANT TOWN',
  route: 'SUNLIT ROUTE',
  grove: 'MOSSHEART GROVE',
};

const COLORS = {
  base: 0xdfe8a4,
  light: 0x9bdc70,
  mid: 0x4aa767,
  dark: 0x1d7b4b,
  shell: 0x4d6d51,
  accent: 0x2f4f3f,
};

function isSolidTile(tile: string, mapId: MapId) {
  return mapId === 'town' ? SOLID.has(tile as never) : tile === 't';
}

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private npc!: Phaser.GameObjects.Rectangle;
  private playerTile = { x: 1, y: 1 };
  private npcTile = { x: 8, y: 8 };
  private mapId: MapId = 'town';
  private map!: MapDefinition;
  private onDialogue?: (message: string) => void;
  private onEncounter?: (enemyName: string) => void;
  private onMapChange?: (mapName: string) => void;
  private onPlayerPosition?: (mapId: MapId, x: number, y: number) => void;

  constructor() {
    super({ key: 'Overworld' });
  }

  create() {
    this.onDialogue = this.registry.get('onDialogue');
    this.onEncounter = this.registry.get('onEncounter');
    this.onMapChange = this.registry.get('onMapChange');
    this.onPlayerPosition = this.registry.get('onPlayerPosition');
    this.mapId = this.registry.get('mapId') ?? 'town';
    this.map = MAPS[this.mapId];
    const savedX = this.registry.get('spawnX') as number | undefined;
    const savedY = this.registry.get('spawnY') as number | undefined;
    this.playerTile = savedX !== undefined && savedY !== undefined
      ? { x: savedX, y: savedY }
      : this.mapId === 'town' ? { x: 1, y: 1 } : { x: this.mapId === 'route' ? 1 : this.map.width - 2, y: 10 };
    this.npcTile = this.mapId === 'town' ? { x: 8, y: 8 } : { x: 10, y: 10 };
    this.onMapChange?.(MAP_NAMES[this.mapId]);
    this.onPlayerPosition?.(this.mapId, this.playerTile.x, this.playerTile.y);

    const graphics = this.add.graphics();
    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        this.drawTile(graphics, this.map.tiles[y][x], x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    this.player = this.add.rectangle(this.playerTile.x * TILE_SIZE, this.playerTile.y * TILE_SIZE, 12, 12, COLORS.dark).setOrigin(0, 0);
    this.player.setStrokeStyle(2, COLORS.base);
    this.npc = this.add.rectangle(this.npcTile.x * TILE_SIZE, this.npcTile.y * TILE_SIZE, 12, 12, COLORS.mid).setOrigin(0, 0);
    this.npc.setStrokeStyle(2, COLORS.base);

    this.cameras.main.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setRoundPixels(true);
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
      graphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      graphics.fillStyle(COLORS.light, 1);
      graphics.fillRect(px + 4, py + 4, 3, 3);
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
    }
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
    if (isSolidTile(tile, this.mapId)) {
      if (tile === 'h') this.onDialogue?.('The house is closed for now. A warm light flickers inside.');
      else if (tile === 'w') this.onDialogue?.('The water is too deep to cross.');
      else if (tile === 't') this.onDialogue?.('A thick wall of trees blocks the path.');
      return;
    }

    this.playerTile = { x: nextX, y: nextY };
    this.player.setPosition(nextX * TILE_SIZE, nextY * TILE_SIZE);
    this.onPlayerPosition?.(this.mapId, nextX, nextY);

    const signKey = `${nextX},${nextY}`;
    if (tile === 's') this.onDialogue?.(SIGNS[signKey] ?? 'The sign is weathered.');
    else if (nextX === this.npcTile.x && nextY === this.npcTile.y) this.onDialogue?.('Mossy Guide: Tall grass hides wild Tingals. Take care on Route 1.');
    else if (tile === 'g' && Math.random() < ENCOUNTER_RATE) {
      const encounters = ['EMBERFANG', 'GLIMMOTH', 'CRAGHORN', 'RIPPLEFIN'];
      this.onEncounter?.(encounters[Math.floor(Math.random() * encounters.length)]);
    }
  }

  private changeMap(nextMap: MapId, spawnX: number) {
    this.registry.set('mapId', nextMap);
    this.registry.set('spawnX', spawnX);
    this.registry.set('spawnY', 10);
    this.scene.restart();
  }
}
