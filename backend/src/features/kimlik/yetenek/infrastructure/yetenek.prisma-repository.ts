import { Injectable } from '@nestjs/common';
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { KosulOgesi } from '../../../../shared/yetki/sart-cevirici.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import {
  type YeniYetenek,
  type YetenekRepo,
  YetenekYazmaRepo,
} from '../domain/yetenek.repository.js';

const KAYNAK = 'Yetenek';

// Yönetim uçlarının yazdığı satırın kökeni (TS-002 "Veri modeli").
const YONETICI_KOKENI = 'yonetici';

const YENILEME_EYLEMI = 'yenile';

@Injectable()
export class YetenekKapiYazmaRepo extends YetenekYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

  // Boş şart ve boş kolon listesi yazılmaz; kolon NULL kalır (yetenek_kayit_siniri_denetim ve
  // yetenek_kolon_siniri_denetim kısıtları NULL'a bakar).
  olustur(
    islem: Islem,
    isAdi: string,
    { sart, kolonlar, ...yetenek }: YeniYetenek,
  ): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, {
      ...yetenek,
      sart: sart ?? undefined,
      kolonlar: kolonlar ?? undefined,
      koken: YONETICI_KOKENI,
    });
  }

  kapat(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.niyet(islem, isAdi, KAYNAK, YENILEME_EYLEMI, id, {
      silinmeZamani: new Date(),
    });
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.sil(islem, isAdi, KAYNAK, id);
  }
}

// Canlılık süzgecini kapı uygular (TS-002 AK-42): silinme zamanını göremeyen yetenek de listeye
// katılır. Kimlik süzgeçleri çağıranın koşuludur; baktıkları kolonu göremeyen yetenek katılmaz.
export function yetenekPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<YetenekRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ grupId, rolId, izinId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul: Object.entries({ grupId, rolId, izinId }).flatMap(
          ([alan, deger]): KosulOgesi[] =>
            deger === undefined ? [] : [{ alan, islec: 'esit', deger }],
        ),
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
    // Kimliğe göre süzme her okuma kuralında serbesttir (AK-38).
    izin: async (id) =>
      (
        await kapi.liste(istemci, 'Izin', {
          kosul: [{ alan: 'id', islec: 'esit', deger: id }],
        })
      )[0],
  });
}
