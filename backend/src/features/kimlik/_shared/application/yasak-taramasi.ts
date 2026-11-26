// Göçten önceki yasak taraması (TS-008 "Yönetim, izinler ve teşhis", "Hata modları": yasak bozulur;
// kapanan AU-36; KU-017): canlı yasak satırlarına bozuk yasağın tek tanımını (derleyici) koşan kodun
// kataloğuyla uygular. Yeni bir tanım yazılmaz: şartın biçimi okumadaki şemayla sınanır, gerisini
// derleyici söyler. Kişiye bağlı yer tutucular değerlendirilmez: yazım denetimindeki gibi sabit bir
// isteyenle ve yalnız yeteneğin grubundan oluşan alt grup listesiyle çözülürler; yalnız şartın ve
// kolon listesinin kataloğa uyması sınanır. Tarama hiçbir şey yazmaz.
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/infrastructure/unit-of-work.js';
import type { YetenekSatiri } from '../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';
import { yetenekleriDerle } from '../../../../shared/yetki/application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../../../../shared/yetki/domain/kaynak-katalogu.js';
import { YASAK_TARAMA_CEKIRDEK_REPO } from '../domain/repositories/i-yasak-tarama-cekirdek.repository.js';
import { sartSemasi } from './yetki-verisi.js';

// Yer tutucu "isteyen"in çözüldüğü değer; derleme yalnız koşula çevirir, değer hiçbir sorguya girmez.
const TARAMA_ISTEYENI = 'yasak-taramasi';

export interface BozulacakYasak {
  readonly yetenekId: string;
  readonly kaynak: string;
  readonly eylem: string;
  readonly neden: string;
}

export interface TaramaSonucu {
  readonly tarananSayisi: number;
  readonly bozulacaklar: readonly BozulacakYasak[];
}

@Injectable()
export class YasakTaramasi {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  // Yetenek tablosu ya da iki kolon yoksa (hiç göç uygulanmamış ya da birinci aşamanın göçünden
  // önceki veritabanı) undefined: taranacak yasak yoktur.
  async tara(): Promise<TaramaSonucu | undefined> {
    const saklananlar = await this.uow
      .read(YASAK_TARAMA_CEKIRDEK_REPO)
      .canliYasaklar();
    if (saklananlar === undefined) {
      return undefined;
    }
    const yetenekler: YetenekSatiri[] = saklananlar.map((satir) => {
      const sart = sartSemasi.safeParse(satir.sart ?? []);
      return sart.success
        ? { ...satir, sart: sart.data, yasaktanMuaf: false }
        : { ...satir, sart: [], yasaktanMuaf: false, sartBicimiBozuk: true };
    });
    const altGruplar = Object.fromEntries(
      yetenekler.map(({ grupId }) => [grupId, [grupId]]),
    );
    const { bozukYasaklar } = yetenekleriDerle(
      { yetenekler, altGruplar },
      TARAMA_ISTEYENI,
      this.katalog,
    );
    const nedenler = new Map(
      bozukYasaklar.map(({ yetenekId, neden }) => [yetenekId, neden]),
    );
    return {
      tarananSayisi: yetenekler.length,
      bozulacaklar: yetenekler.flatMap(({ yetenekId, kaynak, eylem }) => {
        const neden = nedenler.get(yetenekId);
        return neden === undefined ? [] : [{ yetenekId, kaynak, eylem, neden }];
      }),
    };
  }
}
