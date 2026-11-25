import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';
import { ROL_REPO, type Sayfa } from '../domain/rol.repository.js';
import type { ListeCevabi, ListeSorgusu } from './liste.query.js';

// Rol ve izin okumaları (TS-002 "Uçlar ve izinler": Rol:oku, Izin:oku). Sonraki sayfanın varlığı,
// boyuttan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class RolSorgulariHandler {
  constructor(private readonly uow: UnitOfWork) {}

  roller(sorgu: ListeSorgusu): Promise<ListeCevabi> {
    return sayfala(sorgu, (siralama, sayfa) =>
      this.uow.read(ROL_REPO).roller(siralama, sayfa),
    );
  }

  rol(id: string): Promise<Kayit> {
    return this.uow.read(ROL_REPO).rol(id);
  }

  izinler(sorgu: ListeSorgusu): Promise<ListeCevabi> {
    return sayfala(sorgu, (siralama, sayfa) =>
      this.uow.read(ROL_REPO).izinler(siralama, sayfa),
    );
  }
}

async function sayfala(
  { sayfa, boyut, siralama }: ListeSorgusu,
  oku: (siralama: readonly Siralama[], sayfa: Sayfa) => Promise<Kayit[]>,
): Promise<ListeCevabi> {
  const kayitlar = await oku(siralama, {
    atla: (sayfa - 1) * boyut,
    al: boyut + 1,
  });
  return {
    kayitlar: kayitlar.slice(0, boyut),
    sayfa,
    boyut,
    sonrakiVar: kayitlar.length > boyut,
  };
}
