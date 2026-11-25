// IKullaniciYazmaRepo'nun gerçeklemesi: kullanıcı yazma ve niyet deyimlerini kendisi yazar; adayları,
// kilidi, eski hâli, iki hâl kuralını ve değişiklik kaydı notunu yetki kapısının yazma yüzü yürütür ve
// deyimi kendi verdiği koşul ve veriyle koşturur (TS-007 "Yapı").
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniKullanici } from '../../domain/entities/kullanici.entity.js';
import type { IKullaniciYazmaRepo } from '../../domain/repositories/i-kullanici.repository.js';
import type { GorunenAd } from '../../domain/value-objects/gorunen-ad.js';

@Injectable()
export class PrismaKullaniciYazmaRepo implements IKullaniciYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { kullaniciAdi, gorunenAd }: YeniKullanici,
  ): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      'Kullanici',
      { kullaniciAdi, gorunenAd },
      (vt, veri) => vt.kullanici.create({ data: veri }),
    );
  }

  gorunenAdiDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    gorunenAd: GorunenAd,
  ): Promise<void> {
    return this.kapi.deyimleGuncelle(
      islem,
      isAdi,
      'Kullanici',
      id,
      { gorunenAd },
      (vt, where, veri) => vt.kullanici.updateMany({ where, data: veri }),
    );
  }

  parolaBaglantisiNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Kullanici',
      'parola_baglantisi_uret',
      id,
      {},
      (vt, where, veri) => vt.kullanici.updateMany({ where, data: veri }),
    );
  }

  pasifeAlNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    pasifZamani?: Date,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Kullanici',
      'pasife_al',
      id,
      { pasifZamani },
      (vt, where, veri) => vt.kullanici.updateMany({ where, data: veri }),
    );
  }

  yenidenAcNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    isaretiKaldir: boolean,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      'Kullanici',
      'yeniden_ac',
      id,
      isaretiKaldir ? { pasifZamani: null } : {},
      (vt, where, veri) => vt.kullanici.updateMany({ where, data: veri }),
    );
  }
}
