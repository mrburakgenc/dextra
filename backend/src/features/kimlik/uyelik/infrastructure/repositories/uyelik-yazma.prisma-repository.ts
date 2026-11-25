// IUyelikYazmaRepo'nun gerçeklemesi: üyelik yazma deyimlerini kendisi yazar; adayları, kilidi, eski
// hâli ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve deyimi kendi verdiği koşul ve
// veriyle koşturur (TS-007 "Yapı").
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniUyelik } from '../../domain/entities/uyelik.entity.js';
import type { IUyelikYazmaRepo } from '../../domain/repositories/i-uyelik.repository.js';

// Silme yumuşaktır: veri silinme zamanıdır.
@Injectable()
export class PrismaUyelikYazmaRepo implements IUyelikYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { kullaniciId, grupId, rolId }: YeniUyelik,
  ): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      'Uyelik',
      { kullaniciId, grupId, rolId },
      (vt, veri) => vt.uyelik.create({ data: veri }),
    );
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.deyimleSil(
      islem,
      isAdi,
      'Uyelik',
      id,
      (vt, where, veri) => vt.uyelik.updateMany({ where, data: veri }),
    );
  }
}
