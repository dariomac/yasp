// ---------------------------------------------------------------------------
// Generator — ported from SudokuDomain.Generator.
//
// The original filled a full grid, then removed givens in symmetric groups
// (the symCoord table) while the puzzle kept a unique solution and its graded
// difficulty stayed inside the requested [min,max] band. It ran on a background
// thread and streamed cell updates via ActionPerformedEvent.
//
// This port keeps the same idea — build a full solution, dig symmetric holes
// under a uniqueness constraint — but uses a "dig to minimal, then relax"
// strategy to hit a difficulty band reliably:
//
//   1. Fill a random complete solution.
//   2. Greedily remove symmetric orbits while the puzzle stays *uniquely*
//      solvable. The result is a (near-)minimal puzzle — the hardest this
//      solution/symmetry allows.
//   3. Difficulty decreases monotonically as clues are added, so add givens
//      back (at symmetric positions) until the graded difficulty falls into
//      the requested tier's technique band.
//
// Runs synchronously; on modern hardware a puzzle generates in a few ms.
// ---------------------------------------------------------------------------

import { CELLS } from './constants.js';
import { rc, rowOf, colOf, gridToString, emptyBoard } from './grid.js';
import { solve, hasUniqueSolution, gradeDifficulty } from './solver.js';

// ----- symmetry orbits (replaces Generator.symCoord) -----------------------

const SIZE = 9;

// For a symmetry id, return the set of cells that must share `index`'s
// given/empty status.
function orbit(index, symmetryId) {
  const r = rowOf(index);
  const c = colOf(index);
  const set = new Set([index]);
  const add = (rr, cc) => set.add(rc(rr, cc));

  switch (symmetryId) {
    case 'rotate180':
      add(SIZE - 1 - r, SIZE - 1 - c);
      break;
    case 'rotate90':
      add(c, SIZE - 1 - r);
      add(SIZE - 1 - r, SIZE - 1 - c);
      add(SIZE - 1 - c, r);
      break;
    case 'horizontal':
      add(SIZE - 1 - r, c);
      break;
    case 'vertical':
      add(r, SIZE - 1 - c);
      break;
    case 'diagonal': // main diagonal (\)
      add(c, r);
      break;
    case 'antidiagonal': // (/)
      add(SIZE - 1 - c, SIZE - 1 - r);
      break;
    case 'none':
    default:
      break;
  }
  return Array.from(set);
}

// Graded rank of a puzzle: the hardest technique needed, or 10 if pure logic
// stalls (needs guessing).
function rankOf(grid) {
  const { solved, hardestRank } = gradeDifficulty(grid);
  return solved ? hardestRank : 10;
}

// ----- full solution -------------------------------------------------------

function fullSolution(rng) {
  return solve(emptyBoard(), rng); // random digit order => random full grid
}

// ----- dig to a (near-)minimal uniquely-solvable puzzle --------------------

function digToMinimal(solution, symmetryId, rng) {
  const puzzle = solution.slice();
  const seeds = shuffle(
    Array.from({ length: CELLS }, (_, i) => i),
    rng
  );
  for (const seed of seeds) {
    const cells = orbit(seed, symmetryId).filter((c) => puzzle[c] !== 0);
    if (cells.length === 0) continue;
    const backup = cells.map((c) => puzzle[c]);
    cells.forEach((c) => {
      puzzle[c] = 0;
    });
    if (!hasUniqueSolution(puzzle, rng)) {
      cells.forEach((c, k) => {
        puzzle[c] = backup[k];
      });
    }
  }
  return puzzle;
}

// ----- relax a minimal puzzle up into a difficulty band --------------------
//
// Returns a puzzle whose grade sits in [minTechnique, maxTechnique], or null if
// this minimal puzzle can't be relaxed into the band (too easy already, or the
// granularity skipped over it).
function relaxToTier(minimal, solution, symmetryId, difficulty, rng) {
  const puzzle = minimal.slice();
  const minClues = difficulty.clues[0];

  // Add back one symmetric orbit of givens from the solution. Returns the list
  // of cells filled, or null if none could be added.
  const addOrbit = () => {
    const emptySeeds = shuffle(
      Array.from({ length: CELLS }, (_, i) => i).filter((i) => puzzle[i] === 0),
      rng
    );
    for (const seed of emptySeeds) {
      const cells = orbit(seed, symmetryId).filter((c) => puzzle[c] === 0);
      if (cells.length === 0) continue;
      cells.forEach((c) => {
        puzzle[c] = solution[c];
      });
      return cells;
    }
    return null;
  };

  // Phase 1: bring difficulty down into the band.
  for (let guard = 0; guard < CELLS; guard++) {
    const rank = rankOf(puzzle);
    if (rank >= difficulty.minTechnique && rank <= difficulty.maxTechnique) {
      break;
    }
    if (rank < difficulty.minTechnique) {
      return null; // overshot — adding clues can't make it harder
    }
    if (!addOrbit()) return null; // too hard and can't add more
  }

  // Phase 2: pad up to the tier's minimum clue count for a comfortable board,
  // but never so far that difficulty drops below the band.
  for (let guard = 0; guard < CELLS; guard++) {
    if (puzzle.filter((v) => v !== 0).length >= minClues) break;
    const snapshot = puzzle.slice();
    const added = addOrbit();
    if (!added) break;
    if (rankOf(puzzle) < difficulty.minTechnique) {
      // padding would break the band — revert and stop.
      for (let i = 0; i < CELLS; i++) puzzle[i] = snapshot[i];
      break;
    }
  }

  return puzzle;
}

// ----- main generate -------------------------------------------------------

/**
 * Generate a puzzle.
 * @param {object} difficulty  one of DIFFICULTY.*
 * @param {object} symmetry    one of SYMMETRY.*
 * @param {function} rng        random source (defaults Math.random)
 * @returns {{ puzzle:number[], solution:number[], givens:boolean[],
 *            difficulty:string, clues:number, symmetry:string,
 *            puzzleString:string }}
 */
export function generate(difficulty, symmetry, rng = Math.random) {
  let lastMinimal = null;
  let lastSolution = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = fullSolution(rng);
    if (!solution) continue;

    const minimal = digToMinimal(solution, symmetry.id, rng);
    lastMinimal = minimal;
    lastSolution = solution;

    // Extreme wants a puzzle that logic can't finish — the minimal one usually
    // is exactly that.
    if (difficulty.id === 'extreme') {
      if (rankOf(minimal) === 10) {
        return pack(minimal, solution, difficulty, symmetry);
      }
      continue;
    }

    const relaxed = relaxToTier(minimal, solution, symmetry.id, difficulty, rng);
    if (relaxed) return pack(relaxed, solution, difficulty, symmetry);
  }

  // Fallback: return the last minimal puzzle we produced (always valid &
  // unique), even if its grade drifted from the requested tier.
  const solution = lastSolution || fullSolution(rng) || emptyBoard();
  const puzzle = lastMinimal || solution.slice();
  return pack(puzzle, solution, difficulty, symmetry);
}

function pack(puzzle, solution, difficulty, symmetry) {
  return {
    puzzle,
    solution,
    givens: puzzle.map((v) => v !== 0),
    difficulty: difficulty.id,
    clues: puzzle.filter((v) => v !== 0).length,
    symmetry: symmetry.id,
    puzzleString: gridToString(puzzle),
  };
}

// ----- utils ---------------------------------------------------------------

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
