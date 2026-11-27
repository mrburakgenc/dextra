'use client';

import { YenidenDene } from '../shared/ui/yeniden-dene';

// Kök hata sınırı: kök düzenin altındaki bir sayfa ya da düzen fırlatırsa çatının varsayılan
// ekranı yerine sabit ileti ve aynı adrese tam sayfa yüklemesiyle giden 'Yeniden dene' gösterilir;
// yükleme ara katmanı yeniden koşturur. Hatanın iletisi, yığını ve özeti ekrana ve günlüğe yazılmaz.
export default function KokHataSiniri() {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <p role="alert">Beklenmeyen bir hata oluştu</p>
      <p>
        <YenidenDene className="text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" />
      </p>
    </main>
  );
}
