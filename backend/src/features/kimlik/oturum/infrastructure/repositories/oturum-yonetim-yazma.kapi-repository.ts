// IOturumYonetimYazmaRepo'nun gerçeklemesi: oturum kapatma yetki kapısının yazma yüzünden (TS-002
// AK-19, AK-51).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type {
  IOturumYonetimYazmaRepo,
  OturumKapatmasi,
} from '../../domain/repositories/i-oturum-yonetim.repository.js';

const KAYNAK = 'Oturum';

@Injectable()
export class KapiOturumYonetimYazmaRepo implements IOturumYonetimYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  kapatNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    kapatma?: OturumKapatmasi,
  ): Promise<void> {
    return this.kapi.niyet(islem, isAdi, KAYNAK, 'kapat', id, {
      ...kapatma,
    });
  }
}
