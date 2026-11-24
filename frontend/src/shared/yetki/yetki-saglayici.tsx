'use client';

import { AbilityProvider, useAbility } from '@casl/react';
import { type ReactNode, useMemo } from 'react';
import { type Yetki, type YetkiKurali, yetkiKur } from './yetki';

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

export { Can } from '@casl/react';
