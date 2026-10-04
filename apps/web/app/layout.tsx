import './globals.css';
import './platform-v1.css';

export const metadata = {
  metadataBase: new URL('https://www.septlion.com'),
  title: {
    default: 'SEPTLION — Demand-Led Global Trade',
    template: '%s | SEPTLION',
  },
  description: 'SEPTLION is the operating system for demand-led global trade — turning real demand into executable trade from discovery to execution.',
  keywords: ['B2B trade', 'global trade', 'demand intelligence', 'managed supply', 'trade execution', 'MENA', 'Africa'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SEPTLION — Demand-Led Global Trade',
    description: 'From real demand to executed trade.',
    url: 'https://www.septlion.com',
    siteName: 'SEPTLION',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
