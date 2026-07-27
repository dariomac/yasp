import './globals.css';

export const metadata = {
  title: 'YASP — Yet Another Sudoku Program',
  description:
    'A modern Next.js port of the classic 2003 .NET Sudoku: symmetric puzzle generation, difficulty grading, pencil marks, conflict checking and logical hints — all client-side.',
};

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
