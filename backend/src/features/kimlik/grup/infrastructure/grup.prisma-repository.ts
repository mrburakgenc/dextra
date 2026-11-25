import { Injectable } from '@nestjs/common';
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { OkumaKapisi } from '../../../../shared/yetki/okuma-kapisi.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import {
  type GrupOkumaRepo,
  GrupYazmaRepo,
  type YeniGrup,
} from '../domain/grup.repository.js';

const KAYNAK = 'Grup';

@Injectable()
export class GrupKapiYazmaRepo extends GrupYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

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
    ad: string,
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

// Liste düzdür: her kayıt ustGrupId taşır, ağacı ekran kurar. Liste yalnız canlı kayıtları verir;
// süzgeci kapı uygular, kişinin baktığı kolonlara girmez (TS-002 AK-42). Tek kayıt süzülmez.
export function grupPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<GrupOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: ({ ustGrupId, siralama, atla, al }) =>
      kapi.liste(istemci, KAYNAK, {
        kosul:
          ustGrupId === undefined
            ? []
            : [{ alan: 'ustGrupId', islec: 'esit', deger: ustGrupId }],
        siralama: siralama === undefined ? [] : [siralama],
        sayfa: { atla, al },
        yalnizCanli: true,
      }),
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
