import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FantasyForge - NFL Fantasy Analysis",
  description: "Dominate your fantasy league with AI-powered insights, player comparisons, and trade analysis.",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/my-leagues", label: "My Leagues", icon: "🏆" },
  { href: "/waivers", label: "Waivers", icon: "📋" },
  { href: "/players", label: "Players", icon: "🏈" },
  { href: "/compare", label: "Compare", icon: "⚔️" },
  { href: "/start-sit", label: "Start/Sit", icon: "🎯" },
  { href: "/trade", label: "Trade", icon: "🔄" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-field-dark bg-field">
          {/* Decorative gradient orbs */}
          <div className="fixed top-0 left-1/4 w-96 h-96 bg-turf/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <header className="mb-8 text-center animate-fade-in">
              <Link href="/" className="inline-flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
                <span className="text-4xl">🏈</span>
                <h1 className="text-4xl md:text-5xl font-bold text-gradient-turf tracking-tight">
                  FantasyForge
                </h1>
              </Link>
              <p className="text-text-secondary text-lg max-w-xl mx-auto">
                Dominate your fantasy league with data-driven insights
              </p>
            </header>

            {/* Navigation */}
            <nav className="mb-8 animate-fade-in">
              <div className="card-glass p-2 flex flex-wrap justify-center gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:text-turf hover:bg-turf/10 transition-all"
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {/* Main Content */}
            <main className="card-glass p-6 md:p-8 animate-slide-up glow-turf">
              {children}
            </main>

            {/* Footer */}
            <footer className="mt-8 text-center text-text-muted text-sm">
              <p>Built with <span className="text-turf">♥</span> for fantasy football fans</p>
              <p className="mt-1 text-xs">Data provided by Sleeper API</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
