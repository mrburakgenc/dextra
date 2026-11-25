import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import { OutboxYazici } from '../../../../shared/messaging/outbox/outbox-yazici.js';
import {
  KULLANICI_CEKIRDEK_REPO,
  type YeniKullanici,
} from '../domain/repositories/i-kullanici-cekirdek.repository.js';
import { GenelSayac } from './genel-sayac.js';
import { type IzBilgisi, notunOrtakAlanlari } from './iz.js';
import { KisininSayisi } from './kisinin-sayisi.js';
import { KokUyelik, uyelikYaz } from './kok-uyelik.js';

export interface TohumKullanicisi extends YeniKullanici {
  uyelikler: readonly { grupId: string; rolId: string }[];
}

// Çekirdek parça "tohum" (TS-002 "Yapı"; KR-008 Seçim 28 eki): yalnız tohum göçünden, göçün işleminde
// çağrılır. Yalnız yeni kullanıcı yazar: giriş bilgisi zaten varsa tekil kısıt reddeder ve işlem
// geri alınır. Kimliği çağıran ortak kimlik üreticiyle verir; böylece sistem aktörünü yazan iş, notun
// yazanı olarak o aktörün kendi kimliğini verebilir. Aynı görünen adla ikinci bir sistem aktörü
// yazılmaz: aktör görünen adıyla bulunur (kimlikSistemAktoru).
@Injectable()
export class TohumYardimcisi {
  constructor(
    private readonly yazici: OutboxYazici,
    private readonly genelSayac: GenelSayac,
    private readonly kisininSayisi: KisininSayisi,
    private readonly kokUyelik: KokUyelik,
  ) {}

  async yaz(
    islem: Islem,
    { uyelikler, ...kullanici }: TohumKullanicisi,
    iz: IzBilgisi,
  ): Promise<void> {
    // Kilit sırası: önce genel sayaç, sonra kişi (yeni satır yazılınca kilitlidir), sonra üyelikler.
    await this.genelSayac.kilitle(islem, { artir: true });
    const repo = islem.repo(KULLANICI_CEKIRDEK_REPO);
    // Sistem aktörünü yalnız bu yardımcı yazar ve önce genel sayacı kilitler; denetim ile yazma
    // arasına başka bir sistem aktörü yazması giremez.
    if (
      kullanici.sistemAktoru &&
      (await repo.sistemAktoruVarMi(kullanici.gorunenAd))
    ) {
      throw new Error(
        `Görünen adı "${kullanici.gorunenAd}" olan bir sistem aktörü zaten var`,
      );
    }
    const { yetkiSurumu, olusturmaZamani } = await repo.ekle(kullanici);
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, 'Kullanici', kullanici.id, kullanici.id),
      eylem: 'olusturma',
      degisen: {
        kullanici_adi: { yeni: kullanici.kullaniciAdi },
        telefon: { yeni: kullanici.telefon },
        gorunen_ad: { yeni: kullanici.gorunenAd },
        sistem_aktoru: { yeni: kullanici.sistemAktoru },
        yetki_surumu: { yeni: yetkiSurumu },
        olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
      },
    });
    await this.kisininSayisi.artir(islem, kullanici.id, iz);
    if (!kullanici.sistemAktoru) {
      await this.kokUyelik.yaz(islem, kullanici.id, iz);
    }
    for (const uyelik of uyelikler) {
      await uyelikYaz(
        this.yazici,
        islem,
        { kullaniciId: kullanici.id, ...uyelik },
        iz,
      );
    }
  }
}
