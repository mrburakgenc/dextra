// IYetenekYazmaRepo'nun gerçeklemesi: yetenek yazmaları yetki kapısının yazma yüzünden (TS-002 AK-19,
// AK-39).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniYetenek } from '../../domain/entities/yetenek.entity.js';
import type { IYetenekYazmaRepo } from '../../domain/repositories/i-yetenek.repository.js';

const KAYNAK = 'Yetenek';

// Yönetim uçlarının yazdığı satırın kökeni (TS-002 "Veri modeli").
const YONETICI_KOKENI = 'yonetici';

const YENILEME_EYLEMI = 'yenile';

@Injectable()
export class KapiYetenekYazmaRepo implements IYetenekYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

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
