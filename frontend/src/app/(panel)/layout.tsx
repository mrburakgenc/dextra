import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { cikisYap } from '../../features/kimlik/eylemler';
import { erisimBelirteciniOku } from '../../shared/oturum/cerezler';
import { GonderDugmesi } from '../../shared/ui/gonder-dugmesi';

// Korumalı düzen: erişim çerezi yoksa backend'e gidilmeden giriş ekranına dönülür. Bu bir
// kolaylıktır, güvenlik denetimi değildir; kararı backend verir (TS-004).
export default async function PanelDuzeni({
  children,
}: Readonly<{ children: ReactNode }>) {
  if ((await erisimBelirteciniOku()) === undefined) {
    redirect('/giris');
  }
  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-300 px-8 py-4">
        <p className="text-xl font-bold">Dextra</p>
        <form action={cikisYap}>
          <GonderDugmesi>Çıkış</GonderDugmesi>
        </form>
      </header>
      {children}
    </>
  );
}
