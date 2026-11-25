// IYetenekYazmaRepo'nun gerçeklemesi: yetenek yazma deyimlerini kendisi yazar; adayları, kilidi, eski
// hâli ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve deyimi kendi verdiği koşul ve
// veriyle koşturur (TS-007 "Yapı").
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniYetenek } from '../../domain/entities/yetenek.entity.js';
import type { IYetenekYazmaRepo } from '../../domain/repositories/i-yetenek.repository.js';

// Yönetim uçlarının yazdığı satırın kökeni (TS-002 "Veri modeli").
const YONETICI_KOKENI = 'yonetici';

const YENILEME_EYLEMI = 'yenile';

// Silme yumuşaktır: veri silinme zamanıdır.
@Injectable()
export class PrismaYetenekYazmaRepo implements IYetenekYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  // Boş şart ve boş kolon listesi yazılmaz; kolon NULL kalır (yetenek_kayit_siniri_denetim ve
  // yetenek_kolon_siniri_denetim kısıtları NULL'a bakar).
  olustur(
    islem: Islem,
    isAdi: string,
    { sart, kolonlar, ...yetenek }: YeniYetenek,
  ): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      'Yetenek',
      {
        ...yetenek,
        sart: sart ?? undefined,
        kolonlar: kolonlar ?? undefined,
        koken: YONETICI_KOKENI,
      },
      (vt, veri) => vt.yetenek.create({ data: veri }),
    );
  }

  kapat(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Yetenek',
      YENILEME_EYLEMI,
      id,
      { silinmeZamani: new Date() },
      (vt, where, veri) => vt.yetenek.updateMany({ where, data: veri }),
    );
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.deyimleSil(
      islem,
      isAdi,
      'Yetenek',
      id,
      (vt, where, veri) => vt.yetenek.updateMany({ where, data: veri }),
    );
  }
}
