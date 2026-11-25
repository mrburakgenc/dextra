// Yetki kapısının kaynak adıyla çalışan eski yüzü (TS-007 "Adlar, denetim ve geçiş"): kaynak kodundan
// çıktı, motoru sınayan testlerin yardımcısıdır. Yeni yüzün (OkumaKapisi.yetki ve YazmaKapisi'nin
// deyimle başlayan işlevleri) üstünde ince bir sarmalayıcıdır; işlevlerin imzası eski yüzünkiyle
// aynıdır. Modelin vekilini kaynak adından bulur ve sorguyu ya da yazma deyimini kendisi kurar; motorun
// kuralları yalnız yeni yüzdedir. Feature kodu bu dosyayı içe aktarmaz (yapı denetimi).
import type { RepoIstemcisi } from '../../src/shared/database/infrastructure/registrar.js';
import type { Islem } from '../../src/shared/database/domain/islem.js';
import { Prisma } from '../../src/shared/database/generated/client.js';
import { KodluHata } from '../../src/shared/http/domain/kodlu-hata.js';
import type { PrismaKosulu } from '../../src/shared/yetki/application/sart-cevirici.js';
import type { AlanTipi } from '../../src/shared/yetki/domain/alan-tipi.js';
import type { KaynakKatalogu } from '../../src/shared/yetki/domain/kaynak-katalogu.js';
import type {
  Kayit,
  Siralama,
} from '../../src/shared/yetki/domain/okuma-tipleri.js';
import { OkumaKapisi } from '../../src/shared/yetki/infrastructure/okuma-kapisi.js';
import type {
  YazmaKapisi,
  YazmaVerisi,
} from '../../src/shared/yetki/infrastructure/yazma-kapisi.js';
import { type KosulOgesi, kosuluCevir } from './kosul-cevirici.js';

// Çağıranın listeye verdiği koşul, sıralama ve sayfa; koşul yetkinin satır süzgeciyle "ve" ile birleşir.
// yalnizCanli açıkken yalnız silinme zamanı boş kayıtlar gelir (TS-002 AK-42); bu süzgeç kapınındır,
// çağıranın koşulu değildir: baktığı kolon, katılan yetenekler hesabına girmez. Silinme zamanı alanı
// olmayan kaynakta hatadır.
export interface ListeIstegi {
  readonly kosul?: readonly KosulOgesi[];
  readonly siralama?: readonly Siralama[];
  readonly sayfa?: { readonly atla: number; readonly al: number };
  readonly yalnizCanli?: boolean;
}

const SILINME_ALANI = 'silinmeZamani';

interface OkumaVekili {
  findMany(
    args: object,
  ): Promise<({ readonly id: unknown } & Record<string, unknown>)[]>;
}

interface YazmaVekili {
  create(args: object): Promise<Record<string, unknown>>;
  updateMany(args: object): Promise<{ count: number }>;
  deleteMany(args: object): Promise<{ count: number }>;
}

interface Okuma {
  readonly kosul: PrismaKosulu;
  // Çağıranın süzgecinin ve sıralamasının baktığı kolonlar.
  readonly bakilan: readonly string[];
  readonly siralama: readonly Siralama[];
  readonly sayfa?: ListeIstegi['sayfa'];
}

// Kaynak adını model adına çevirir; model olmayan ad hatadır.
function modelAdi(kaynak: string): Prisma.ModelName {
  const ad = Object.values(Prisma.ModelName).find((m) => m === kaynak);
  if (ad === undefined) {
    throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
  }
  return ad;
}

// Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir.
function vekilAdi(kaynak: string): string {
  return kaynak.charAt(0).toLowerCase() + kaynak.slice(1);
}

export class EskiOkumaKapisi {
  private readonly kapi: OkumaKapisi;

  constructor(private readonly katalog: KaynakKatalogu) {
    this.kapi = new OkumaKapisi(katalog);
  }

  async liste(
    istemci: RepoIstemcisi,
    kaynak: string,
    istek: ListeIstegi = {},
  ): Promise<Kayit[]> {
    const { alanlar, tipler, vekil } = this.kaynak(istemci, kaynak);
    const ceviri = kosuluCevir(istek.kosul ?? [], tipler);
    // Tipi uymayan değer istekten gelir (uç şemasından kaçmıştır); veritabanına gitmeden doğrulama
    // hatası olur (TS-002 AK-44). Öbür çeviri hataları kodundur.
    if ('uyumsuz' in ceviri) {
      throw new KodluHata('dogrulama_hatasi', 'İstek doğrulanamadı', [
        { alan: 'kosul', neden: ceviri.uyumsuz },
      ]);
    }
    if ('neden' in ceviri) {
      throw new Error(`Okuma koşulu çevrilemedi: ${ceviri.neden}`);
    }
    const siralama = istek.siralama ?? [];
    for (const { alan } of siralama) {
      if (!alanlar.includes(alan)) {
        throw new Error(`Sıralama için bilinmeyen alan: ${alan}`);
      }
    }
    if (istek.yalnizCanli === true && !alanlar.includes(SILINME_ALANI)) {
      throw new Error(`Silinme zamanı alanı olmayan kaynak: ${kaynak}`);
    }
    return this.oku(kaynak, vekil, {
      kosul:
        istek.yalnizCanli === true
          ? { AND: [ceviri.kosul, { [SILINME_ALANI]: null }] }
          : ceviri.kosul,
      bakilan: [
        ...(istek.kosul ?? []).map((oge) => oge.alan),
        ...siralama.map((oge) => oge.alan),
      ],
      siralama,
      ...(istek.sayfa === undefined ? {} : { sayfa: istek.sayfa }),
    });
  }

  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  async tek(
    istemci: RepoIstemcisi,
    kaynak: string,
    id: string,
  ): Promise<Kayit> {
    const { vekil } = this.kaynak(istemci, kaynak);
    const [kayit] = await this.oku(kaynak, vekil, {
      kosul: { id: { equals: id } },
      bakilan: [],
      siralama: [],
    });
    if (kayit === undefined) {
      throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
    }
    return kayit;
  }

  private kaynak(
    istemci: RepoIstemcisi,
    kaynak: string,
  ): {
    alanlar: readonly string[];
    tipler: Readonly<Record<string, AlanTipi>>;
    vekil: OkumaVekili;
  } {
    const alanlar = this.katalog.alanlar(kaynak);
    const tipler = this.katalog.alanTipleri(kaynak);
    const vekil = (istemci as unknown as Partial<Record<string, OkumaVekili>>)[
      vekilAdi(kaynak)
    ];
    if (alanlar === undefined || tipler === undefined || vekil === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    return { alanlar, tipler, vekil };
  }

  // Tek sorguda sayfa, sonra yeni yüzün kapatma işleviyle kayıtlar.
  private async oku(
    kaynak: string,
    vekil: OkumaVekili,
    okuma: Okuma,
  ): Promise<Kayit[]> {
    const yetki = this.kapi.yetki(modelAdi(kaynak), {
      bakilan: okuma.bakilan,
    });
    const sayfa = await vekil.findMany({
      where: { AND: [okuma.kosul, yetki.satirlar] },
      orderBy: [
        ...okuma.siralama.map(({ alan, yon }) => ({
          [alan]: yon === 'artan' ? 'asc' : 'desc',
        })),
        { id: 'asc' },
      ],
      ...(okuma.sayfa === undefined
        ? {}
        : { skip: okuma.sayfa.atla, take: okuma.sayfa.al }),
      select: yetki.kolonlar,
    });
    return yetki.kayitlar(sayfa, (where, select) =>
      vekil.findMany({ where, select }),
    );
  }
}

export class EskiYazmaKapisi {
  constructor(private readonly kapi: YazmaKapisi) {}

  olustur(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    veri: YazmaVerisi,
  ): Promise<string> {
    return this.kapi.deyimleOlustur(
      islem,
      isAdi,
      modelAdi(kaynak),
      veri,
      (vt, data) => yazmaVekili(vt, kaynak).create({ data }),
    );
  }

  guncelle(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    id: string,
    veri: YazmaVerisi,
  ): Promise<void> {
    return this.kapi.deyimleGuncelle(
      islem,
      isAdi,
      modelAdi(kaynak),
      id,
      veri,
      (vt, where, data) => yazmaVekili(vt, kaynak).updateMany({ where, data }),
    );
  }

  niyet(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    eylem: string,
    id: string,
    veri: YazmaVerisi,
  ): Promise<void> {
    return this.kapi.deyimleNiyet(
      islem,
      isAdi,
      modelAdi(kaynak),
      eylem,
      id,
      veri,
      (vt, where, data) => yazmaVekili(vt, kaynak).updateMany({ where, data }),
    );
  }

  sil(islem: Islem, isAdi: string, kaynak: string, id: string): Promise<void> {
    return this.kapi.deyimleSil(
      islem,
      isAdi,
      modelAdi(kaynak),
      id,
      (vt, where, data) =>
        SILINME_ALANI in data
          ? yazmaVekili(vt, kaynak).updateMany({ where, data })
          : yazmaVekili(vt, kaynak).deleteMany({ where }),
    );
  }
}

function yazmaVekili(vt: RepoIstemcisi, kaynak: string): YazmaVekili {
  const vekil = (vt as unknown as Partial<Record<string, YazmaVekili>>)[
    vekilAdi(kaynak)
  ];
  if (vekil === undefined) {
    throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
  }
  return vekil;
}
