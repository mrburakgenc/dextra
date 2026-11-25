// Oturum alt özelliğinin işlerine ortak yardımcı: kapatılan oturumun değişiklik kaydı notu (çıkış,
// giriş ve yenileme kullanır).
import type { DegisiklikKaydiNotu } from '../../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import type { KapatilmaNedeni } from '../../../_shared/domain/kapatilma-nedeni.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../../_shared/application/iz.js';

// Kapatılan oturumun değişiklik kaydı notu. Yalnız kapatılmamış satır güncellendiği için iki kolonun
// eski değeri boştur.
export function kapatmaNotu(
  iz: IzBilgisi,
  oturum: { id: string; kullaniciId: string },
  neden: KapatilmaNedeni,
  kapatilmaZamani: Date,
): DegisiklikKaydiNotu {
  return {
    ...notunOrtakAlanlari(iz, 'Oturum', oturum.id, oturum.kullaniciId),
    eylem: 'guncelleme',
    degisen: {
      kapatilma_zamani: { eski: null, yeni: kapatilmaZamani.toISOString() },
      kapatilma_nedeni: { eski: null, yeni: neden },
    },
  };
}
