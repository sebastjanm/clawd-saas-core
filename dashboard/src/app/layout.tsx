import type { Metadata } from 'next';
import { ThemeProvider } from '@/shared/components/client/ThemeProvider';
import './globals.css';

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME;

export const metadata: Metadata = {
  title: companyName
    ? `EasyAI Start — ${companyName}`
    : 'EasyAI Start — AI Content Factory',
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
