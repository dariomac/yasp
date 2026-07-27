'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Board from '@/components/Board';
import NumberPad from '@/components/NumberPad';
import NewGameDialog from '@/components/NewGameDialog';
import { useSudoku } from '@/hooks/useSudoku';
import { DIFFICULTY, SYMMETRY } from '@/lib/constants';
import { rowOf, colOf, rc } from '@/lib/grid';

function labelFor(map, id) {
  const found = Object.values(map).find((x) => x.id === id);
  return found ? found.label : id;
}

function fmtTime(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Home() {
  const game = useSudoku();
  const {
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
  } = game;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleGenerate = useCallback(
    (difficultyId, symmetryId) => {
      setBusy(true);
      // let the "Generating…" state paint before the (sync) work runs
      setTimeout(() => {
        startNewGame(difficultyId, symmetryId);
        setBusy(false);
        setDialogOpen(false);
      }, 20);
    },
    [startNewGame]
  );

  // Keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (dialogOpen) return;
      if (e.key >= '1' && e.key <= '9') {
        inputDigit(Number(e.key));
        e.preventDefault();
        return;
      }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        erase();
        e.preventDefault();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        setPencilMode((v) => !v);
        return;
      }
      if (e.key.startsWith('Arrow') && selected != null) {
        let r = rowOf(selected);
        let c = colOf(selected);
        if (e.key === 'ArrowUp') r = (r + 8) % 9;
        if (e.key === 'ArrowDown') r = (r + 1) % 9;
        if (e.key === 'ArrowLeft') c = (c + 8) % 9;
        if (e.key === 'ArrowRight') c = (c + 1) % 9;
        selectCell(rc(r, c));
        e.preventDefault();
      } else if (e.key.startsWith('Arrow') && selected == null) {
        selectCell(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, selected, inputDigit, erase, setPencilMode, selectCell]);

  const filled = state.board.filter((v) => v !== 0).length;

  return (
    <div className="container">
      <header className="appHeader">
        <div className="brand">
          <h1>YASP</h1>
          <span className="sub">Yet Another Sudoku Program</span>
        </div>
        <nav className="headerLinks">
          <Link className="navLink" href="/help">
            Strategies
          </Link>
          <a
            className="navLink"
            href="https://github.com/"
            onClick={(e) => e.preventDefault()}
          >
            About
          </a>
        </nav>
      </header>

      <div className="layout">
        {/* ---- Board column ---- */}
        <section className="boardWrap">
          <div className="statusRow">
            <span className="badge">
              Difficulty:&nbsp;<strong>{labelFor(DIFFICULTY, state.difficulty)}</strong>
            </span>
            <span className="badge">
              Symmetry:&nbsp;<strong>{labelFor(SYMMETRY, state.symmetry)}</strong>
            </span>
            <span className="timer">{ready ? fmtTime(state.seconds) : '00:00'}</span>
          </div>

          {state.solved ? (
            <div className="wonBanner">
              🎉 Solved in {fmtTime(state.seconds)}! Well done.
            </div>
          ) : null}

          <Board
            board={state.board}
            givens={state.givens}
            pencils={state.pencils}
            selected={selected}
            conflicts={conflicts}
            hintTargets={hint.targets}
            solved={state.solved}
            onSelect={selectCell}
          />

          <NumberPad
            counts={counts}
            onInput={inputDigit}
            disabled={selected == null || state.solved}
          />
        </section>

        {/* ---- Controls column ---- */}
        <aside className="panel controls">
          <button
            type="button"
            className="btn primary wide"
            onClick={() => setDialogOpen(true)}
          >
            ✨ New puzzle
          </button>

          <div className="sectionTitle">Entry</div>
          <div className="controlRow">
            <button
              type="button"
              className={`btn ${pencilMode ? 'active' : ''}`}
              onClick={() => setPencilMode((v) => !v)}
              title="Toggle pencil-mark mode (P)"
            >
              ✏️ Pencil {pencilMode ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={erase}
              disabled={selected == null}
            >
              ⌫ Erase
            </button>
          </div>

          <div className="controlRow">
            <button type="button" className="btn" onClick={undo}>
              ↶ Undo
            </button>
            <button type="button" className="btn" onClick={reset}>
              ↺ Restart
            </button>
          </div>

          <div className="sectionTitle">Assist</div>
          <button
            type="button"
            className="btn wide"
            onClick={autoCandidates}
            title="Fill every empty cell with its legal candidates"
          >
            🔢 Auto candidates
          </button>
          <div className="controlRow">
            <button
              type="button"
              className="btn"
              onClick={requestHint}
              disabled={state.solved}
            >
              💡 Hint
            </button>
            <button
              type="button"
              className="btn"
              onClick={applyHint}
              disabled={state.solved}
            >
              ➡️ Solve step
            </button>
          </div>
          <p className={`hintMsg ${hint.targets.length ? 'good' : ''}`}>
            {hint.message}
          </p>

          <div className="sectionTitle">Progress</div>
          <span className="badge">
            Given clues:&nbsp;<strong>{state.clues}</strong>
          </span>
          <span className="badge">
            Filled:&nbsp;<strong>{filled} / 81</strong>
          </span>
          {conflicts.size > 0 ? (
            <span className="badge" style={{ color: 'var(--conflict-text)' }}>
              ⚠ {conflicts.size} conflict{conflicts.size > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="badge">✓ No conflicts</span>
          )}
        </aside>
      </div>

      <p className="footer">
        YASP — a Next.js port of the 2003 .NET SudokuDomain / WinSudoku project.
        Runs entirely in your browser. Keyboard: 1–9 to place, 0/⌫ to erase,
        arrows to move, P for pencil.
      </p>

      {dialogOpen ? (
        <NewGameDialog
          initialDifficulty={state.difficulty}
          initialSymmetry={state.symmetry}
          onGenerate={handleGenerate}
          onClose={() => (busy ? null : setDialogOpen(false))}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
