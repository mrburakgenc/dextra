import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  YETKI_VERISI,
  type YetkiSurumleri,
  type YetkiVerisi,
} from '../kimlik/yetki-verisi.contract.js';
import { KAYNAK_KATALOGU, type KaynakKatalogu } from './kaynak-katalogu.js';
import { type DerlemeSonucu, yetenekleriDerle } from './yetenek-derleyici.js';

// Bellekte en çok bu kadar kişinin derlenmiş yetkisi durur; dolunca en eski kullanılan atılır.
export const YETKI_BELLEGI_SINIRI = 10_000;

interface Kayit extends YetkiSurumleri {
  readonly yetki: DerlemeSonucu;
}

// Yetki belleği (TS-002 AK-17; KR-010 Seçim 24 ve 32): derlenmiş yetki kişi başına süreç belleğinde,
// iki sürüm sayısıyla damgalı durur. Verilen sürümler damgayla aynıysa kayıt kullanılır, değilse yetki
// verisi yeniden okunup derlenir. Damga okunan verinin sürümleridir: sürümler satırlardan önce
// okunduğu için arada yazılan yetki eski damgayla saklanır ve sonraki istekte yenilenir. Derlenmeyen
// satırlar günlüğe kimliği ve nedeniyle yazılır. Redis katmanı bu adımda yoktur.
@Injectable()
export class YetkiBellegi {
  private readonly gunluk = new Logger(YetkiBellegi.name);
  // Map ekleme sırasını korur: ilk anahtar en eski kullanılandır.
  private readonly kayitlar = new Map<string, Kayit>();

  constructor(
    @Inject(YETKI_VERISI) private readonly veri: YetkiVerisi,
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  async al(
    kullaniciId: string,
    surumler: YetkiSurumleri,
  ): Promise<DerlemeSonucu> {
    const kayit = this.kayitlar.get(kullaniciId);
    this.kayitlar.delete(kullaniciId);
    if (
      kayit?.kisiSurumu === surumler.kisiSurumu &&
      kayit.genelSurum === surumler.genelSurum
    ) {
      this.kayitlar.set(kullaniciId, kayit);
      return kayit.yetki;
    }
    const satirlar = await this.veri.kisininSatirlari(kullaniciId);
    // Yeteneğin grubu ve rolü aynı üyelikten okunur (KR-008 Seçim 44); o üyelik yeteneği verendir.
    const uyelikler: Record<string, string> = {};
    for (const { yetenekId, grupId, rolId } of satirlar.yetenekler) {
      const uyelik = satirlar.uyelikler.find(
        (u) => u.grupId === grupId && u.rolId === rolId,
      );
      if (uyelik !== undefined) {
        uyelikler[yetenekId] = uyelik.uyelikId;
      }
    }
    const yetki: DerlemeSonucu = {
      ...yetenekleriDerle(satirlar, kullaniciId, this.katalog),
      uyelikler,
    };
    for (const { yetenekId, neden } of yetki.derlenmeyenler) {
      this.gunluk.warn(
        `Yetenek derlenmedi: yetenek=${yetenekId} neden=${neden}`,
      );
    }
    this.kayitlar.set(kullaniciId, {
      kisiSurumu: satirlar.kisiSurumu,
      genelSurum: satirlar.genelSurum,
      yetki,
    });
    if (this.kayitlar.size > YETKI_BELLEGI_SINIRI) {
      const [enEski] = this.kayitlar.keys();
      if (enEski !== undefined) {
        this.kayitlar.delete(enEski);
      }
    }
    return yetki;
  }
}
