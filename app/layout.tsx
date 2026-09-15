import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FantasyForge - NFL Fantasy Analysis',
  description: 'League-aware fantasy football tools: matchup ratings, lineup optimizer, waiver and trade analysis powered by Sleeper data.',
  applicationName: 'FantasyForge',
  appleWebApp: { capable: true, title: 'FantasyForge', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ServiceWorkerRegister />
        <div className="min-h-screen bg-field-dark bg-field">
          {/* Decorative gradient orbs */}
          <div className="fixed top-0 left-1/4 w-96 h-96 bg-turf/5 rounded-full blur-3xl pointer-events-none" />
          <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative container mx-auto px-4 py-6 md:py-8 max-w-7xl">
            <header className="mb-6 text-center animate-fade-in">
              <Link href="/" className="inline-flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity">
                <span className="text-3xl md:text-4xl" aria-hidden>🏈</span>
                <h1 className="text-3xl md:text-5xl font-bold text-gradient-turf tracking-tight">FantasyForge</h1>
              </Link>
              <p className="text-text-secondary text-base md:text-lg max-w-xl mx-auto">
                Dominate your fantasy league with data-driven insights
              </p>
            </header>

            <SiteNav />

            <main className="card-glass p-4 sm:p-6 md:p-8 animate-slide-up glow-turf">{children}</main>

            <footer className="mt-8 text-center text-text-muted text-sm">
              <p>
                Built with <span className="text-turf">♥</span> for fantasy football fans
              </p>
              <p className="mt-1 text-xs">Data provided by the Sleeper API</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
