import './design-tokens.css';
import './globals.css';
import './platform-v1.css';
import './intelligence.css';
import './offer-workspace.css';
import './trade-workspace.css';
import './customer-experience.css';

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
  icons: {
    icon: [{url:'/favicon.ico'}, {url:'/brand/app-icon-rounded.svg',type:'image/svg+xml'}],
    shortcut: '/favicon.ico',
    apple: '/brand/apple-touch-icon.png',
  },
};

export const viewport = {themeColor:'#051945'};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><head><link rel="preload" href="/fonts/NotoSansArabic-Regular.woff" as="font" type="font/woff" crossOrigin="anonymous"/></head><body>{children}</body></html>;
}
