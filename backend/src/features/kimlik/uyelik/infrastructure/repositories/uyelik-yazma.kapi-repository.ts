// IUyelikYazmaRepo'nun gerçeklemesi: üyelik yazmaları yetki kapısının yazma yüzünden (TS-002 AK-19,
// AK-39).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniUyelik } from '../../domain/entities/uyelik.entity.js';
import type { IUyelikYazmaRepo } from '../../domain/repositories/i-uyelik.repository.js';

const KAYNAK = 'Uyelik';

@Injectable()
export class KapiUyelikYazmaRepo implements IUyelikYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { kullaniciId, grupId, rolId }: YeniUyelik,
  ): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, {
      kullaniciId,
      grupId,
      rolId,
    });
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.sil(islem, isAdi, KAYNAK, id);
  }
}
