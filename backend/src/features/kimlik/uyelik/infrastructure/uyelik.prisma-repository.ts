import { Injectable } from '@nestjs/common';
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { KosulOgesi } from '../../../../shared/yetki/sart-cevirici.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import {
  type UyelikOkumaRepo,
  UyelikYazmaRepo,
  type YeniUyelik,
} from '../domain/uyelik.repository.js';

const KAYNAK = 'Uyelik';

@Injectable()
export class UyelikKapiYazmaRepo extends UyelikYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

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

// Canlılık süzgecini kapı uygular (TS-002 AK-42); kişinin verdiği süzgeçler çağıranın koşuludur.
export function uyelikPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<UyelikOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ kullaniciId, grupId, rolId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul: (
          [
            ['kullaniciId', kullaniciId],
            ['grupId', grupId],
            ['rolId', rolId],
          ] as const
        ).flatMap(([alan, deger]): KosulOgesi[] =>
          deger === undefined ? [] : [{ alan, islec: 'esit', deger }],
        ),
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
