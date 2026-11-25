// IKullaniciYazmaRepo'nun gerçeklemesi: kullanıcı yazmaları ve niyetleri yetki kapısının yazma yüzünden
// (TS-002 AK-19, AK-39).
import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';
import type { YeniKullanici } from '../../domain/entities/kullanici.entity.js';
import type { IKullaniciYazmaRepo } from '../../domain/repositories/i-kullanici.repository.js';
import type { GorunenAd } from '../../domain/value-objects/gorunen-ad.js';

const KAYNAK = 'Kullanici';

@Injectable()
export class KapiKullaniciYazmaRepo implements IKullaniciYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    { kullaniciAdi, gorunenAd }: YeniKullanici,
  ): Promise<string> {
    return this.kapi.olustur(islem, isAdi, KAYNAK, { kullaniciAdi, gorunenAd });
  }

  gorunenAdiDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    gorunenAd: GorunenAd,
  ): Promise<void> {
    return this.kapi.guncelle(islem, isAdi, KAYNAK, id, { gorunenAd });
  }

  parolaBaglantisiNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
  ): Promise<void> {
    return this.kapi.niyet(
      islem,
      isAdi,
      KAYNAK,
      'parola_baglantisi_uret',
      id,
      {},
    );
  }

  pasifeAlNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    pasifZamani?: Date,
  ): Promise<void> {
    return this.kapi.niyet(islem, isAdi, KAYNAK, 'pasife_al', id, {
      pasifZamani,
    });
  }

  yenidenAcNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    isaretiKaldir: boolean,
  ): Promise<void> {
    return this.kapi.niyet(
      islem,
      isAdi,
      KAYNAK,
      'yeniden_ac',
      id,
      isaretiKaldir ? { pasifZamani: null } : {},
    );
  }
}
