'use client';

import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { OverworldScene } from '@/game/scenes/OverworldScene';

type PhaserGameProps = {
  phase: 'title' | 'starter' | 'overworld' | 'encounter' | 'battle' | 'reward' | 'party' | 'shop' | 'settings';
  selectedStarter: string;
  mapId: string;
  spawnPosition: { x: number; y: number };
  onDialogue: (message: string) => void;
  onEncounter: (enemyName: string) => void;
  onMapChange: (mapName: string) => void;
  onPlayerPosition: (mapId: string, x: number, y: number) => void;
  onHeal: () => void;
  onShop: () => void;
  onTrainerBattle: (enemyName: string) => void;
  trainerDefeated: boolean;
};

type PhaserModule = typeof import('phaser');

export function PhaserGame({ phase, selectedStarter, mapId, spawnPosition, onDialogue, onEncounter, onMapChange, onPlayerPosition, onHeal, onShop, onTrainerBattle, trainerDefeated }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [phaserModule, setPhaserModule] = useState<PhaserModule | null>(null);

  useEffect(() => {
    let isMounted = true;
    import('phaser').then((module) => {
      if (isMounted) {
        setPhaserModule(module);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!phaserModule || typeof window === 'undefined') {
      return undefined;
    }

    const handleMove = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      gameRef.current?.events.emit('player-move', detail);
    };

    window.addEventListener('tingal-move', handleMove as EventListener);

    if (!containerRef.current) {
      return () => window.removeEventListener('tingal-move', handleMove as EventListener);
    }

    if (gameRef.current) {
      gameRef.current.registry.set('starterName', selectedStarter);
      gameRef.current.registry.set('mapId', mapId);
      gameRef.current.registry.set('spawnX', spawnPosition.x);
      gameRef.current.registry.set('spawnY', spawnPosition.y);
      gameRef.current.registry.set('onDialogue', onDialogue);
      gameRef.current.registry.set('onEncounter', onEncounter);
      gameRef.current.registry.set('onMapChange', onMapChange);
      gameRef.current.registry.set('onPlayerPosition', onPlayerPosition);
      gameRef.current.registry.set('onHeal', onHeal);
      gameRef.current.registry.set('onShop', onShop);
      gameRef.current.registry.set('onTrainerBattle', onTrainerBattle);
      gameRef.current.registry.set('trainerDefeated', trainerDefeated);
      if (phase === 'overworld') {
        gameRef.current.scene.stop('Overworld');
        gameRef.current.scene.start('Overworld');
      }
      return () => window.removeEventListener('tingal-move', handleMove as EventListener);
    }

    const game = new phaserModule.Game({
      type: phaserModule.AUTO,
      width: 390,
      height: 420,
      parent: containerRef.current,
      backgroundColor: '#dfe8a4',
      scale: {
        mode: phaserModule.Scale.FIT,
        autoCenter: phaserModule.Scale.CENTER_BOTH,
      },
      scene: [OverworldScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
        },
      },
    });

    game.registry.set('starterName', selectedStarter);
    game.registry.set('mapId', mapId);
    game.registry.set('spawnX', spawnPosition.x);
    game.registry.set('spawnY', spawnPosition.y);
    game.registry.set('onDialogue', onDialogue);
    game.registry.set('onEncounter', onEncounter);
    game.registry.set('onMapChange', onMapChange);
    game.registry.set('onPlayerPosition', onPlayerPosition);
    game.registry.set('onHeal', onHeal);
    game.registry.set('onShop', onShop);
    game.registry.set('onTrainerBattle', onTrainerBattle);
    game.registry.set('trainerDefeated', trainerDefeated);

    gameRef.current = game;

    return () => {
      window.removeEventListener('tingal-move', handleMove as EventListener);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [phaserModule, phase, selectedStarter, mapId, spawnPosition, onDialogue, onEncounter, onMapChange, onPlayerPosition, onHeal, onShop, onTrainerBattle, trainerDefeated]);

  if (phase === 'title' || phase === 'starter' || phase === 'encounter' || phase === 'reward' || phase === 'party' || phase === 'shop' || phase === 'settings') {
    return null;
  }

  return <div ref={containerRef} className="mx-auto aspect-[13/14] w-full max-w-[390px] overflow-hidden rounded-none border-4 border-gb-3 bg-gb-0" />;
}
