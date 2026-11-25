// IGrupYazmaRepo'nun gerçeklemesi: grup yazma deyimlerini kendisi yazar; adayları, kilidi, eski hâli,
// iki hâl kuralını ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve deyimi kendi verdiği
// koşul ve veriyle koşturur (TS-007 "Yapı").
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniGrup } from '../../domain/entities/grup.entity.js';
import type { IGrupYazmaRepo } from '../../domain/repositories/i-grup.repository.js';
import type { GrupAdi } from '../../domain/value-objects/grup-adi.js';

// Üst grup yalnız niyet eylemiyle (Grup:tasi) değişir. Silme yumuşaktır: veri silinme zamanıdır.
@Injectable()
export class PrismaGrupYazmaRepo implements IGrupYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { ad, ustGrupId }: YeniGrup,
  ): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      'Grup',
      { ad, ustGrupId },
      (vt, veri) => vt.grup.create({ data: veri }),
    );
  }

  adiniDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: GrupAdi,
  ): Promise<void> {
    return this.kapi.deyimleGuncelle(
      islem,
      isAdi,
      'Grup',
      id,
      { ad },
      (vt, where, veri) => vt.grup.updateMany({ where, data: veri }),
    );
  }

  tasi(
    islem: Islem,
    isAdi: string,
    id: string,
    ustGrupId: string,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Grup',
      'tasi',
      id,
      { ustGrupId },
      (vt, where, veri) => vt.grup.updateMany({ where, data: veri }),
    );
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.deyimleSil(islem, isAdi, 'Grup', id, (vt, where, veri) =>
      vt.grup.updateMany({ where, data: veri }),
    );
  }
}
