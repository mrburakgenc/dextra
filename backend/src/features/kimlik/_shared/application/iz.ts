// Çekirdek parçaların değişiklik kaydı notları. Çekirdek yolda yetenek yoktur: not yetenek ve üyelik
// yerine işin adını taşır (TS-002 "Çekirdek yolların izi"). Yazan ve işin adı çağırandan gelir.
import { varsaIstekBaglami } from '../../../../shared/http/istek-baglami.js';
import type { DegisiklikKaydiNotu } from '../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';

export interface IzBilgisi {
  readonly yazanId: string;
  readonly isAdi: string;
}

type NotunOrtakAlanlari = Omit<DegisiklikKaydiNotu, 'eylem' | 'degisen'>;

// Kaynak model adıdır; kayıt kişiye aitse veri sahibi o kişidir. İstek kimliği, çağrı bir isteğin
// içindeyse istek bağlamından alınır; bağlam yoksa (tohum göçü, komut) boş kalır (TS-002 AK-27).
export function notunOrtakAlanlari(
  iz: IzBilgisi,
  kaynak: string,
  kayitId: string,
  veriSahibiId: string,
): NotunOrtakAlanlari {
  return {
    istek_id: varsaIstekBaglami()?.istekKimligi ?? null,
    kullanici_id: iz.yazanId,
    uyelik_id: null,
    yetenek_id: null,
    is_adi: iz.isAdi,
    baslatan_kullanici_id: null,
    veri_sahibi_kullanici_id: veriSahibiId,
    kaynak,
    kayit_id: kayitId,
  };
}
