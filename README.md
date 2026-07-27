# YASP — Yet Another Sudoku Program

A modern **Next.js (App Router, 100% JavaScript)** port of a classic **2003 .NET**
Sudoku program. Designed to deploy on **Vercel** with zero backend — the whole
game, including puzzle generation and grading, runs in the browser.

## What was ported

The original solution had two projects:

| Original (.NET) | Role | Ported to |
| --- | --- | --- |
| `SudokuDomain.DlxSolver` | Dancing-Links exact-cover solver + difficulty grading | `src/lib/solver.js` (backtracking + solution counting) |
| `SudokuDomain.SudokuSolver` | 9×9 matrix, symmetry tables, difficulty tiers | `src/lib/solver.js` + `src/lib/constants.js` |
| `SudokuDomain.Generator` | symmetric puzzle generation with uniqueness + grading | `src/lib/generator.js` |
| `SudokuDomain.GridLogic` | 81-char grid string model | `src/lib/grid.js` |
| `SudokuDomain.Repository` | loaded pre-made grids from an Access `.mdb` | **replaced** by on-the-fly generation (no DB needed) |
| `WinSudoku.SudokuGrid` / `SudokuCell` | board & cell UI, cell states | `src/components/Board.jsx` |
| `WinSudoku.Strategies` | candidate fill, hidden singles, conflict checks | `src/lib/solver.js` + `src/hooks/useSudoku.js` |
| `WinSudoku.FrmNewSudokuGrid` | new-game dialog (difficulty + symmetry) | `src/components/NewGameDialog.jsx` |
| `WinSudoku` HTML strategy guides | help pages | `src/app/help/page.js` |

### Key design change

The original loaded curated puzzles from a Microsoft Access database
(`sudoku.mdb`). That doesn't fit a serverless/static deploy, so YASP **generates
every puzzle at runtime**: it fills a random complete grid, digs symmetric holes
while keeping the solution unique, then relaxes the puzzle until its graded
difficulty lands in the requested tier.

## Features

- Difficulty tiers **Easy / Medium / Hard / Extreme**, graded by which logical
  techniques a puzzle requires (the modern equivalent of the DLX diff counters).
- Symmetry options: **Rotational 180° / 90°, Horizontal, Vertical, Diagonal,
  Anti-diagonal, None** (ported from `GridShapes`).
- Pencil-mark candidates (the classic *Tentative* cell state).
- Live conflict highlighting for rows, columns, and boxes.
- **Auto candidates**, **Hint** (names the next technique), and **Solve step**.
- Keyboard play, undo, restart, timer, and autosave to `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel

Push this folder to a Git repo and import it in Vercel, or:

```bash
npm i -g vercel
vercel
```

No environment variables or database are required.

## Engine at a glance

- `src/lib/constants.js` — board size, difficulty tiers, symmetry & cell-state enums.
- `src/lib/grid.js` — grid string model, units/peers geometry.
- `src/lib/solver.js` — fast solver + uniqueness, logical technique solver, grading, hints, conflict detection.
- `src/lib/generator.js` — symmetric generation with difficulty targeting.
- `src/hooks/useSudoku.js` — game state controller.

## Controls

- **1–9** place a digit · **0 / Backspace** erase · **Arrow keys** move · **P** toggle pencil mode.
