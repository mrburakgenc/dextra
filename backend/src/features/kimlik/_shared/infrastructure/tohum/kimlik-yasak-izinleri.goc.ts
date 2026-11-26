import { Injectable } from '@nestjs/common';
import { yeniKimlik } from '../../../../../shared/database/domain/kimlik.js';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { GenelSayac } from '../../application/genel-sayac.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../application/iz.js';
import {
  KURULUM_REPO,
  type YeniYetenek,
} from '../../domain/repositories/i-kurulum.repository.js';

export const KIMLIK_YASAK_IZINLERI_GOCU = '202611260000-kimlik-yasak-izinleri';

// Yetenek kaynağının iki yeni eylemi (TS-008 "Veri modeli"; kapanan AU-18 ve AU-19).
const KAYNAK = 'Yetenek';
const EYLEMLER = ['yasakla', 'teshis'];

type OlusturmaDegisenleri = Extract<
  DegisiklikKaydiNotu,
  { eylem: 'olusturma' }
>['degisen'];

// İki izni yazar ve yalnız (Kök, SuperAdmin) kümesine sistem satırı yetenek olarak verir; temel role
// verilmez (TS-008 "Aşamalar" 1 (b)). Etki ve öncelik veritabanının varsayılanıyla kalır (izin, 0).
// Satırlar ilk kurulum göçününkiler gibi not bırakır; yazanı kimliğin sistem aktörüdür. Yetenek
// eklendiği için genel sayaç artırılır: açık oturumların yetki belleği yenilenir.
@Injectable()
export class KimlikYasakIzinleriGocu {
  constructor(
    private readonly yazici: OutboxYazici,
    private readonly genelSayac: GenelSayac,
  ) {}

  async uygula(ad: string, islem: Islem): Promise<void> {
    await this.genelSayac.kilitle(islem, { artir: true });
    const repo = islem.repo(KURULUM_REPO);
    const iz: IzBilgisi = {
      yazanId: await repo.kimlikSistemAktoru(),
      isAdi: `tohum:${ad}`,
    };
    const { grupId, rolId } = await repo.kokYoneticiKumesi();

    for (const eylem of EYLEMLER) {
      const izinId = yeniKimlik();
      await repo.izinEkle({ id: izinId, kaynak: KAYNAK, eylem });
      await this.not(islem, iz, 'Izin', izinId, {
        kaynak: { yeni: KAYNAK },
        eylem: { yeni: eylem },
      });

      const yetenek: YeniYetenek = {
        id: yeniKimlik(),
        grupId,
        rolId,
        izinId,
        sart: null,
        butunKayitlar: true,
        butunBirimler: true,
        butunKolonlar: true,
        sistemSatiri: true,
        tohumAnahtari: `kimlik:${KAYNAK}:${eylem}:superadmin`,
        koken: 'goc',
      };
      const { olusturmaZamani } = await repo.yetenekEkle(yetenek);
      await this.not(islem, iz, 'Yetenek', yetenek.id, {
        grup_id: { yeni: grupId },
        rol_id: { yeni: rolId },
        izin_id: { yeni: izinId },
        sart: { yeni: null },
        butun_kayitlar: { yeni: true },
        butun_birimler: { yeni: true },
        kolonlar: { yeni: null },
        butun_kolonlar: { yeni: true },
        sistem_satiri: { yeni: true },
        tohum_anahtari: { yeni: yetenek.tohumAnahtari },
        koken: { yeni: 'goc' },
        olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
        giremez: { yeni: false },
        oncelik: { yeni: 0 },
      });
    }
  }

  // İzin ve yetenek bir kişiye ait değildir: veri sahibi boştur.
  private async not(
    islem: Islem,
    iz: IzBilgisi,
    kaynak: string,
    kayitId: string,
    degisen: OlusturmaDegisenleri,
  ): Promise<void> {
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, kaynak, kayitId, iz.yazanId),
      veri_sahibi_kullanici_id: null,
      eylem: 'olusturma',
      degisen,
    });
  }
}
