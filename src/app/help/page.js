import Link from 'next/link';

export const metadata = {
  title: 'Strategies — YASP',
  description: 'Sudoku solving techniques, from singles to the X-Wing.',
};

export default function HelpPage() {
  return (
    <div className="container">
      <Link className="backLink" href="/">
        ← Back to the game
      </Link>
      <article className="prose">
        <h1>Solving strategies</h1>
        <p>
          Sudoku asks you to fill a 9×9 grid so every row, every column, and
          every 3×3 box contains the digits 1–9 exactly once. The techniques
          below are ordered roughly from easiest to hardest — the same ladder
          YASP&apos;s engine climbs when it grades a puzzle or offers a hint.
        </p>

        <h2>Basic techniques</h2>

        <div className="tech">
          <h3>Naked single</h3>
          <p>
            A cell whose candidates have been whittled down to a single digit.
            If eight of the nine digits already appear in a cell&apos;s row,
            column, or box, the ninth is forced. These are the bread and butter
            of an <code>Easy</code> puzzle.
          </p>
        </div>

        <div className="tech">
          <h3>Hidden single</h3>
          <p>
            A digit that can legally go in only one cell of a row, column, or
            box — even if that cell still shows several candidates. Scanning each
            unit for a digit with exactly one home is often faster than looking
            at cells one at a time.
          </p>
        </div>

        <div className="tech">
          <h3>Locked candidates (pointing / claiming)</h3>
          <p>
            When every candidate for a digit inside a box lies on a single row
            or column, that digit must fall on that line <em>within the box</em>
            — so you can erase it from the rest of the line. The mirror case:
            if a digit in a row/column is confined to one box, remove it from
            the box&apos;s other cells. This is the signature of a{' '}
            <code>Medium</code> puzzle.
          </p>
        </div>

        <h2>Intermediate techniques</h2>

        <div className="tech">
          <h3>Naked pair / triple</h3>
          <p>
            Two cells in a unit that share the same two candidates form a naked
            pair: those two digits are locked into those two cells, so they can
            be removed from every other cell in the unit. A naked triple extends
            the idea to three cells whose candidates, taken together, use only
            three digits.
          </p>
        </div>

        <div className="tech">
          <h3>Hidden pair</h3>
          <p>
            Two digits that appear as candidates in only the same two cells of a
            unit. Those cells must hold those two digits, so every other
            candidate can be stripped from them — revealing the pair that was
            hiding among the clutter.
          </p>
        </div>

        <h2>Advanced techniques</h2>

        <div className="tech">
          <h3>X-Wing</h3>
          <p>
            Find a digit that appears as a candidate in exactly two cells of one
            row, and in exactly two cells of another row, with all four cells
            sharing the same two columns. The digit must occupy opposite corners
            of that rectangle, which lets you eliminate it from those two columns
            everywhere else. The same pattern works with rows and columns
            swapped. X-Wings turn up in <code>Hard</code> puzzles.
          </p>
        </div>

        <div className="tech">
          <h3>When logic runs out</h3>
          <p>
            Some <code>Extreme</code> puzzles can&apos;t be cracked by the
            techniques above alone — they need chains, colouring, or a
            trial-and-error guess with backtracking. YASP still guarantees every
            generated puzzle has exactly one solution, so a careful guess will
            never lead you astray for long.
          </p>
        </div>

        <h2>Using YASP&apos;s assists</h2>
        <ul>
          <li>
            <strong>Auto candidates</strong> fills every empty cell with its
            legal pencil marks — the starting point for spotting pairs and
            X-Wings.
          </li>
          <li>
            <strong>Hint</strong> names the easiest technique that makes progress
            from the current position and highlights the cells involved.
          </li>
          <li>
            <strong>Solve step</strong> goes one further and places the next
            forced digit for you.
          </li>
          <li>
            Conflicting cells are highlighted in red automatically, so a
            misplaced digit never goes unnoticed.
          </li>
        </ul>

        <p className="footer">
          Techniques are detected by the same solver that grades each puzzle&apos;s
          difficulty — a JavaScript descendant of the original SudokuDomain
          engine.
        </p>
      </article>
    </div>
  );
}
