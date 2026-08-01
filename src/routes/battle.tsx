import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/battle',
  head: () => ({
    meta: [
      { title: 'Battle — Tingal Monsters' },
      { name: 'description', content: 'Enter wild Tingal battles from the Verdant Isles overworld.' },
    ],
  }),
  component: BattleEntry,
});

function BattleEntry() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--shell)] p-3">
      <div className="w-full max-w-[390px]">
        <div className="screen-scanlines relative flex min-h-[420px] flex-col justify-center overflow-hidden border-8 border-gb-3 bg-gb-0 p-5 text-center">
          <p className="font-pixel text-[14px] text-gb-3">BATTLE GATE</p>
          <p className="mt-5 font-pixel text-[8px] leading-relaxed text-gb-2">
            Wild battles begin when you walk through tall grass on the overworld.
          </p>
          <Link to="/" className="pixel-box mt-8 bg-gb-0 px-3 py-4 font-pixel text-[9px] text-gb-3">
            RETURN TO TITLE ▶
          </Link>
        </div>
      </div>
    </main>
  );
}
