import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToasterProvider } from '@/components/providers/ToasterProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'Narrator Studio',
    template: '%s | Narrator Studio',
  },
  description:
    'AI-powered content processing and publishing studio. Upload, analyse, edit, and export documents — with teleprompter mode, narration, and PowerPoint export.',
  keywords: ['AI writing', 'content studio', 'teleprompter', 'grammar check', 'document editor'],
  authors: [{ name: 'Narrator Studio' }],
  robots: 'noindex',
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ToasterProvider />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
