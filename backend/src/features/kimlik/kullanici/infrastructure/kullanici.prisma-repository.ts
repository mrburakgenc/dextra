import { Injectable } from '@nestjs/common';
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import {
  type KullaniciOkumaRepo,
  KullaniciYazmaRepo,
  type YeniKullanici,
} from '../domain/kullanici.repository.js';

const KAYNAK = 'Kullanici';

@Injectable()
export class KullaniciKapiYazmaRepo extends KullaniciYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

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
    gorunenAd: string,
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
}

export function kullaniciPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<KullaniciOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ pasif, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          pasif === undefined
            ? []
            : [{ alan: 'pasifZamani', islec: pasif ? 'dolu' : 'bos' }],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
