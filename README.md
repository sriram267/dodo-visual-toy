# Tusky: The Dynamic Island Text Eater

A tiny interactive visual toy built for the **Dodo Payments** design engineer assignment.

👉 **[Live Demo: sriram267.github.io/dodo-visual-toy](https://sriram267.github.io/dodo-visual-toy/)**

<p align="center">
  <img src="./public/preview.png" alt="Tusky: The Dynamic Island Text Eater Preview" width="100%" />
</p>

---

## What It Is

Tusky is an articulated elephant mascot living in an Apple-style Dynamic Island at the top of the viewport.
- **Select text on the page**: Tusky perks up and lowers his trunk to wait.
- **Press `Command + C` / `Ctrl + C`**: Aerodynamic streamlines suck the words into the island with a vacuum whoosh and a physical gulp.
- **Press `Command + V` / `Ctrl + V`**: Tusky winds up with an *"Acchooo!"* and sneezes the words back into the exact spot they came from.
- **Click Tusky**: He has feelings — click once for a warning, twice and he gets annoyed, three times and he gets dizzy with cartoon spiral eyes.
- **Click the Notch**: Expands into the Trunk Stash with stored snippets and quick-sneeze triggers.
- **Procedural Web Audio**: 100% synthesized in real time via the Web Audio API with zero external sound files.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation & Run

```bash
# Install dependencies
npm install

# Start local dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

---

## Project Structure

```
dodo-visual-toy/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── core/
    │   ├── layout.ts       # Capsule metrics (notch & expanded dimensions)
    │   ├── anim.ts         # Spring interpolation physics
    │   └── soundEngine.ts  # Procedural audio synthesizer (Web Audio API)
    ├── island/
    │   ├── DynamicIsland.tsx  # Dynamic Island host & stash
    │   ├── DynamicIsland.css  # Island animations & keyframes
    │   ├── TuskyAnchor.tsx    # Articulated SVG mascot rig
    │   └── IslandShape.tsx    # Procedural continuous capsule SVG shell
    ├── components/
    │   ├── EditorialEssay.tsx # Editorial story & context
    │   ├── SwallowOverlay.tsx # Hardware-accelerated text funnel overlay
    │   └── KeyboardShortcutIndicator.tsx # Glassmorphic shortcut HUD
    └── hooks/
        └── useSwallowText.ts  # Selection extraction, funnel physics & sneeze stack
```

---

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Icons**: Lucide React
- **Audio**: Web Audio API (Synthesizers & procedural noise)
