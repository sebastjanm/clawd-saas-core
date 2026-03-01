import type { Metadata } from 'next';
import { ThemeProvider } from '@/shared/components/client/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyAI Start — AI Content Factory',
  description: 'AI Content Production SaaS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased noise">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
