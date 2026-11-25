import { Inject, Injectable } from '@nestjs/common';
import { yeniKimlik } from '../database/kimlik.js';
import {
  Registrar,
  RepoBelirteci,
  type RepoIstemcisi,
} from '../database/registrar.js';
import type { Islem } from '../database/unit-of-work.js';
import { type IstekOturumu, istekBaglami } from '../http/istek-baglami.js';
import { KodluHata } from '../http/kodlu-hata.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../messaging/outbox/outbox-yazici.js';
import { KAYNAK_KATALOGU, type YazmaKatalogu } from './kaynak-katalogu.js';
import type { PrismaKosulu } from './sart-cevirici.js';
import type { DerlemeSonucu, YetenekKurali } from './yetenek-derleyici.js';

// Yazılacak alanlar ve değerleri; anahtarlar modelin alan adlarıdır. Tanımsız değer yazılmaz.
export type YazmaVerisi = Readonly<Record<string, unknown>>;

const OKUMA_EYLEMI = 'oku';
const OLUSTURMA_EYLEMI = 'olustur';
const GUNCELLEME_EYLEMI = 'guncelle';
const SILME_EYLEMI = 'sil';
const DUZ_EYLEMLER = [
  OKUMA_EYLEMI,
  OLUSTURMA_EYLEMI,
  GUNCELLEME_EYLEMI,
  SILME_EYLEMI,
];
// Bu alanı taşıyan kaynakta silme, alanı yazmaktır (yumuşak silme); taşımayanda satır silinir.
const SILINME_ALANI = 'silinmeZamani';

// Kapı işlemin istemcisini run'ın işlem nesnesinden alır. Belirteç dışa verilmez: işlemin istemcisine
// bu dosyanın dışından ulaşılamaz.
const ISLEM_ISTEMCISI = new RepoBelirteci<object, RepoIstemcisi>(
  'YazmaKapisiIstemcisi',
);

interface YazmaVekili {
  create(args: object): Promise<Record<string, unknown>>;
  updateMany(args: object): Promise<{ count: number }>;
  deleteMany(args: object): Promise<{ count: number }>;
  findUniqueOrThrow(args: object): Promise<Record<string, unknown>>;
  count(args: object): Promise<number>;
}

type NotunOrtakAlanlari = Omit<DegisiklikKaydiNotu, 'eylem' | 'degisen'>;
type JsonDegeri = Extract<
  DegisiklikKaydiNotu,
  { eylem: 'olusturma' }
>['degisen'][string]['yeni'];

// Yetki kapısının yazma yüzü (TS-002 AK-19; KR-010 Seçim 26, 37, 40 ve "Derleme eşlemesi"; KR-008
// Seçim 10, 34, 42). Feature repository'si kataloğa bildirilmiş bir kaynağa yalnız buradan yazar.
// Yazma yalnız run içinde, işin işlem nesnesiyle yapılır; yetki parametre değildir, istek
// bağlamındaki oturumdan ve derlenmiş yetkiden alınır. Kapı reddi hata olarak atar ve run'dan çıkan
// hata bütün işi geri alır (ya hep ya hiç; KR-010 Seçim 26): reddi yakalayıp aynı işlemde süren
// çağıran bu güvenceyi bozar.
//
// Güncelleme, silme ve niyet eylemi şartlı yazmadır: o eylem için kural veren yetenekler sırayla
// denenir; her deneme satırı yalnız o yeteneğin koşuluyla kilitler (anahtar dışı güncelleme kilidi:
// kimliği kendi değerine yazan şartlı güncelleme). Kilitlenen satırın eski hâli okunur, değişen
// alanlar bulunur ve yazma sorgusu yine aynı koşulu taşır. Hiçbir yetenek satırı kilitleyemezse
// bulunamadi. Silinme zamanı alanı olan kaynakta güncelleme, silme ve niyet eylemi yalnız silinmemiş
// satırı kilitler (TS-002 "Durum geçişleri": silinmiş kayıt geri dönmez ve değişmez); silinmiş satırın
// sonucu var olmayan satırınkiyle aynıdır, bulunamadi.
// Düz güncellemede yazılan alanlar (istekle gelen ve değeri değişen alanlar) yeteneğin
// kolon listesinde olmalıdır; koşulu tutan ama alanları kapsamayan yetenek atlanır ve hiçbiri
// kapsamıyorsa yetki_yok. Düz güncellemede iki hâli ve kolonları aynı yetenek tutar (KR-008 Seçim
// 18): yeni hâl, önceki hâli tutan ve kolonları kapsayan adayların koşuluyla sırayla yeniden okunur;
// ilk gören yazmanın yeteneğidir, hiçbiri görmüyorsa yetki_yok (iki hâl kuralı). Niyet eyleminde şart yalnız önceki hâle bakar ve kolon sınırı aranmaz:
// yazılacak değerleri istek değil komutun kodu verir.
//
// Oluşturma: alanları kapsayan yetenekler aday olur; satır yazılır ve adayların koşuluyla sırayla
// yeniden okunur; ilk gören yetenek yazmanın yeteneğidir, hiçbiri görmüyorsa yetki_yok.
//
// Her yazma, işle aynı işlemde bir değişiklik kaydı notu bırakır: yazan, kullanılan üyelik ve
// yetenek, işin adı, kaynak, kayıt, eylem; güncellemede (niyet dahil) yalnız değişen kolonların eski
// ve yeni değeri, oluşturmada yeni hâl, silmede eski hâl. Not anahtarları kolon adlarıdır (alan adının
// küçük harf ve alt çizgili hâli; KR-011 Seçim 7). Hiçbir alan değişmezse yazma deyimi gitmez, not
// boş değişiklikle yine yazılır.
@Injectable()
export class YazmaKapisi {
  constructor(
    @Inject(KAYNAK_KATALOGU) private readonly katalog: YazmaKatalogu,
    private readonly yazici: OutboxYazici,
    registrar: Registrar,
  ) {
    registrar.register(ISLEM_ISTEMCISI, (istemci) => istemci);
  }

  // Yeni kaydın kimliğini döner; kimliği ortak üretici üretir.
  async olustur(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    veri: YazmaVerisi,
  ): Promise<string> {
    const { alanlar, vekil } = this.kaynak(islem, kaynak);
    const yazilan = this.istekVerisi(kaynak, alanlar, veri);
    const adaylar = kurallar(kaynak, OLUSTURMA_EYLEMI).filter((kural) =>
      kolonlariKapsar(kural, Object.keys(yazilan)),
    );
    if (adaylar.length === 0) {
      throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
    }
    const id = yeniKimlik();
    const yeni = await vekil.create({ data: { ...yazilan, id } });
    for (const kural of adaylar) {
      if ((await vekil.count({ where: kayitKosulu(id, kural) })) > 0) {
        await this.yazici.degisiklikKaydi(islem, {
          ...notunOrtakAlanlari(isAdi, kaynak, id, kural),
          eylem: 'olusturma',
          degisen: kolonlar(yeni, (deger) => ({ yeni: deger })),
        });
        return id;
      }
    }
    throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
  }

  async guncelle(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    id: string,
    veri: YazmaVerisi,
  ): Promise<void> {
    const { alanlar, vekil } = this.kaynak(islem, kaynak);
    await this.sartliGuncelle(islem, vekil, {
      isAdi,
      kaynak,
      eylem: GUNCELLEME_EYLEMI,
      id,
      veri: this.istekVerisi(kaynak, alanlar, veri),
      duz: true,
      yumusak: alanlar.includes(SILINME_ALANI),
    });
  }

  // Niyet eylemi (KR-008 Seçim 34 ve 42): veriyi komutun kodu verir; sistem alanları yazılabilir.
  async niyet(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    eylem: string,
    id: string,
    veri: YazmaVerisi,
  ): Promise<void> {
    if (DUZ_EYLEMLER.includes(eylem)) {
      throw new Error(`Niyet eylemi değil: ${eylem}`);
    }
    const { alanlar, vekil } = this.kaynak(islem, kaynak);
    await this.sartliGuncelle(islem, vekil, {
      isAdi,
      kaynak,
      eylem,
      id,
      veri: bilinenVeri(alanlar, veri),
      duz: false,
      yumusak: alanlar.includes(SILINME_ALANI),
    });
  }

  async sil(
    islem: Islem,
    isAdi: string,
    kaynak: string,
    id: string,
  ): Promise<void> {
    const { alanlar, vekil } = this.kaynak(islem, kaynak);
    const yumusak = alanlar.includes(SILINME_ALANI);
    for (const kural of kurallar(kaynak, SILME_EYLEMI)) {
      // Yumuşak silinmiş kayıt yeniden silinmez: silinme zamanı bir kez yazılır.
      const kosul = {
        AND: [
          kayitKosulu(id, kural),
          ...(yumusak ? [{ [SILINME_ALANI]: null }] : []),
        ],
      };
      if (!(await kilitle(vekil, id, kosul))) {
        continue;
      }
      const eski = await vekil.findUniqueOrThrow({ where: { id } });
      if (yumusak) {
        await vekil.updateMany({
          where: kosul,
          data: { [SILINME_ALANI]: new Date() },
        });
      } else {
        await vekil.deleteMany({ where: kosul });
      }
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(isAdi, kaynak, id, kural),
        eylem: 'silme',
        degisen: kolonlar(eski, (deger) => ({ eski: deger })),
      });
      return;
    }
    throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
  }

  private async sartliGuncelle(
    islem: Islem,
    vekil: YazmaVekili,
    istek: {
      isAdi: string;
      kaynak: string;
      eylem: string;
      id: string;
      veri: Record<string, unknown>;
      duz: boolean;
      yumusak: boolean;
    },
  ): Promise<void> {
    const { isAdi, kaynak, eylem, id, veri, duz, yumusak } = istek;
    // Yeni hâl yetenekten bağımsızdır (aynı veri aynı satıra yazılır); bu yüzden önce önceki hâli
    // tutan ve kolonları kapsayan yetenekler sırayla toplanır, satır bir kez yazılır ve adaylar
    // sırayla yeni hâlde denenir. Önceki hâl yazmadan sonra sorulamayacağı için adaylar yazmadan önce
    // toplanır. Niyet eyleminde ilk aday yeter.
    let onceki: Record<string, unknown> | undefined;
    let degisen: Record<string, unknown> = {};
    const adaylar: YetenekKurali[] = [];
    for (const kural of kurallar(kaynak, eylem)) {
      // Yumuşak silinmiş kayıt güncellenmez: silinmiş satır kilitlenmez ve sonuç bulunamadi olur.
      const kosul = {
        AND: [
          kayitKosulu(id, kural),
          ...(yumusak ? [{ [SILINME_ALANI]: null }] : []),
        ],
      };
      if (!(await kilitle(vekil, id, kosul))) {
        continue;
      }
      // Satır kilitli olduğu için bundan sonraki denemelerde eski hâl değişmez.
      if (onceki === undefined) {
        const eski = await vekil.findUniqueOrThrow({ where: { id } });
        onceki = eski;
        degisen = Object.fromEntries(
          Object.entries(veri).filter(
            ([alan, deger]) => jsonMetni(eski[alan]) !== jsonMetni(deger),
          ),
        );
      }
      if (duz && !kolonlariKapsar(kural, Object.keys(degisen))) {
        continue;
      }
      adaylar.push(kural);
      if (!duz) {
        break;
      }
    }
    const [ilk] = adaylar;
    if (onceki === undefined) {
      throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
    }
    if (ilk === undefined) {
      throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
    }
    // Değişen alan yoksa yeni hâl önceki hâldir ve ilk aday iki hâli de tutar. Düz güncellemede
    // yazmanın yeteneği yeni hâli de tutan ilk adaydır (KR-008 Seçim 10 ve 18); hiçbiri tutmazsa
    // yetki_yok atılır ve run'dan çıkan hata yazmayı işin bütünüyle geri alır.
    let yazan: YetenekKurali | undefined = ilk;
    if (Object.keys(degisen).length > 0) {
      await vekil.updateMany({ where: kayitKosulu(id, ilk), data: degisen });
      if (duz) {
        yazan = undefined;
        for (const kural of adaylar) {
          if ((await vekil.count({ where: kayitKosulu(id, kural) })) > 0) {
            yazan = kural;
            break;
          }
        }
      }
    }
    if (yazan === undefined) {
      throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
    }
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(isAdi, kaynak, id, yazan),
      eylem: 'guncelleme',
      degisen: Object.fromEntries(
        Object.entries(degisen).map(([alan, yeni]) => [
          kolonAdi(alan),
          { eski: jsonDegeri(onceki[alan]), yeni: jsonDegeri(yeni) },
        ]),
      ),
    });
  }

  private kaynak(
    islem: Islem,
    kaynak: string,
  ): { alanlar: readonly string[]; vekil: YazmaVekili } {
    const alanlar = this.katalog.alanlar(kaynak);
    // Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir.
    const vekil = (
      islem.repo(ISLEM_ISTEMCISI) as unknown as Partial<
        Record<string, YazmaVekili>
      >
    )[kaynak.charAt(0).toLowerCase() + kaynak.slice(1)];
    if (alanlar === undefined || vekil === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    return { alanlar, vekil };
  }

  // İstek gövdesinden gelen veri: sistemin yazdığı alan kabul edilmez ve hiçbir sorgu gitmeden reddedilir.
  private istekVerisi(
    kaynak: string,
    alanlar: readonly string[],
    veri: YazmaVerisi,
  ): Record<string, unknown> {
    const bilinen = bilinenVeri(alanlar, veri);
    const sistem = this.katalog.sistemAlanlari(kaynak);
    const yasak = Object.keys(bilinen).find((alan) => sistem.includes(alan));
    if (yasak !== undefined) {
      throw new KodluHata('yetki_yok', `Bu alan istekle yazılamaz: ${yasak}`);
    }
    return bilinen;
  }
}

// Tanımsız değerler atılır; kaynağın alanı olmayan ad hatadır.
function bilinenVeri(
  alanlar: readonly string[],
  veri: YazmaVerisi,
): Record<string, unknown> {
  const tanimli = Object.entries(veri).filter(
    ([, deger]) => deger !== undefined,
  );
  for (const [alan] of tanimli) {
    if (!alanlar.includes(alan)) {
      throw new Error(`Bilinmeyen alan: ${alan}`);
    }
  }
  return Object.fromEntries(tanimli);
}

// Yazan kişi oturumdan alınır; oturumsuz yazma (sistem aktörü) bu kapıda yoktur.
function yazmaBaglami(): {
  istekKimligi: string;
  oturum: IstekOturumu;
  yetki: DerlemeSonucu;
} {
  const { istekKimligi, oturum, yetki } = istekBaglami();
  if (oturum === undefined || yetki === undefined) {
    throw new Error('İstek bağlamında oturum ya da derlenmiş yetki yok');
  }
  return { istekKimligi, oturum, yetki };
}

// Koşan isteğin o kaynak ve eylem için kuralları, derlendikleri sırayla.
function kurallar(kaynak: string, eylem: string): readonly YetenekKurali[] {
  return yazmaBaglami().yetki.kurallar.filter(
    (kural) => kural.subject === kaynak && kural.action === eylem,
  );
}

function kolonlariKapsar(
  kural: YetenekKurali,
  yazilan: readonly string[],
): boolean {
  const izinli = kural.fields === undefined ? undefined : [kural.fields].flat();
  return izinli === undefined || yazilan.every((alan) => izinli.includes(alan));
}

function kayitKosulu(id: string, kural: YetenekKurali): PrismaKosulu {
  return { AND: [{ id: { equals: id } }, kural.conditions ?? {}] };
}

// Satırı koşul tutuyorsa anahtar dışı güncelleme kilidiyle kilitler. PostgreSQL değeri değişmeyen
// anahtar kolonunu değişmiş saymaz; bu yüzden kimliği kendi değerine yazmak tam satır kilidi almaz.
async function kilitle(
  vekil: YazmaVekili,
  id: string,
  kosul: PrismaKosulu,
): Promise<boolean> {
  return (await vekil.updateMany({ where: kosul, data: { id } })).count > 0;
}

function notunOrtakAlanlari(
  isAdi: string,
  kaynak: string,
  kayitId: string,
  kural: YetenekKurali,
): NotunOrtakAlanlari {
  const { istekKimligi, oturum, yetki } = yazmaBaglami();
  return {
    istek_id: istekKimligi,
    kullanici_id: oturum.kullaniciId,
    uyelik_id: yetki.uyelikler[kural.yetenekId] ?? null,
    yetenek_id: kural.yetenekId,
    is_adi: isAdi,
    baslatan_kullanici_id: null,
    veri_sahibi_kullanici_id: null,
    kaynak,
    kayit_id: kayitId,
  };
}

// Satırın bütün alanları, kolon adlarıyla.
function kolonlar<T>(
  satir: Record<string, unknown>,
  deger: (json: JsonDegeri) => T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(satir).map(([alan, d]) => [
      kolonAdi(alan),
      deger(jsonDegeri(d)),
    ]),
  );
}

function kolonAdi(alan: string): string {
  return alan.replace(/[A-Z]/g, (harf) => `_${harf.toLowerCase()}`);
}

function jsonDegeri(deger: unknown): JsonDegeri {
  return (deger instanceof Date ? deger.toISOString() : deger) as JsonDegeri;
}

function jsonMetni(deger: unknown): string {
  return JSON.stringify(jsonDegeri(deger));
}
