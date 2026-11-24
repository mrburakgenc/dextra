import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import { RolYazici } from '../domain/rol-yazici.port.js';

const KAYNAK = 'Rol';

// Rol yazmaları yetki kapısının yazma yüzünden (TS-002 AK-19, AK-39). Kod sistem alanıdır (AK-41);
// gövdeden gelmez, yazılmaz.
@Injectable()
export class KapiRolYazici extends RolYazici {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

  olustur(islem: Islem, isAdi: string, ad: string): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, { ad });
  }

  adDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: string,
  ): Promise<void> {
    return this.kapi.guncelle(islem, isAdi, KAYNAK, id, { ad });
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.sil(islem, isAdi, KAYNAK, id);
  }
}
