import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dextra',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        {/* Ana içeriğe atlama bağlantısı (kanon FE-A11Y-10); her sayfanın main öğesi ana-icerik'tir. */}
        <a
          href="#ana-icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-white"
        >
          Ana içeriğe atla
        </a>
        {children}
      </body>
    </html>
  );
}
