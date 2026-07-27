// ---------------------------------------------------------------------------
// Solver — the heart of the engine.
//
// Ported in spirit from SudokuDomain.DlxSolver + SudokuSolver. The original
// used Dancing-Links (Algorithm X) exact cover both to prove uniqueness and to
// grade difficulty by counting logical techniques (diff1 = forced single,
// diff2 = pair reductions, diff3 = guesses).
//
// Here we provide two complementary solvers:
//   1. A fast backtracking solver with MRV (minimum-remaining-values) — used
//      to find *a* solution and to count solutions for uniqueness (the job the
//      DLX exact-cover search did).
//   2. A human-style logical solver with ranked techniques — used to grade a
//      puzzle's difficulty and to power the Hint feature. This is the modern
//      equivalent of the WinSudoku "Strategies" helpers plus the diff counters.
// ---------------------------------------------------------------------------

import { SIZE, CELLS } from './constants.js';
import { PEERS, UNITS, isPlacementValid, cloneBoard } from './grid.js';

// Technique ranks (higher = harder). Used for difficulty grading.
export const TECHNIQUES = {
  SINGLE: { rank: 1, name: 'Single' },
  LOCKED: { rank: 2, name: 'Locked Candidates' },
  NAKED_PAIR: { rank: 3, name: 'Naked Pair' },
  HIDDEN_PAIR: { rank: 4, name: 'Hidden Pair' },
  NAKED_TRIPLE: { rank: 4, name: 'Naked Triple' },
  XWING: { rank: 6, name: 'X-Wing' },
  GUESS: { rank: 10, name: 'Guess / Backtrack' },
};

const ALL = 0b1111111110; // bit i set => candidate i is possible (bits 1..9)

const bitCount = (n) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};

const bitsToList = (mask) => {
  const out = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
};

const lowestDigit = (mask) => {
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) return d;
  return 0;
};

// ---------------------------------------------------------------------------
// Candidate model
// ---------------------------------------------------------------------------

// Returns a bitmask array: for filled cells the single value bit, for empty
// cells the set of digits not seen among peers.
export function computeCandidates(grid) {
  const cand = new Array(CELLS);
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) {
      cand[i] = 1 << grid[i];
      continue;
    }
    let mask = ALL;
    for (const p of PEERS[i]) {
      if (grid[p] !== 0) mask &= ~(1 << grid[p]);
    }
    cand[i] = mask;
  }
  return cand;
}

// Candidate digit list for a single empty cell (used by the UI pencil marks).
export function candidatesFor(grid, index) {
  if (grid[index] !== 0) return [];
  let mask = ALL;
  for (const p of PEERS[index]) {
    if (grid[p] !== 0) mask &= ~(1 << grid[p]);
  }
  return bitsToList(mask);
}

// ---------------------------------------------------------------------------
// 1. Fast backtracking solver + uniqueness (DLX exact-cover replacement)
// ---------------------------------------------------------------------------

function findMRV(grid) {
  let best = -1;
  let bestCount = 10;
  let bestMask = 0;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    let mask = ALL;
    for (const p of PEERS[i]) {
      if (grid[p] !== 0) mask &= ~(1 << grid[p]);
    }
    const count = bitCount(mask);
    if (count === 0) return { index: i, mask: 0, count: 0 }; // dead end
    if (count < bestCount) {
      best = i;
      bestCount = count;
      bestMask = mask;
      if (count === 1) break;
    }
  }
  return { index: best, mask: bestMask, count: bestCount };
}

// Count solutions up to `limit`. `limit = 2` is enough to test uniqueness —
// this is exactly what the generator needs (DlxSolver.startSolve returned
// 1 == unique, 2 == multiple).
export function countSolutions(grid, limit = 2, rng = Math.random) {
  const work = cloneBoard(grid);
  let found = 0;

  const recurse = () => {
    if (found >= limit) return;
    const { index, mask, count } = findMRV(work);
    if (index === -1) {
      found++; // all filled
      return;
    }
    if (count === 0) return;
    const digits = bitsToList(mask);
    // small shuffle so the "a solution" we build is varied
    for (let k = digits.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [digits[k], digits[j]] = [digits[j], digits[k]];
    }
    for (const d of digits) {
      work[index] = d;
      recurse();
      work[index] = 0;
      if (found >= limit) return;
    }
  };

  recurse();
  return found;
}

// Return one completed solution or null.
export function solve(grid, rng = Math.random) {
  const work = cloneBoard(grid);
  const recurse = () => {
    const { index, mask, count } = findMRV(work);
    if (index === -1) return true;
    if (count === 0) return false;
    const digits = bitsToList(mask);
    for (let k = digits.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [digits[k], digits[j]] = [digits[j], digits[k]];
    }
    for (const d of digits) {
      work[index] = d;
      if (recurse()) return true;
      work[index] = 0;
    }
    return false;
  };
  return recurse() ? work : null;
}

export function hasUniqueSolution(grid, rng = Math.random) {
  return countSolutions(grid, 2, rng) === 1;
}

// ---------------------------------------------------------------------------
// 2. Human-style logical solver — grading + hints
// ---------------------------------------------------------------------------
//
// Operates on a candidate-mask array. Each technique tries to make progress
// and returns a "step" describing what it found. The solver applies steps
// until stuck or solved, tracking the hardest technique it needed.

// A "step" is: { technique, placements: [{index, value}], eliminations:
// [{index, value}], reason }.

function stepNakedSingle(cand, grid) {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    if (bitCount(cand[i]) === 1) {
      const value = lowestDigit(cand[i]);
      return {
        technique: TECHNIQUES.SINGLE,
        placements: [{ index: i, value }],
        eliminations: [],
        reason: 'this cell has only one possible value',
        valueText: String(value),
      };
    }
  }
  return null;
}

function stepHiddenSingle(cand, grid) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      let spot = -1;
      let taken = false;
      for (const cell of unit) {
        if (grid[cell] === d) {
          taken = true;
          break;
        }
        if (grid[cell] === 0 && cand[cell] & bit) {
          if (spot === -1) spot = cell;
          else {
            spot = -2; // more than one
          }
        }
      }
      if (!taken && spot >= 0) {
        return {
          technique: TECHNIQUES.SINGLE,
          placements: [{ index: spot, value: d }],
          eliminations: [],
          reason: 'only one cell in this row, column or box can hold a certain digit',
          valueText: String(d),
        };
      }
    }
  }
  return null;
}

// Locked candidates (pointing / claiming): if within a box all candidates for
// a digit lie in one row/col, eliminate that digit from the rest of the
// row/col (and vice versa).
function stepLockedCandidates(cand, grid) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      const spots = unit.filter((c) => grid[c] === 0 && cand[c] & bit);
      if (spots.length < 2 || spots.length > 3) continue;
      // Cells shared by ALL spots' peers get d eliminated. Effectively:
      // find another unit that contains every spot, eliminate elsewhere.
      const common = spots
        .map((c) => new Set(PEERS[c]))
        .reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
      const elims = [];
      for (const target of common) {
        if (grid[target] === 0 && cand[target] & bit) {
          elims.push({ index: target, value: d });
        }
      }
      if (elims.length) {
        return {
          technique: TECHNIQUES.LOCKED,
          placements: [],
          eliminations: elims,
          reason: 'a digit is locked to a single line within a box',
          valueText: String(d),
        };
      }
    }
  }
  return null;
}

// Naked pair: two cells in a unit with the same two candidates — remove those
// two digits from other cells in the unit.
function stepNakedPair(cand, grid) {
  for (const unit of UNITS) {
    const empties = unit.filter((c) => grid[c] === 0);
    for (let a = 0; a < empties.length; a++) {
      if (bitCount(cand[empties[a]]) !== 2) continue;
      for (let b = a + 1; b < empties.length; b++) {
        if (cand[empties[b]] !== cand[empties[a]]) continue;
        const pairMask = cand[empties[a]];
        const elims = [];
        for (const cell of empties) {
          if (cell === empties[a] || cell === empties[b]) continue;
          const shared = cand[cell] & pairMask;
          if (shared) {
            for (const d of bitsToList(shared))
              elims.push({ index: cell, value: d });
          }
        }
        if (elims.length) {
          return {
            technique: TECHNIQUES.NAKED_PAIR,
            placements: [],
            eliminations: elims,
            reason: 'a naked pair removes those digits from the rest of the unit',
            valueText: bitsToList(pairMask).join('/'),
          };
        }
      }
    }
  }
  return null;
}

// Hidden pair: two digits that only appear in the same two cells of a unit —
// strip all other candidates from those two cells.
function stepHiddenPair(cand, grid) {
  for (const unit of UNITS) {
    for (let d1 = 1; d1 <= 8; d1++) {
      const bit1 = 1 << d1;
      const s1 = unit.filter((c) => grid[c] === 0 && cand[c] & bit1);
      if (s1.length !== 2) continue;
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const bit2 = 1 << d2;
        const s2 = unit.filter((c) => grid[c] === 0 && cand[c] & bit2);
        if (s2.length !== 2) continue;
        if (s1[0] === s2[0] && s1[1] === s2[1]) {
          const keep = bit1 | bit2;
          const elims = [];
          for (const cell of s1) {
            const extra = cand[cell] & ~keep;
            if (extra) {
              for (const d of bitsToList(extra))
                elims.push({ index: cell, value: d });
            }
          }
          if (elims.length) {
            return {
              technique: TECHNIQUES.HIDDEN_PAIR,
              placements: [],
              eliminations: elims,
              reason: 'a hidden pair confines those two cells',
              valueText: `${d1}/${d2}`,
            };
          }
        }
      }
    }
  }
  return null;
}

// X-Wing on rows/cols for a single digit.
function stepXWing(cand, grid) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) {
    rows.push([]);
    for (let c = 0; c < SIZE; c++) rows[r].push(r * SIZE + c);
  }
  for (let c = 0; c < SIZE; c++) {
    cols.push([]);
    for (let r = 0; r < SIZE; r++) cols[c].push(r * SIZE + c);
  }

  const tryLines = (lines, orient) => {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      const positions = lines.map((line) =>
        line.filter((cell) => grid[cell] === 0 && cand[cell] & bit)
      );
      for (let i = 0; i < lines.length; i++) {
        if (positions[i].length !== 2) continue;
        const iKeys = positions[i].map((cell) =>
          orient === 'row' ? cell % SIZE : Math.floor(cell / SIZE)
        );
        for (let j = i + 1; j < lines.length; j++) {
          if (positions[j].length !== 2) continue;
          const jKeys = positions[j].map((cell) =>
            orient === 'row' ? cell % SIZE : Math.floor(cell / SIZE)
          );
          if (iKeys[0] === jKeys[0] && iKeys[1] === jKeys[1]) {
            const elims = [];
            const crossLines =
              orient === 'row'
                ? iKeys.map((c) => cols[c])
                : iKeys.map((r) => rows[r]);
            crossLines.forEach((line) => {
              line.forEach((cell) => {
                const inRect =
                  positions[i].includes(cell) || positions[j].includes(cell);
                if (!inRect && grid[cell] === 0 && cand[cell] & bit) {
                  elims.push({ index: cell, value: d });
                }
              });
            });
            if (elims.length) {
              return {
                technique: TECHNIQUES.XWING,
                placements: [],
                eliminations: elims,
                reason: 'an X-Wing eliminates a candidate elsewhere',
                valueText: String(d),
              };
            }
          }
        }
      }
    }
    return null;
  };

  return tryLines(rows, 'row') || tryLines(cols, 'col');
}

const TECHNIQUE_PIPELINE = [
  stepNakedSingle,
  stepHiddenSingle,
  stepLockedCandidates,
  stepNakedPair,
  stepHiddenPair,
  stepNakedTriple,
  stepXWing,
];

function stepNakedTriple(cand, grid) {
  for (const unit of UNITS) {
    const empties = unit.filter((c) => grid[c] === 0 && bitCount(cand[c]) >= 2 && bitCount(cand[c]) <= 3);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        for (let d = b + 1; d < empties.length; d++) {
          const union = cand[empties[a]] | cand[empties[b]] | cand[empties[d]];
          if (bitCount(union) !== 3) continue;
          const trio = [empties[a], empties[b], empties[d]];
          const elims = [];
          for (const cell of unit) {
            if (grid[cell] !== 0 || trio.includes(cell)) continue;
            const shared = cand[cell] & union;
            if (shared) {
              for (const v of bitsToList(shared))
                elims.push({ index: cell, value: v });
            }
          }
          if (elims.length) {
            return {
              technique: TECHNIQUES.NAKED_TRIPLE,
              placements: [],
              eliminations: elims,
              reason: 'a naked triple clears those digits from the unit',
              valueText: bitsToList(union).join('/'),
            };
          }
        }
      }
    }
  }
  return null;
}

// Find the next logical step (used by Hint). Returns a step or null if no
// technique applies.
export function nextStep(grid) {
  const cand = computeCandidates(grid);
  for (const technique of TECHNIQUE_PIPELINE) {
    const step = technique(cand, grid);
    if (step) return step;
  }
  return null;
}

// Grade a puzzle: run the logical pipeline to completion, tracking the hardest
// technique used. Elimination-only techniques don't change `grid`, so we keep
// an explicit candidate store that persists eliminations between steps and is
// only rebuilt from scratch after a digit is actually placed. If logic stalls
// before the board is full, the puzzle needs guessing and is graded EXTREME.
// Returns { solved, hardestRank }. This is the modern equivalent of the
// DlxSolver diff1/diff2/diff3 counters.
export function gradeDifficulty(grid) {
  const work = cloneBoard(grid);
  let cand = computeCandidates(work);
  let hardest = 0;

  for (let guard = 0; guard < 2000; guard++) {
    if (work.every((v) => v !== 0)) {
      return { solved: true, hardestRank: hardest };
    }
    let progressed = false;
    for (const technique of TECHNIQUE_PIPELINE) {
      const step = technique(cand, work);
      if (!step) continue;
      hardest = Math.max(hardest, step.technique.rank);
      if (step.placements.length) {
        step.placements.forEach(({ index, value }) => {
          work[index] = value;
        });
        cand = computeCandidates(work); // recompute from scratch after a place
      } else {
        step.eliminations.forEach(({ index, value }) => {
          cand[index] &= ~(1 << value);
        });
      }
      progressed = true;
      break;
    }
    if (!progressed) {
      return { solved: false, hardestRank: TECHNIQUES.GUESS.rank };
    }
  }
  return { solved: false, hardestRank: TECHNIQUES.GUESS.rank };
}

// Whole-board conflict check — which cells violate row/col/box (for the
// "Check" feature). Ported from Strategies.CheckContraints logic.
export function findConflicts(grid) {
  const conflicts = new Set();
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0) continue;
    if (!isPlacementValid(withHole(grid, i), i, grid[i])) {
      conflicts.add(i);
      for (const p of PEERS[i]) {
        if (grid[p] === grid[i]) conflicts.add(p);
      }
    }
  }
  return conflicts;
}

function withHole(grid, i) {
  const g = cloneBoard(grid);
  g[i] = 0;
  return g;
}
