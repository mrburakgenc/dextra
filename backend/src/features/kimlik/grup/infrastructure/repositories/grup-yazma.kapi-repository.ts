// IGrupYazmaRepo'nun gerçeklemesi: grup yazmaları yetki kapısının yazma yüzünden (TS-002 AK-19, AK-39).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniGrup } from '../../domain/entities/grup.entity.js';
import type { IGrupYazmaRepo } from '../../domain/repositories/i-grup.repository.js';
import type { GrupAdi } from '../../domain/value-objects/grup-adi.js';

const KAYNAK = 'Grup';

@Injectable()
export class KapiGrupYazmaRepo implements IGrupYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { ad, ustGrupId }: YeniGrup,
  ): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, { ad, ustGrupId });
  }

  adiniDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: GrupAdi,
  ): Promise<void> {
    return this.kapi.guncelle(islem, isAdi, KAYNAK, id, { ad });
  }

  tasi(
    islem: Islem,
    isAdi: string,
    id: string,
    ustGrupId: string,
  ): Promise<void> {
    return this.kapi.niyet(islem, isAdi, KAYNAK, 'tasi', id, { ustGrupId });
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.sil(islem, isAdi, KAYNAK, id);
  }
}
