import type { Prisma } from './generated/client.js';

// Fabrikanın aldığı istemci: run içinde işlemin istemcisi, read için işlemsiz istemci.
export type RepoIstemcisi = Prisma.TransactionClient;

// Belirteç, okuma arayüzünü ve onu genişleten tam arayüzü yalnız tip olarak taşır (KR-011 Yazım biçimi).
export class RepoBelirteci<TOkuma, TTam extends TOkuma> {
  declare private readonly okumaTipi: TOkuma;
  declare private readonly tamTipi: TTam;

  constructor(readonly ad: string) {}
}

export type RepoFabrikasi<TTam> = (istemci: RepoIstemcisi) => TTam;

// Modüllere verilen kayıt yüzü: yalnız register taşır, repository kurmaz.
// Tam repository yalnız run'ın Islem örneğinden, okuma görünümü yalnız read'den alınır.
export abstract class Registrar {
  abstract register<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
    fabrika: RepoFabrikasi<TTam>,
  ): void;
}

// Kayıtları tutan ve kuran yüz; DatabaseModule dışa vermez, yalnız UnitOfWork alır.
export class RepoKayitlari extends Registrar {
  private readonly fabrikalar = new Map<
    RepoBelirteci<unknown, unknown>,
    RepoFabrikasi<unknown>
  >();

  register<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
    fabrika: RepoFabrikasi<TTam>,
  ): void {
    if (this.fabrikalar.has(belirtec)) {
      throw new Error(`${belirtec.ad} zaten kayıtlı`);
    }
    this.fabrikalar.set(belirtec, fabrika);
  }

  kur<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
    istemci: RepoIstemcisi,
  ): TTam {
    const fabrika = this.fabrikalar.get(belirtec);
    if (fabrika === undefined) {
      throw new Error(`${belirtec.ad} kayıtlı değil`);
    }
    return fabrika(istemci) as TTam;
  }
}
