import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FISEI UTA 2026 - Mando y Supervisión Conversacional',
  description: 'Panel de control en tiempo real para supervisión y handover de agentes IA'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
