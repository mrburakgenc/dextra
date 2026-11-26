import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../database/generated/client.js';
import { yeniKimlik } from '../../database/domain/kimlik.js';
import { RepoBelirteci } from '../../database/domain/repo-belirteci.js';
import {
  Registrar,
  type RepoIstemcisi,
} from '../../database/infrastructure/registrar.js';
import type { Islem } from '../../database/domain/islem.js';
import {
  type IstekOturumu,
  istekBaglami,
} from '../../observability/istek-baglami/istek-baglami.js';
import { KodluHata } from '../../http/domain/kodlu-hata.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../../messaging/infrastructure/outbox/outbox-yazici.js';
import type { PrismaKosulu } from '../application/sart-cevirici.js';
import {
  type DerlemeSonucu,
  type DerlenmisKural,
  uygulananYasaklar,
  type YetenekKurali,
} from '../application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type YazmaKatalogu,
} from '../domain/kaynak-katalogu.js';
import type {
  GuncellemeVerisi,
  OlusturmaVerisi,
  SatirSuzgeci,
} from './model-tipleri.js';

// Yazılacak alanlar ve değerleri; anahtarlar modelin alan adlarıdır. Tanımsız değer yazılmaz.
export type YazmaVerisi = Readonly<Record<string, unknown>>;

// Repository'nin yazma deyimleri (TS-007 "Yapı"): deyimi repository yazar, koşulu ve veriyi motor verir.
// Oluşturma deyimi yeni satırı bütün alanlarıyla döner (değişiklik kaydı notu için).
export type OlusturmaDeyimi<M extends Prisma.ModelName> = (
  vt: RepoIstemcisi,
  veri: OlusturmaVerisi<M>,
) => Promise<object>;

// Güncelleme, niyet ve silme deyimi; where satırın kimliği ile yeteneğin şartıdır. Silmede veri,
// silinme zamanı alanı olan kaynakta o alandır ve deyim onu yazar; olmayan kaynakta boştur ve deyim
// satırı siler.
export type YazmaDeyimi<M extends Prisma.ModelName> = (
  vt: RepoIstemcisi,
  where: SatirSuzgeci<M>,
  veri: GuncellemeVerisi<M>,
) => Promise<unknown>;

// Deyimlerin motorun kullandığı genel hâlleri.
type GenelOlusturmaDeyimi = (
  vt: RepoIstemcisi,
  veri: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
type GenelYazmaDeyimi = (
  vt: RepoIstemcisi,
  where: PrismaKosulu,
  veri: Record<string, unknown>,
) => Promise<unknown>;

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

// Yasağın reddettiği yazma (TS-008 "Yazma"): cevabı yetki_yok'tur. Karar veren yasak, son adayı kapatan
// en yüksek öncelikli yasaktır (eşitlikte en eski); yalnız iç bilgidir, hata süzgeci cevaba kod, ileti
// ve ayrıntıdan başkasını yazmaz.
export class YasakReddi extends KodluHata {
  constructor(readonly kararVerenYasakId: string) {
    super('yetki_yok', 'Bu işlem için yetki yok');
  }
}

// İşin kendi iznine ek olarak aranan izin (TS-008 "Yönetim, izinler ve teşhis", AK-4): satırın sınanan
// hâli onu gerektiriyorsa kişinin o hâli tutan ve ek eylemin yasaklarınca kapatılmamış bir ek eylem
// yeteneği olmalıdır; yoksa yetki_yok. Gerekip gerekmediğine repository satırın değerlerinden karar verir.
export interface EkIzin {
  readonly eylem: string;
  readonly gerekirMi: (satir: Readonly<Record<string, unknown>>) => boolean;
}

type NotunOrtakAlanlari = Omit<DegisiklikKaydiNotu, 'eylem' | 'degisen'>;
type JsonDegeri = Extract<
  DegisiklikKaydiNotu,
  { eylem: 'olusturma' }
>['degisen'][string]['yeni'];

// Yetki kapısının yazma yüzü (TS-007 "Yapı"; KR-010 Seçim 26, 37, 40 ve "Derleme eşlemesi"; KR-008
// Seçim 10, 34, 42). Feature repository'si kataloğa bildirilmiş bir kaynağa yazan Prisma deyimini
// kendisi yazar ve deyimleOlustur, deyimleGuncelle, deyimleNiyet ya da deyimleSil'e verir; sırayı ve
// güvenceyi motor yürütür: adayları dener, satırı yeteneğin şartıyla kilitler, eski hâli okur, değişen
// alanları ve kolon sınırını denetler, deyimi kendi verdiği koşul ve veriyle koşturur, iki hâl
// kuralını ve değişiklik kaydı notunu kapatır. Yazma yalnız run içinde, işin işlem nesnesiyle
// yapılır; yetki parametre değildir, istek bağlamındaki oturumdan ve derlenmiş yetkiden alınır. Kapı
// reddi hata olarak atar ve run'dan çıkan hata bütün işi geri alır (ya hep ya hiç; KR-010 Seçim 26):
// reddi yakalayıp aynı işlemde süren çağıran bu güvenceyi bozar.
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
// Yasaklar (TS-008 "Tanım", "Muafiyetler" ve "Yazma"; KU-017, KU-018): adaya, muaf değilse, ondan düşük
// öncelikli olmayan aynı eylemin yasakları uygulanır. Satır kilitlendikten sonra, kilit altında, satırı
// kesin tutan yasaklar veritabanına sorulur; adayı kapatan yasak varsa o yetenek aday olmaz (düz
// güncellemede kaydın bütününü ya da yazılan alanlardan birini kapatan, öbür eylemlerde her yasak).
// Düz güncellemede yeni hâl de sınanır: yeni hâlde yasağın kapattığı aday yazmanın yeteneği olamaz.
// Niyet eyleminde ve silmede yalnız önceki hâle bakılır; oluşturmada sınama yazılan satırın üzerindedir.
// Aday kalmazsa yetki_yok atılır (yasakla elenen adayda YasakReddi) ve run işi geri alır. Uygulanan
// yasağı olmayan kişide sorgular yasaklardan önceki hâliyle aynıdır (TS-008 Değişmez 1).
//
// Ek izin (TS-008 AK-4): oluşturma, niyet ve silme işin kendi iznine ek bir eylem isteyebilir. Ek izin
// aynı işlemde, işin adayı bulunduktan sonra ve yazmadan önce sınanır: oluşturmada yazılan satırda,
// niyette ve silmede önceki hâlde. Satır ek izni gerektirmiyorsa sorgu gitmez.
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
  async deyimleOlustur<M extends Prisma.ModelName>(
    islem: Islem,
    isAdi: string,
    kaynak: M,
    veri: YazmaVerisi,
    deyim: OlusturmaDeyimi<M>,
    ekIzin?: EkIzin,
  ): Promise<string> {
    const yaz = deyim as unknown as GenelOlusturmaDeyimi;
    const vt = islem.repo(ISLEM_ISTEMCISI);
    const { alanlar, vekil } = this.kaynak(vt, kaynak);
    const yazilan = this.istekVerisi(kaynak, alanlar, veri);
    const adaylar = kurallar(kaynak, OLUSTURMA_EYLEMI).filter((kural) =>
      kolonlariKapsar(kural, Object.keys(yazilan)),
    );
    if (adaylar.length === 0) {
      throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
    }
    const id = yeniKimlik();
    const yeni = await yaz(vt, { ...yazilan, id });
    const yasaklari = uygulananYasaklar(
      yazmaBaglami().yetki,
      kaynak,
      OLUSTURMA_EYLEMI,
    );
    const tutar = yasakSinamasi(vekil, id);
    let karar: DerlenmisKural | undefined;
    for (const kural of adaylar) {
      if ((await vekil.count({ where: kayitKosulu(id, kural) })) > 0) {
        const kapatan = await kapatanYasak(yasaklari(kural), undefined, tutar);
        if (kapatan !== undefined) {
          karar = kapatan;
          continue;
        }
        await ekIzniSina(vekil, kaynak, id, yeni, ekIzin);
        await this.yazici.degisiklikKaydi(islem, {
          ...notunOrtakAlanlari(isAdi, kaynak, id, kural),
          eylem: 'olusturma',
          degisen: kolonlar(yeni, (deger) => ({ yeni: deger })),
        });
        return id;
      }
    }
    throw yetkiYok(karar);
  }

  async deyimleGuncelle<M extends Prisma.ModelName>(
    islem: Islem,
    isAdi: string,
    kaynak: M,
    id: string,
    veri: YazmaVerisi,
    deyim: YazmaDeyimi<M>,
  ): Promise<void> {
    const yaz = deyim as unknown as GenelYazmaDeyimi;
    const vt = islem.repo(ISLEM_ISTEMCISI);
    const { alanlar, vekil } = this.kaynak(vt, kaynak);
    await this.sartliGuncelle(islem, vekil, {
      isAdi,
      kaynak,
      eylem: GUNCELLEME_EYLEMI,
      id,
      veri: this.istekVerisi(kaynak, alanlar, veri),
      duz: true,
      yumusak: alanlar.includes(SILINME_ALANI),
      yaz: (where, data) => yaz(vt, where, data),
    });
  }

  // Niyet eylemi (KR-008 Seçim 34 ve 42): veriyi komutun kodu verir; sistem alanları yazılabilir.
  async deyimleNiyet<M extends Prisma.ModelName>(
    islem: Islem,
    isAdi: string,
    kaynak: M,
    eylem: string,
    id: string,
    veri: YazmaVerisi,
    deyim: YazmaDeyimi<M>,
    ekIzin?: EkIzin,
  ): Promise<void> {
    if (DUZ_EYLEMLER.includes(eylem)) {
      throw new Error(`Niyet eylemi değil: ${eylem}`);
    }
    const yaz = deyim as unknown as GenelYazmaDeyimi;
    const vt = islem.repo(ISLEM_ISTEMCISI);
    const { alanlar, vekil } = this.kaynak(vt, kaynak);
    await this.sartliGuncelle(islem, vekil, {
      isAdi,
      kaynak,
      eylem,
      id,
      veri: bilinenVeri(alanlar, veri),
      duz: false,
      yumusak: alanlar.includes(SILINME_ALANI),
      yaz: (where, data) => yaz(vt, where, data),
      ekIzin,
    });
  }

  async deyimleSil<M extends Prisma.ModelName>(
    islem: Islem,
    isAdi: string,
    kaynak: M,
    id: string,
    deyim: YazmaDeyimi<M>,
    ekIzin?: EkIzin,
  ): Promise<void> {
    const yaz = deyim as unknown as GenelYazmaDeyimi;
    const vt = islem.repo(ISLEM_ISTEMCISI);
    const { alanlar, vekil } = this.kaynak(vt, kaynak);
    const yumusak = alanlar.includes(SILINME_ALANI);
    const yasaklari = uygulananYasaklar(
      yazmaBaglami().yetki,
      kaynak,
      SILME_EYLEMI,
    );
    const tutar = yasakSinamasi(vekil, id);
    let karar: DerlenmisKural | undefined;
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
      const kapatan = await kapatanYasak(yasaklari(kural), undefined, tutar);
      if (kapatan !== undefined) {
        karar = kapatan;
        continue;
      }
      const eski = await vekil.findUniqueOrThrow({ where: { id } });
      await ekIzniSina(vekil, kaynak, id, eski, ekIzin);
      await yaz(vt, kosul, yumusak ? { [SILINME_ALANI]: new Date() } : {});
      await this.yazici.degisiklikKaydi(islem, {
        ...notunOrtakAlanlari(isAdi, kaynak, id, kural),
        eylem: 'silme',
        degisen: kolonlar(eski, (deger) => ({ eski: deger })),
      });
      return;
    }
    // Satırı kilitleyen her aday yasakla elendiyse yetki_yok; hiçbiri kilitleyemediyse bulunamadi.
    if (karar !== undefined) {
      throw yetkiYok(karar);
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
      yaz: (
        where: PrismaKosulu,
        veri: Record<string, unknown>,
      ) => Promise<unknown>;
      ekIzin?: EkIzin | undefined;
    },
  ): Promise<void> {
    const { isAdi, kaynak, eylem, id, veri, duz, yumusak, yaz, ekIzin } = istek;
    // Yeni hâl yetenekten bağımsızdır (aynı veri aynı satıra yazılır); bu yüzden önce önceki hâli
    // tutan ve kolonları kapsayan yetenekler sırayla toplanır, satır bir kez yazılır ve adaylar
    // sırayla yeni hâlde denenir. Önceki hâl yazmadan sonra sorulamayacağı için adaylar yazmadan önce
    // toplanır. Niyet eyleminde ilk aday yeter.
    let onceki: Record<string, unknown> | undefined;
    let degisen: Record<string, unknown> = {};
    const adaylar: YetenekKurali[] = [];
    const yasaklari = uygulananYasaklar(yazmaBaglami().yetki, kaynak, eylem);
    const oncekiniTutar = yasakSinamasi(vekil, id);
    let karar: DerlenmisKural | undefined;
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
      const kapatan = await kapatanYasak(
        yasaklari(kural),
        duz ? Object.keys(degisen) : undefined,
        oncekiniTutar,
      );
      if (kapatan !== undefined) {
        karar = kapatan;
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
      throw yetkiYok(karar);
    }
    await ekIzniSina(vekil, kaynak, id, onceki, ekIzin);
    // Değişen alan yoksa yeni hâl önceki hâldir ve ilk aday iki hâli de tutar. Düz güncellemede
    // yazmanın yeteneği yeni hâli de tutan ilk adaydır (KR-008 Seçim 10 ve 18); hiçbiri tutmazsa
    // yetki_yok atılır ve run'dan çıkan hata yazmayı işin bütünüyle geri alır.
    let yazan: YetenekKurali | undefined = ilk;
    if (Object.keys(degisen).length > 0) {
      await yaz(kayitKosulu(id, ilk), degisen);
      if (duz) {
        yazan = undefined;
        const yeniyiTutar = yasakSinamasi(vekil, id);
        for (const kural of adaylar) {
          if ((await vekil.count({ where: kayitKosulu(id, kural) })) > 0) {
            const kapatan = await kapatanYasak(
              yasaklari(kural),
              Object.keys(degisen),
              yeniyiTutar,
            );
            if (kapatan !== undefined) {
              karar = kapatan;
              continue;
            }
            yazan = kural;
            break;
          }
        }
      }
    }
    if (yazan === undefined) {
      throw yetkiYok(karar);
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
    vt: RepoIstemcisi,
    kaynak: string,
  ): { alanlar: readonly string[]; vekil: YazmaVekili } {
    const alanlar = this.katalog.alanlar(kaynak);
    if (alanlar === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    return { alanlar, vekil: modelVekili(vt, kaynak) };
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

// Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir. Motor kilidi, eski hâli ve
// görünürlüğü bununla sorar (TS-007 Seçenek 3); kaynağa yazan deyim repository'nindir.
function modelVekili(vt: RepoIstemcisi, kaynak: string): YazmaVekili {
  const vekil = (vt as unknown as Partial<Record<string, YazmaVekili>>)[
    kaynak.charAt(0).toLowerCase() + kaynak.slice(1)
  ];
  if (vekil === undefined) {
    throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
  }
  return vekil;
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

// Satırın bir hâlinde, yasağın satırı kesin tutup tutmadığı (TS-008 "Yazma"): veritabanına yasağın
// "kesin tutmuyor" koşuluyla sorulur, her yasak o hâlde bir kez. Koşulsuz yasak (bozuk yasak dahil)
// sorgusuz tutar. Satır kilitli olduğu için sorulan hâl kilidi alan işlemin gördüğü hâldir.
function yasakSinamasi(
  vekil: YazmaVekili,
  id: string,
): (yasak: DerlenmisKural) => Promise<boolean> {
  const sonuclar = new Map<DerlenmisKural, boolean>();
  return async (yasak) => {
    let tutar = sonuclar.get(yasak);
    if (tutar === undefined) {
      tutar =
        yasak.conditions === undefined ||
        yasak.kesinTutmuyor === undefined ||
        (await vekil.count({
          where: { AND: [{ id: { equals: id } }, yasak.kesinTutmuyor] },
        })) === 0;
      sonuclar.set(yasak, tutar);
    }
    return tutar;
  };
}

// Adayı kapatan yasak (TS-008 "Tanım"); kapatan yoksa tanımsız. Yasaklar adaya uygulananlardır. Düz
// güncellemede (yazılan verilir) satırı kesin tutan yasak, kaydın bütününü ya da yazılan alanlardan
// birini kapatıyorsa adayı kapatır; oluşturma, silme ve niyet eylemi kayıt düzeyindedir: satırı kesin
// tutan her yasak kapatır. Birden çok yasak kapatıyorsa dönen, en yüksek öncelikli olandır (eşitlikte
// en eski); sorgular bu sırayla, ilk tutan yasağa kadar gider.
async function kapatanYasak(
  yasaklar: readonly DerlenmisKural[],
  yazilan: readonly string[] | undefined,
  tutar: (yasak: DerlenmisKural) => Promise<boolean>,
): Promise<DerlenmisKural | undefined> {
  const kapatabilen = yasaklar
    .filter(
      (y) =>
        yazilan === undefined ||
        y.fields === undefined ||
        [y.fields].flat().some((alan) => yazilan.includes(alan)),
    )
    .sort((a, b) => b.oncelik - a.oncelik);
  for (const yasak of kapatabilen) {
    if (await tutar(yasak)) {
      return yasak;
    }
  }
  return undefined;
}

// Aday kalmayan yazmanın reddi: karar, yasakla elenen son adayı kapatan yasaktır; yasakla elenen aday
// yoksa ret yasaklardan önceki hâliyledir.
function yetkiYok(karar: DerlenmisKural | undefined): KodluHata {
  return karar === undefined
    ? new KodluHata('yetki_yok', 'Bu işlem için yetki yok')
    : new YasakReddi(karar.yetenekId);
}

// Ek iznin sınanması (TS-008 AK-4): satır bu işlemde kilitlenmiş ya da yazılmıştır; satır ek izni
// gerektiriyorsa ek eylemin yetenekleri sırayla denenir ve satırı tutan, ek eylemin yasaklarınca
// kapatılmayan ilk yetenekte sınama geçer (kayıt düzeyinde, niyet eylemi gibi). Hiçbiri geçmezse
// yetki_yok: satır işin kendi izniyle bulunduğu için bulunamadi değildir. Sınama yazmaz, not bırakmaz.
async function ekIzniSina(
  vekil: YazmaVekili,
  kaynak: string,
  id: string,
  satir: Readonly<Record<string, unknown>>,
  ekIzin: EkIzin | undefined,
): Promise<void> {
  if (ekIzin?.gerekirMi(satir) !== true) {
    return;
  }
  const yasaklari = uygulananYasaklar(
    yazmaBaglami().yetki,
    kaynak,
    ekIzin.eylem,
  );
  const tutar = yasakSinamasi(vekil, id);
  let karar: DerlenmisKural | undefined;
  for (const kural of kurallar(kaynak, ekIzin.eylem)) {
    if ((await vekil.count({ where: kayitKosulu(id, kural) })) > 0) {
      const kapatan = await kapatanYasak(yasaklari(kural), undefined, tutar);
      if (kapatan === undefined) {
        return;
      }
      karar = kapatan;
    }
  }
  throw yetkiYok(karar);
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
