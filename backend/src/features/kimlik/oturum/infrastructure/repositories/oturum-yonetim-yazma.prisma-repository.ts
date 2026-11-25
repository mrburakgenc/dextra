// IOturumYonetimYazmaRepo'nun gerçeklemesi: oturum kapatmanın yazma deyimini kendisi yazar; adayları,
// kilidi, eski hâli ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve deyimi kendi
// verdiği koşul ve veriyle koşturur (TS-007 "Yapı"; TS-002 AK-51).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type {
  IOturumYonetimYazmaRepo,
  OturumKapatmasi,
} from '../../domain/repositories/i-oturum-yonetim.repository.js';

@Injectable()
export class PrismaOturumYonetimYazmaRepo implements IOturumYonetimYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  kapatNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    kapatma?: OturumKapatmasi,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Oturum',
      'kapat',
      id,
      { ...kapatma },
      (vt, where, veri) => vt.oturum.updateMany({ where, data: veri }),
    );
  }
}
