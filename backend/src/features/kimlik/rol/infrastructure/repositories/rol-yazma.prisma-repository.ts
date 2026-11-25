// IRolYazmaRepo'nun gerçeklemesi: rol yazma deyimlerini kendisi yazar; adayları, kilidi, eski hâli, iki
// hâl kuralını ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve deyimi kendi verdiği
// koşul ve veriyle koşturur (TS-007 "Yapı").
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniRol } from '../../domain/entities/rol.entity.js';
import type { IRolYazmaRepo } from '../../domain/repositories/i-rol.repository.js';
import type { RolAdi } from '../../domain/value-objects/rol-adi.js';

// Kod sistem alanıdır (AK-41); gövdeden gelmez, yazılmaz. Silme yumuşaktır: veri silinme zamanıdır.
@Injectable()
export class PrismaRolYazmaRepo implements IRolYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(islem: Islem, isAdi: string, rol: YeniRol): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      'Rol',
      { ad: rol.ad },
      (vt, veri) => vt.rol.create({ data: veri }),
    );
  }

  adDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: RolAdi,
  ): Promise<void> {
    return this.kapi.deyimleGuncelle(
      islem,
      isAdi,
      'Rol',
      id,
      { ad },
      (vt, where, veri) => vt.rol.updateMany({ where, data: veri }),
    );
  }

  sil(islem: Islem, isAdi: string, id: string): Promise<void> {
    return this.kapi.deyimleSil(islem, isAdi, 'Rol', id, (vt, where, veri) =>
      vt.rol.updateMany({ where, data: veri }),
    );
  }
}
