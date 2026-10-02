import './globals.css';
import './platform-v1.css';

export const metadata = {
  metadataBase: new URL('https://www.septlion.com'),
  title: 'Septlion Supply — Demand-Led Product Development & Managed Supply',
  description: 'Septlion turns buyer requirements into production-ready products and managed supply programs across MENA and Africa.',
  keywords: ['B2B supply', 'private label', 'product development', 'MENA', 'Africa', 'managed supply'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Septlion Supply',
    description: 'You define the need. Septlion builds the supply.',
    url: 'https://www.septlion.com',
    siteName: 'Septlion Supply',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
