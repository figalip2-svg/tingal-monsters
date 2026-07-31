'use client';

import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { OverworldScene } from '@/game/scenes/OverworldScene';

type PhaserGameProps = {
  phase: 'title' | 'starter' | 'overworld' | 'encounter' | 'battle';
  selectedStarter: string;
  onDialogue: (message: string) => void;
  onEncounter: (enemyName: string) => void;
};

type PhaserModule = typeof import('phaser');

export function PhaserGame({ phase, selectedStarter, onDialogue, onEncounter }: PhaserGameProps) {
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
      gameRef.current.registry.set('onDialogue', onDialogue);
      gameRef.current.registry.set('onEncounter', onEncounter);
      if (phase === 'overworld') {
        gameRef.current.scene.stop('Overworld');
        gameRef.current.scene.start('Overworld');
      }
      return () => window.removeEventListener('tingal-move', handleMove as EventListener);
    }

    const game = new phaserModule.Game({
      type: phaserModule.AUTO,
      width: 390,
      height: 844,
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
    game.registry.set('onDialogue', onDialogue);
    game.registry.set('onEncounter', onEncounter);

    gameRef.current = game;

    return () => {
      window.removeEventListener('tingal-move', handleMove as EventListener);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [phaserModule, phase, selectedStarter, onDialogue, onEncounter]);

  if (phase === 'title' || phase === 'starter' || phase === 'encounter') {
    return null;
  }

  return <div ref={containerRef} className="h-[620px] w-full overflow-hidden rounded-none border-4 border-gb-3 bg-gb-0" />;
}
