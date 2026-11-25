// IRolYazmaRepo'nun gerçeklemesi: rol yazmaları yetki kapısının yazma yüzünden (TS-002 AK-19, AK-39).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniRol } from '../../domain/entities/rol.entity.js';
import type { IRolYazmaRepo } from '../../domain/repositories/i-rol.repository.js';
import type { RolAdi } from '../../domain/value-objects/rol-adi.js';

const KAYNAK = 'Rol';

// Kod sistem alanıdır (AK-41); gövdeden gelmez, yazılmaz.
@Injectable()
export class KapiRolYazmaRepo implements IRolYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(islem: Islem, isAdi: string, rol: YeniRol): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, { ad: rol.ad });
  }

  adDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: RolAdi,
  ): Promise<void> {
    return this.kapi.guncelle(islem, isAdi, KAYNAK, id, { ad });
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.sil(islem, isAdi, KAYNAK, id);
  }
}
