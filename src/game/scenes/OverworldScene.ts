import Phaser from 'phaser';

const TILE_SIZE = 16;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;

const PALETTE = {
  base: '#dfe8a4',
  light: '#9bdc70',
  mid: '#4aa767',
  dark: '#1d7b4b',
  shell: '#4d6d51',
  accent: '#2f4f3f',
};

type MapId = 'town' | 'route' | 'grove';

function createMap(grassTiles: Array<[number, number]>, obstacles: Array<[number, number]>): number[][] {
  const map: number[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1 ? 1 : 0)),
  );
  grassTiles.forEach(([x, y]) => { map[y][x] = 4; });
  obstacles.forEach(([x, y]) => { map[y][x] = 1; });
  map[10][0] = 0;
  map[10][MAP_WIDTH - 1] = 0;
  return map;
}

const MAPS: Record<MapId, number[][]> = {
  town: createMap(
    [[12,2],[13,2],[14,2],[15,2],[12,3],[13,3],[14,3],[15,3],[12,4],[13,4],[14,4],[15,4]],
    [[5,5],[6,5],[5,6],[6,6],[10,14],[11,14],[10,15],[11,15]],
  ),
  route: createMap(
    [[3,3],[4,3],[5,3],[3,4],[4,4],[5,4],[14,14],[15,14],[16,14],[14,15],[15,15],[16,15]],
    [[8,6],[9,6],[10,6],[8,7],[10,7],[8,8],[9,8],[10,8]],
  ),
  grove: createMap(
    [[4,12],[5,12],[6,12],[7,12],[4,13],[5,13],[6,13],[7,13],[14,4],[15,4],[14,5],[15,5]],
    [[3,5],[4,5],[3,6],[4,6],[16,8],[17,8],[16,9],[17,9]],
  ),
};

const MAP_NAMES: Record<MapId, string> = {
  town: 'VERDANT TOWN',
  route: 'SUNLIT ROUTE',
  grove: 'MOSSHEART GROVE',
};

function isWalkable(value: number) {
  return value === 0 || value === 4;
}

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private npc!: Phaser.GameObjects.Rectangle;
  private playerTile = { x: 1, y: 1 };
  private npcTile = { x: 14, y: 8 };
  private mapId: MapId = 'town';
  private collisionLayer: number[][] = MAPS.town;
  private onDialogue?: (message: string) => void;
  private onEncounter?: (enemyName: string) => void;
  private onMapChange?: (mapName: string) => void;
  private dialogueShown = false;

  constructor() {
    super({ key: 'Overworld' });
  }

  create() {
    this.onDialogue = this.registry.get('onDialogue');
    this.onEncounter = this.registry.get('onEncounter');
    this.onMapChange = this.registry.get('onMapChange');
    this.mapId = this.registry.get('mapId') ?? 'town';
    this.collisionLayer = MAPS[this.mapId];
    const spawnX = this.registry.get('spawnX') as number | undefined;
    this.playerTile = spawnX !== undefined
      ? { x: spawnX, y: 10 }
      : this.mapId === 'town'
        ? { x: 1, y: 1 }
        : { x: this.mapId === 'route' ? 1 : 18, y: 10 };
    this.npcTile = this.mapId === 'town' ? { x: 14, y: 8 } : { x: 10, y: 10 };
    this.onMapChange?.(MAP_NAMES[this.mapId]);

    const graphics = this.add.graphics();
    graphics.fillStyle(Number(`0x${PALETTE.base.slice(1)}`), 1);
    graphics.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const value = this.collisionLayer[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (value === 1) {
          graphics.fillStyle(Number(`0x${PALETTE.shell.slice(1)}`), 1);
          graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          graphics.lineStyle(1, Number(`0x${PALETTE.accent.slice(1)}`), 1);
          graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (value === 2) {
          graphics.fillStyle(Number(`0x${PALETTE.dark.slice(1)}`), 1);
          graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          graphics.lineStyle(1, Number(`0x${PALETTE.accent.slice(1)}`), 1);
          graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (value === 4) {
          graphics.fillStyle(Number(`0x${PALETTE.light.slice(1)}`), 1);
          graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          graphics.lineStyle(1, Number(`0x${PALETTE.mid.slice(1)}`), 1);
          graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else {
          graphics.fillStyle(Number(`0x${PALETTE.base.slice(1)}`), 1);
          graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          graphics.lineStyle(1, Number(`0x${PALETTE.mid.slice(1)}`), 1);
          graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }

    this.player = this.add.rectangle(this.playerTile.x * TILE_SIZE, this.playerTile.y * TILE_SIZE, 12, 12, Number(`0x${PALETTE.dark.slice(1)}`));
    this.player.setOrigin(0, 0);
    this.player.setStrokeStyle(2, Number(`0x${PALETTE.base.slice(1)}`));

    this.npc = this.add.rectangle(this.npcTile.x * TILE_SIZE, this.npcTile.y * TILE_SIZE, 12, 12, Number(`0x${PALETTE.mid.slice(1)}`));
    this.npc.setOrigin(0, 0);
    this.npc.setStrokeStyle(2, Number(`0x${PALETTE.base.slice(1)}`));

    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
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
      this.changeMap(this.mapId === 'grove' ? 'route' : 'town', MAP_WIDTH - 2);
      return;
    }
    if (nextY === 10 && nextX >= MAP_WIDTH) {
      this.changeMap(this.mapId === 'town' ? 'route' : 'grove', 1);
      return;
    }
    if (nextX < 0 || nextY < 0 || nextX >= MAP_WIDTH || nextY >= MAP_HEIGHT) {
      return;
    }
    const tile = this.collisionLayer[nextY][nextX];
    if (!isWalkable(tile)) {
      return;
    }

    this.playerTile = { x: nextX, y: nextY };
    this.player.setPosition(nextX * TILE_SIZE, nextY * TILE_SIZE);

    if (nextX === this.npcTile.x && nextY === this.npcTile.y && !this.dialogueShown) {
      this.dialogueShown = true;
      this.onDialogue?.('Mossy Guide: The path to the Verdant Isles is open. Beware the tall grass.');
    }

    if (this.collisionLayer[nextY][nextX] === 4) {
      const shouldEncounter = Math.random() < 0.1;
      if (shouldEncounter) {
        const encounters = ['EMBERFANG', 'GLIMMOTH', 'CRAGHORN', 'RIPPLEFIN'];
        this.onEncounter?.(encounters[Math.floor(Math.random() * encounters.length)]);
      }
    }
  }

  private changeMap(nextMap: MapId, spawnX: number) {
    this.registry.set('mapId', nextMap);
    this.registry.set('spawnX', spawnX);
    this.scene.restart();
  }
}
