# Tingal Monsters

Tingal Monsters is a retro handheld-style monster RPG built with React, TypeScript, Tailwind CSS, and Phaser. The game runs in the browser and is ready for Vercel deployment.

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open http://localhost:4173 in your browser.

## Production build

```bash
npm run build
```

## Preview production build

```bash
npm run start
```

## GitHub

```bash
git init
git add .
git commit -m "deploy ready"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Vercel deployment

1. Create a new Vercel project.
2. Import this repository.
3. Vercel will detect the Vite app automatically.
4. Use the default build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Deploy.

## Notes

- Phaser is initialized only in the browser to avoid SSR issues.
- The game uses browser localStorage only on the client side.
