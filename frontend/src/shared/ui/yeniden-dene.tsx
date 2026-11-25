'use client';

import { usePathname, useSearchParams } from 'next/navigation';

// O anki sayfanın adresine (sorgusuyla) tam sayfa yüklemesiyle giden 'Yeniden dene' bağlantısı;
// yükleme ara katmanı yeniden koşturur. Sunucudaki düzen adresi bilmediği için istemcide kurulur.
// Biçim çağırandan gelir: bağlantı biçimi yalnız sunucuda yüklenen modüldedir.
export function YenidenDene({ className }: Readonly<{ className: string }>) {
  const yol = usePathname();
  const sorgu = useSearchParams().toString();
  return (
    <a href={sorgu === '' ? yol : `${yol}?${sorgu}`} className={className}>
      Yeniden dene
    </a>
  );
}
