import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { yeniKimlik } from '../../../../shared/database/kimlik.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import { OutboxYazici } from '../../../../shared/messaging/outbox/outbox-yazici.js';
import { PAROLA_BAGLANTISI_REPO } from '../domain/repositories/i-parola-baglantisi.repository.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';

// Bağlantının ömrü (KR-009 Seçim 9; TS-002 AK-5): 24 saat.
export const BAGLANTI_OMRU_MS = 24 * 60 * 60 * 1000;
// Kod 32 rastgele bayttır (TS-002 AK-5); çağırana base64url dizgesi olarak döner.
const KOD_BAYT = 32;

// Tabloda duran özet: kodun SHA-256 özeti (onaltılık). Yüksek entropili sırda yavaş özet gerekmez.
export function baglantiKodununOzeti(kod: string): string {
  return createHash('sha256').update(kod).digest('hex');
}

// Çekirdek parça "bağlantı" (TS-002 "Yapı"): parola bağlantısı üretir ve siler. Kişi kilidi alınmış
// bir işlemin içinde çağrılır (kilit sırası: kişi, sonra bağlantı); kendi işlemini açmaz. Notlar
// kodun özetini taşımaz (TS-003 değişmez 6).
@Injectable()
export class ParolaBaglantisi {
  constructor(private readonly yazici: OutboxYazici) {}

  // Kişinin kullanılmamış eski bağlantısını siler, yenisini yazar ve kodu döner. Kod yalnız
  // çağırana döner; hiçbir yere yazılmaz.
  async uret(
    islem: Islem,
    {
      kullaniciId,
      olusturanId,
    }: { kullaniciId: string; olusturanId: string | null },
    iz: IzBilgisi,
  ): Promise<string> {
    await this.sil(islem, kullaniciId, iz);
    const kod = randomBytes(KOD_BAYT).toString('base64url');
    const id = yeniKimlik();
    const sonGecerlilikZamani = new Date(Date.now() + BAGLANTI_OMRU_MS);
    const { olusturmaZamani } = await islem.repo(PAROLA_BAGLANTISI_REPO).ekle({
      id,
      kullaniciId,
      kodOzeti: baglantiKodununOzeti(kod),
      sonGecerlilikZamani,
      olusturanId,
    });
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, 'ParolaBaglantisi', id, kullaniciId),
      eylem: 'olusturma',
      degisen: {
        kullanici_id: { yeni: kullaniciId },
        son_gecerlilik_zamani: { yeni: sonGecerlilikZamani.toISOString() },
        olusturan_id: { yeni: olusturanId },
        olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
      },
    });
    return kod;
  }

  // Kişinin kullanılmamış bağlantısını (varsa) siler.
  async sil(islem: Islem, kullaniciId: string, iz: IzBilgisi): Promise<void> {
    const repo = islem.repo(PAROLA_BAGLANTISI_REPO);
    const eski = await repo.kullanilmamisi(kullaniciId);
    if (eski === null) {
      return;
    }
    await repo.sil(eski.id);
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, 'ParolaBaglantisi', eski.id, kullaniciId),
      eylem: 'silme',
      degisen: {
        kullanici_id: { eski: kullaniciId },
        son_gecerlilik_zamani: { eski: eski.sonGecerlilikZamani.toISOString() },
        olusturan_id: { eski: eski.olusturanId },
        olusturma_zamani: { eski: eski.olusturmaZamani.toISOString() },
      },
    });
  }
}
