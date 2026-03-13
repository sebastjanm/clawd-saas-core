import type { Metadata } from 'next';
import { ThemeProvider } from '@/shared/components/client/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oly Control',
  description: 'AI Agent Content Pipeline Dashboard',
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
