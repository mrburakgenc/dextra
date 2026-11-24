// Çekirdek repository: yetki verisini ve sürümleri yetki kapısından geçmeden okur (TS-002 "Çekirdek
// yollar": yetki verisinin ve sürümlerin okunması; KR-010 Seçim 48'in adıyla istisnası). Yalnız
// okur; her metot tek sorgudur ve metotlar arasında ortak anlık görüntü yoktur.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type {
  SartOgesi,
  UyelikSatiri,
  YetenekSatiri,
  YetkiSurumleri,
} from '../../../../shared/kimlik/yetki-verisi.contract.js';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export interface CanliGrup {
  readonly id: string;
  readonly ustGrupId: string | null;
}

export interface YetkiVerisiOkumaRepo {
  // Kişi ya da genel sayaç satırı yoksa Prisma'nın "kayıt yok" hatası atılır.
  surumler(kullaniciId: string): Promise<YetkiSurumleri>;
  // Kişinin silinmemiş üyelikleri.
  uyelikler(kullaniciId: string): Promise<UyelikSatiri[]>;
  // Verilen (grup, rol) çiftlerinden birine bağlı silinmemiş yetenekler, izniyle (KR-008 Seçim 44:
  // grup ve rol aynı üyelikten gelir).
  yetenekler(
    ciftler: readonly Pick<UyelikSatiri, 'grupId' | 'rolId'>[],
  ): Promise<YetenekSatiri[]>;
  // Silinmemiş grupların tamamı; alt gruplar bellekte hesaplanır.
  canliGruplar(): Promise<CanliGrup[]>;
}

export const YETKI_VERISI_REPO = new RepoBelirteci<
  YetkiVerisiOkumaRepo,
  YetkiVerisiOkumaRepo
>('YetkiVerisiRepo');

export function yetkiVerisiRepo(istemci: RepoIstemcisi): YetkiVerisiOkumaRepo {
  return {
    surumler: async (kullaniciId) => {
      const kisi = await istemci.kullanici.findUniqueOrThrow({
        where: { id: kullaniciId },
        select: { yetkiSurumu: true },
      });
      const genel = await istemci.yetkiSurumu.findUniqueOrThrow({
        where: { id: GENEL_SAYAC_ID },
        select: { sayac: true },
      });
      return { kisiSurumu: kisi.yetkiSurumu, genelSurum: genel.sayac };
    },
    uyelikler: async (kullaniciId) =>
      (
        await istemci.uyelik.findMany({
          where: { kullaniciId, silinmeZamani: null },
          select: { id: true, grupId: true, rolId: true },
          orderBy: { id: 'asc' },
        })
      ).map(({ id, grupId, rolId }) => ({ uyelikId: id, grupId, rolId })),
    yetenekler: async (ciftler) =>
      (
        await istemci.yetenek.findMany({
          where: {
            silinmeZamani: null,
            OR: ciftler.map(({ grupId, rolId }) => ({ grupId, rolId })),
          },
          select: {
            id: true,
            grupId: true,
            rolId: true,
            sart: true,
            butunKayitlar: true,
            butunBirimler: true,
            kolonlar: true,
            butunKolonlar: true,
            izin: { select: { kaynak: true, eylem: true } },
          },
          orderBy: { id: 'asc' },
        })
      ).map((satir) => ({
        yetenekId: satir.id,
        grupId: satir.grupId,
        rolId: satir.rolId,
        kaynak: satir.izin.kaynak,
        eylem: satir.izin.eylem,
        // Saklanan biçim öğelerin düz dizisidir (TS-002 "Veri modeli"); boş şart null saklanır.
        sart: (satir.sart ?? []) as unknown as SartOgesi[],
        butunKayitlar: satir.butunKayitlar,
        butunBirimler: satir.butunBirimler,
        kolonlar: satir.kolonlar,
        butunKolonlar: satir.butunKolonlar,
      })),
    canliGruplar: () =>
      istemci.grup.findMany({
        where: { silinmeZamani: null },
        select: { id: true, ustGrupId: true },
      }),
  };
}
