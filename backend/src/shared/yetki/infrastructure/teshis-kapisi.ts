import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Prisma } from '../../database/generated/client.js';
import type { RepoIstemcisi } from '../../database/infrastructure/registrar.js';
import type { PrismaKosulu } from '../application/sart-cevirici.js';
import { teshisKarari, teshisKurallari } from '../application/teshis.js';
import type { DerlenmisKural } from '../application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../domain/kaynak-katalogu.js';
import type { Kayit, Teshis } from '../domain/okuma-tipleri.js';
import { OkumaKapisi } from './okuma-kapisi.js';
import { YetkiBellegi } from './yetki-bellegi.js';

type YenidenOku = (
  where: PrismaKosulu,
  select: Record<string, true>,
) => Promise<readonly Kayit[]>;

// Kaynağın modelinin okuma vekili; teşhisin repository'si kaydı bununla okur.
export interface KayitOkuyucu {
  findMany(args: {
    where: PrismaKosulu;
    select: Record<string, true>;
  }): Promise<Kayit[]>;
}

// Bir kişinin bir eylem ve kaynaktaki teşhis yetkisi. Repository kaydı kendisi okur: satır süzgeci ve
// kolon seçimi buradan gelir, okumayı kayitlar kapatır; kayitlar kaydı soran göremiyorsa tanımsız döner.
export interface TeshisYetkisi {
  // Soranın okuma süzgeci.
  readonly satirlar: PrismaKosulu;
  // Yalnız kimlik: kaydın kolon değerleri teşhise girmez.
  readonly kolonlar: Record<string, true>;
  okuyucu(istemci: RepoIstemcisi): KayitOkuyucu;
  kayitlar(
    sayfa: readonly Kayit[],
    yenidenOku: YenidenOku,
  ): Promise<Teshis | undefined>;
}

// OkumaYetkisi'nin model tipi olmadan kullanılan hâli.
interface GenelOkumaYetkisi {
  readonly satirlar: PrismaKosulu;
  kayitlar(sayfa: readonly Kayit[], yenidenOku: YenidenOku): Promise<Kayit[]>;
}

// Yetki kapısının teşhis yüzü (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-19 ve AU-32).
// Sorulan kayıt soranın okuma süzgeciyle okunur ve okuma, okuma yüzünün kapatan çağrısıyla kapanır
// (erişim kaydı bugünkü kurallarla yazılır); soran kaydı göremiyorsa teşhis yoktur. Hedef kişinin
// kuralları yetki belleğinden, var olan yetki verisi sözleşmesi ve derleyiciyle gelir. Her şartlı
// kuralın kaydı tutup tutmadığını veritabanı söyler: izin şartıyla, yasak "kesin tutmuyor" koşuluyla,
// soranın süzgeciyle birlikte, repository'nin yeniden okuma deyimiyle sorulur; koşulsuz kural sorgusuz
// tutar (yazma kapısındaki yasak sınamasıyla aynı). Şartı, soranın o kayıtta göremediği bir kolona
// bakan kural sorulmaz, "değerlendirilemedi" olur (kullanıcının kararı, 2026-11-26): süzme görünmeyen
// kolonu ele vermez (TS-008 "Kısıtlar"). Kararı teshisKarari verir.
//
// Yetki belleği kök modülün sağlayıcısıdır ve bu modüle görünmez; çağrı anında kapsayıcıdan alınır.
// Yapıcıda istenmez: iki test (kimlik-kurulum, kimlik-cekirdek) uygulamayı kök modülsüz kurar ve orada
// bellek yoktur.
@Injectable()
export class TeshisKapisi {
  constructor(
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
    private readonly okuma: OkumaKapisi,
    private readonly moduller: ModuleRef,
  ) {}

  async yetki(
    kaynak: string,
    eylem: string,
    kullaniciId: string,
  ): Promise<TeshisYetkisi> {
    const alanlar = this.katalog.alanlar(kaynak);
    if (alanlar === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    const soranin = this.okuma.yetki(kaynak as Prisma.ModelName, {
      bakilan: [],
    }) as unknown as GenelOkumaYetkisi;
    const hedef = await this.moduller
      .get(YetkiBellegi, { strict: false })
      .kisininYetkisi(kullaniciId);
    const kurallar = teshisKurallari(hedef, kaynak, eylem);
    return {
      satirlar: soranin.satirlar,
      kolonlar: { id: true },
      okuyucu: (istemci) => modelOkuyucusu(istemci, kaynak),
      kayitlar: async (sayfa, yenidenOku) => {
        const idler = (await soranin.kayitlar(sayfa, yenidenOku)).map(
          (kayit) => kayit['id'],
        );
        if (idler.length === 0) {
          return undefined;
        }
        const kosulTutar = async (
          satirlar: PrismaKosulu,
          kosul: PrismaKosulu,
        ): Promise<boolean> =>
          (
            await yenidenOku(
              { AND: [{ id: { in: idler } }, satirlar, kosul] },
              { id: true },
            )
          ).length > 0;
        // Süzgeç başına bir kez: soranın süzgeci soranın kendisiyle aynıysa kayıt zaten görünür.
        const gorunurluk = new Map<string, boolean>();
        const gorunur = async (satirlar: PrismaKosulu): Promise<boolean> => {
          const anahtar = JSON.stringify(satirlar);
          let sonuc = gorunurluk.get(anahtar);
          if (sonuc === undefined) {
            sonuc =
              anahtar === JSON.stringify(soranin.satirlar) ||
              (await kosulTutar(satirlar, {}));
            gorunurluk.set(anahtar, sonuc);
          }
          return sonuc;
        };
        const tutanlar: DerlenmisKural[] = [];
        const degerlendirilemeyenler: DerlenmisKural[] = [];
        for (const kural of kurallar) {
          const kosul = kural.giremez
            ? kural.conditions === undefined
              ? undefined
              : kural.kesinTutmuyor
            : (kural.conditions as PrismaKosulu | undefined);
          if (kosul === undefined) {
            tutanlar.push(kural);
            continue;
          }
          // Şartın baktığı kolonlar soranın okumasında bakılan kolondur (okuma kapısının ölçüsü):
          // onları o kayıtta göremeyen soranın süzgecinde kayıt yoksa şart sorulmaz.
          const satirlar = (
            this.okuma.yetki(kaynak as Prisma.ModelName, {
              bakilan: kosulKolonlari(kural.conditions),
            }) as unknown as GenelOkumaYetkisi
          ).satirlar;
          if (!(await gorunur(satirlar))) {
            degerlendirilemeyenler.push(kural);
          } else if ((await kosulTutar(satirlar, kosul)) !== kural.giremez) {
            // Şartlı izin, şartı kaydı tutuyorsa; şartlı yasak, "kesin tutmuyor" koşulu kaydı
            // tutmuyorsa kaydı tutar.
            tutanlar.push(kural);
          }
        }
        return teshisKarari(
          hedef,
          kaynak,
          eylem,
          alanlar,
          tutanlar,
          degerlendirilemeyenler,
        );
      },
    };
  }
}

const MANTIK_BICIMLERI = ['AND', 'OR', 'NOT'];

// Koşulun baktığı kolonlar: mantık biçimlerinin dışındaki her anahtar bir kolondur (sartiCevir
// yalnız kolon koşulu yazar).
function kosulKolonlari(kosul: unknown): string[] {
  if (typeof kosul !== 'object' || kosul === null) {
    return [];
  }
  return Object.entries(kosul).flatMap(([anahtar, deger]) =>
    MANTIK_BICIMLERI.includes(anahtar)
      ? [deger].flat().flatMap(kosulKolonlari)
      : [anahtar],
  );
}

// Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir.
function modelOkuyucusu(istemci: RepoIstemcisi, kaynak: string): KayitOkuyucu {
  const okuyucu = (istemci as unknown as Partial<Record<string, KayitOkuyucu>>)[
    kaynak.charAt(0).toLowerCase() + kaynak.slice(1)
  ];
  if (okuyucu === undefined) {
    throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
  }
  return okuyucu;
}
