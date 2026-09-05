import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Arus · See the full picture', description: 'Malaysian cash-flow assessment and real-data credit research. Local demonstration prototype.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
