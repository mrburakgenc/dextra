'use client';

import { AbilityProvider, useAbility } from '@casl/react';
import { type ReactNode, useMemo } from 'react';
import { kolonCizilir, type Yetki, type YetkiKurali, yetkiKur } from './yetki';

// Kurallar sunucudan düz veri olarak gelir; yetki nesnesi istemcide kurulur.
export function YetkiSaglayici({
  kurallar,
  children,
}: Readonly<{ kurallar: readonly YetkiKurali[]; children: ReactNode }>) {
  const yetki = useMemo(() => yetkiKur(kurallar), [kurallar]);
  return <AbilityProvider value={yetki}>{children}</AbilityProvider>;
}

export function useYetki(): Yetki {
  return useAbility<Yetki>();
}

// Liste tablosunun bir kolonunun başlığını ya da hücresini sarar; kolon çizilmiyorsa hiçbir şey
// çizilmez. Sunucu bileşeni tablolar başlığı ve hücreyi çocuk olarak verir.
export function Kolon({
  a,
  alanlar,
  children,
}: Readonly<{ a: string; alanlar: readonly string[]; children: ReactNode }>) {
  return kolonCizilir(useYetki(), a, alanlar) ? children : null;
}

export { Can } from '@casl/react';
