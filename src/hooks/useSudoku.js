'use client';

// ---------------------------------------------------------------------------
// useSudoku — the game controller.
//
// Bridges the pure engine (lib/*) to the React UI. It owns the mutable game
// state the old WinForms SudokuGrid/SudokuCell held: the current values, the
// "given" flags, pencil-mark candidates (the Tentative cell state), the
// selected cell, conflict highlighting, an undo stack, and a timer.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CELLS, DIFFICULTY, SYMMETRY } from '@/lib/constants';
import { candidatesFor, findConflicts, nextStep } from '@/lib/solver';
import { generate } from '@/lib/generator';

const STORAGE_KEY = 'yasp:game:v1';

function makeInitial() {
  return {
    puzzle: new Array(CELLS).fill(0),
    solution: new Array(CELLS).fill(0),
    givens: new Array(CELLS).fill(false),
    board: new Array(CELLS).fill(0),
    pencils: Array.from({ length: CELLS }, () => []),
    difficulty: DIFFICULTY.EASY.id,
    symmetry: SYMMETRY.ROTATE_180.id,
    clues: 0,
    seconds: 0,
    solved: false,
  };
}

export function useSudoku() {
  const [state, setState] = useState(makeInitial);
  const [selected, setSelected] = useState(null);
  const [pencilMode, setPencilMode] = useState(false);
  const [hint, setHint] = useState({ message: '', targets: [], stage: 0 });
  const [ready, setReady] = useState(false);
  const undoStack = useRef([]);
  // Tracks the last hint shown so a second click on the *same* hint escalates
  // from a nudge (technique only) to the full reveal (technique + number).
  const hintRef = useRef(null);

  // --- persistence: restore on mount --------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.board) && saved.board.length === CELLS) {
          setState({ ...makeInitial(), ...saved, solved: !!saved.solved });
          setReady(true);
          return;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    // no saved game — start a fresh Easy one
    startNewGame(DIFFICULTY.EASY.id, SYMMETRY.ROTATE_180.id);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- persistence: save on change ----------------------------------------
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable */
    }
  }, [state, ready]);

  // --- timer ---------------------------------------------------------------
  useEffect(() => {
    if (state.solved || !ready) return undefined;
    const id = setInterval(() => {
      setState((s) => (s.solved ? s : { ...s, seconds: s.seconds + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [state.solved, ready]);

  const conflicts = useMemo(() => findConflicts(state.board), [state.board]);

  // digit frequency for the number pad (how many of each digit are placed)
  const counts = useMemo(() => {
    const c = new Array(10).fill(0);
    state.board.forEach((v) => {
      if (v) c[v]++;
    });
    return c;
  }, [state.board]);

  const pushUndo = useCallback((snapshot) => {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > 200) undoStack.current.shift();
  }, []);

  const snapshot = useCallback(
    () => ({
      board: state.board.slice(),
      pencils: state.pencils.map((p) => p.slice()),
    }),
    [state.board, state.pencils]
  );

  // --- new game ------------------------------------------------------------
  const startNewGame = useCallback((difficultyId, symmetryId) => {
    const difficulty =
      Object.values(DIFFICULTY).find((d) => d.id === difficultyId) ||
      DIFFICULTY.EASY;
    const symmetry =
      Object.values(SYMMETRY).find((s) => s.id === symmetryId) ||
      SYMMETRY.ROTATE_180;

    const g = generate(difficulty, symmetry);
    undoStack.current = [];
    hintRef.current = null;
    setSelected(null);
    setHint({ message: '', targets: [], stage: 0 });
    setPencilMode(false);
    setState({
      puzzle: g.puzzle.slice(),
      solution: g.solution.slice(),
      givens: g.givens.slice(),
      board: g.puzzle.slice(),
      pencils: Array.from({ length: CELLS }, () => []),
      difficulty: g.difficulty,
      symmetry: g.symmetry,
      clues: g.clues,
      seconds: 0,
      solved: false,
    });
  }, []);

  // --- input ---------------------------------------------------------------
  const selectCell = useCallback((index) => {
    setSelected(index);
    hintRef.current = null;
    setHint({ message: '', targets: [], stage: 0 });
  }, []);

  const isSolved = useCallback((board, solution) => {
    for (let i = 0; i < CELLS; i++) {
      if (board[i] === 0 || board[i] !== solution[i]) return false;
    }
    return true;
  }, []);

  const inputDigit = useCallback(
    (digit) => {
      if (selected == null) return;
      if (state.givens[selected]) return;
      const snap = snapshot();

      setState((s) => {
        if (s.givens[selected]) return s;

        if (pencilMode) {
          const pencils = s.pencils.map((p) => p.slice());
          const set = new Set(pencils[selected]);
          if (set.has(digit)) set.delete(digit);
          else set.add(digit);
          pencils[selected] = Array.from(set).sort((a, b) => a - b);
          pushUndo(snap);
          return { ...s, pencils };
        }

        const board = s.board.slice();
        const pencils = s.pencils.map((p) => p.slice());
        // toggle off if same digit already there
        board[selected] = board[selected] === digit ? 0 : digit;
        pencils[selected] = [];
        // placing a digit clears that pencil mark from peers is a nicety we
        // leave manual, matching the classic app.
        const solved = isSolved(board, s.solution);
        pushUndo(snap);
        return { ...s, board, pencils, solved };
      });
    },
    [selected, pencilMode, state.givens, snapshot, pushUndo, isSolved]
  );

  const erase = useCallback(() => {
    if (selected == null || state.givens[selected]) return;
    const snap = snapshot();
    setState((s) => {
      if (s.givens[selected]) return s;
      const board = s.board.slice();
      const pencils = s.pencils.map((p) => p.slice());
      board[selected] = 0;
      pencils[selected] = [];
      pushUndo(snap);
      return { ...s, board, pencils, solved: false };
    });
  }, [selected, state.givens, snapshot, pushUndo]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setState((s) => ({
      ...s,
      board: prev.board,
      pencils: prev.pencils,
      solved: isSolved(prev.board, s.solution),
    }));
  }, [isSolved]);

  const reset = useCallback(() => {
    undoStack.current = [];
    hintRef.current = null;
    setHint({ message: '', targets: [], stage: 0 });
    setState((s) => ({
      ...s,
      board: s.puzzle.slice(),
      pencils: Array.from({ length: CELLS }, () => []),
      seconds: 0,
      solved: false,
    }));
  }, []);

  // Fill every empty cell's pencil marks with its legal candidates —
  // Strategies.FillGridWithPossibleNumbers.
  const autoCandidates = useCallback(() => {
    const snap = snapshot();
    setState((s) => {
      const pencils = s.pencils.map((p) => p.slice());
      for (let i = 0; i < CELLS; i++) {
        pencils[i] = s.board[i] === 0 ? candidatesFor(s.board, i) : [];
      }
      pushUndo(snap);
      return { ...s, pencils };
    });
  }, [snapshot, pushUndo]);

  // Reveal the next logical step (a placement, or an elimination) — the modern
  // equivalent of the WinSudoku solver "helpers".
  const requestHint = useCallback(() => {
    if (state.solved) return;
    const step = nextStep(state.board);
    if (!step) {
      hintRef.current = null;
      setHint({
        message:
          'No simple next step found — this position may need advanced logic or a guess.',
        targets: [],
        stage: 0,
      });
      return;
    }

    // A key identifying this exact hint on this exact board. Clicking Hint
    // again while the key is unchanged escalates from a nudge to the full
    // reveal; any board change (or selecting a cell) produces a new key.
    const key =
      state.board.join('') +
      '|' +
      step.technique.name +
      '|' +
      step.placements.map((p) => `${p.index}:${p.value}`).join(',') +
      '|' +
      step.eliminations.map((e) => `${e.index}:${e.value}`).join(',');

    const prev = hintRef.current;
    const stage = prev && prev.key === key ? 2 : 1;
    hintRef.current = { key, stage };

    // Stage 1: technique + explanation only (a nudge).
    // Stage 2: also reveal the number(s).
    const base = `${step.technique.name}: ${step.reason}`;
    const message =
      stage >= 2 ? `${base} (${step.valueText}).` : `${base}.`;
    const targets = step.placements.length
      ? step.placements.map((p) => p.index)
      : step.eliminations.map((e) => e.index);

    if (step.placements.length) setSelected(step.placements[0].index);
    setHint({ message, targets, stage });
  }, [state.board, state.solved]);

  const applyHint = useCallback(() => {
    if (state.solved) return;
    const step = nextStep(state.board);
    if (!step || !step.placements.length) {
      requestHint();
      return;
    }
    const { index, value } = step.placements[0];
    const snap = snapshot();
    setState((s) => {
      const board = s.board.slice();
      const pencils = s.pencils.map((p) => p.slice());
      board[index] = value;
      pencils[index] = [];
      pushUndo(snap);
      return { ...s, board, pencils, solved: isSolved(board, s.solution) };
    });
    setSelected(index);
    hintRef.current = null;
    setHint({ message: '', targets: [], stage: 0 });
  }, [state.board, state.solved, snapshot, pushUndo, isSolved, requestHint]);

  return {
    ready,
    state,
    selected,
    pencilMode,
    conflicts,
    counts,
    hint,
    setPencilMode,
    selectCell,
    inputDigit,
    erase,
    undo,
    reset,
    autoCandidates,
    requestHint,
    applyHint,
    startNewGame,
  };
}
