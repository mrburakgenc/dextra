// Kimlik ve yetkinin uçtan uca senaryosu (GV-090; TS-002 "Uçlar ve izinler", "İşlem sınırları",
// AK-38, AK-39, AK-42, AK-46; KR-008 Seçim 5, 7, 11, 17, 21, 34, 44, 45). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-senaryo.e2e-spec.ts --reporter=verbose
// Hazırlık ortak kurulum yardımcısıyla (kimlik-yardimci.ts) yapılır: göçleri uygulanmış geçici asıl ve
// iz veritabanları, tohum, kurulum komutunun işleviyle aldığı kodla parolasını belirleyip giren ilk
// yönetici. Bundan sonra veritabanına SQL ile yazılmaz; her şey uçlardan yapılır, SQL yalnız okur.
// Adımlar sırayla koşar; her adım öncekinin bıraktığı durumu kullanır.
import pg from 'pg';
import request from 'supertest';
import { IZ_PRISMA_CLIENT } from '../src/shared/database/istemci-belirtecleri.js';
import type { PrismaClient as IzPrismaClient } from '../src/shared/database/iz/generated/client.js';
import { ISTEK_KIMLIGI_BASLIGI } from '../src/shared/http/istek-baglami.js';
import { IzAktarici } from '../src/shared/observability/iz/iz-aktarici.js';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

// Senaryoda açılan iki kişinin parolası; parola kuralını geçen uzun bir cümle.
const PAROLA = 'senaryonun uzun ve dogru parola cumlesi';
// Parola özetleme ve giriş birkaç saniye sürebilir.
const SURE = 30_000;

// Grup kaynağının bütün kolonları (TS-002 "Veri modeli").
const GRUP_ALANLARI = [
  'ad',
  'id',
  'olusturmaZamani',
  'silinmeZamani',
  'ustGrupId',
];

// Birim kapsamı (KR-008 Seçim 4 ve 45): grubun kendi kimliği, yeteneğin grubu ve altındakiler
// listesindedir. Grup kaynağında birimi kaydın kimliği belirler.
const BIRIM_SARTI = [
  {
    alan: 'id',
    islec: 'listede',
    deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
  },
];

type Kayit = Record<string, unknown>;

interface ListeCevabi {
  kayitlar: Kayit[];
}

interface Kural {
  subject: string;
  action: string;
  conditions?: unknown;
  fields?: string[];
  yetenekId: string;
}

interface Kisi {
  id: string;
  kullaniciAdi: string;
  belirtec: string;
}

let ortam: KimlikOrtami;
let kok: string;
let grupA: string;
let grupB: string;
let grupA1: string;
let rol: string;
const birinci: Kisi = {
  id: '',
  kullaniciAdi: 'birinci.yonetici',
  belirtec: '',
};
const ikinci: Kisi = { id: '', kullaniciAdi: 'ikinci.yonetici', belirtec: '' };
let uyelikA: string;
let uyelikB: string;
let yetenekA: string;
let yetenekB: string;
let yetenekAYeni: string;
// (6)'da birinci kişinin grup listesi isteğinin kimliği; (10)'da erişim kaydı bununla aranır.
let birinciListeIstegi: string;
// (6)'da ikinci kişinin aldığı liste; (8)'de değişmediği bununla sınanır.
let ikinciListe: Kayit[];

const yonetici = (): string => ortam.superadmin.erisimBelirteci;

function al(yol: string, belirtec: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get(yol)
    .set(ortam.basliklar(belirtec));
}

function gonder(yol: string, belirtec: string, govde?: object): request.Test {
  return request(ortam.app.getHttpServer())
    .post(yol)
    .set(ortam.basliklar(belirtec))
    .send(govde);
}

// Girişin başlıkları: oturumlu isteklerinkiyle aynı imzalı adres ve tarayıcı bilgisi, belirteçsiz.
function giris(kullaniciAdi: string): request.Test {
  const adres = Object.fromEntries(
    Object.entries(ortam.basliklar('')).filter(
      ([ad]) => ad !== 'authorization',
    ),
  );
  return request(ortam.app.getHttpServer())
    .post('/kimlik/oturum/giris')
    .set(adres)
    .send({ kullaniciAdi, parola: PAROLA });
}

// Oluşturma cevabının kimliği; cevap 201 değilse test düşer.
function olusanKimlik(cevap: request.Response): string {
  expect(cevap.status, JSON.stringify(cevap.body)).toBe(201);
  const { id } = cevap.body as { id: string };
  return id;
}

async function liste(yol: string, belirtec: string): Promise<Kayit[]> {
  const cevap = await al(yol, belirtec);
  expect(cevap.status).toBe(200);
  return (cevap.body as ListeCevabi).kayitlar;
}

const kimlikler = (kayitlar: readonly Kayit[]): unknown[] =>
  kayitlar.map((kayit) => kayit['id']).sort();

async function grupOkuKurali(kisi: Kisi): Promise<Kural> {
  const cevap = await al('/kimlik/oturum/yetkilerim', kisi.belirtec);
  expect(cevap.status).toBe(200);
  const kural = (cevap.body as { kurallar: Kural[] }).kurallar.find(
    (k) => k.subject === 'Grup' && k.action === 'oku',
  );
  if (kural === undefined) {
    throw new Error(`${kisi.kullaniciAdi} Grup:oku kuralı taşımıyor`);
  }
  return kural;
}

async function kalanVeritabanlari(adlar: readonly string[]): Promise<string[]> {
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const { rows } = await sunucu.query<{ datname: string }>(
      'select datname from pg_database where datname = any($1)',
      [adlar],
    );
    return rows.map((satir) => satir.datname);
  } finally {
    await sunucu.end();
  }
}

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('kimlik ve yetkinin uçtan uca senaryosu', () => {
  it(
    "(1) ilk yönetici kök grubun altında A ve B gruplarını, A'nın altında A1 grubunu açar",
    async () => {
      const kokKaydi = (await liste('/kimlik/grup?boyut=100', yonetici())).find(
        (kayit) => kayit['ustGrupId'] === null,
      );
      expect(kokKaydi).toBeDefined();
      kok = kokKaydi?.['id'] as string;

      const grupAc = async (ad: string, ustGrupId: string): Promise<string> =>
        olusanKimlik(
          await gonder('/kimlik/grup', yonetici(), { ad, ustGrupId }),
        );
      grupA = await grupAc('A', kok);
      grupB = await grupAc('B', kok);
      grupA1 = await grupAc('A1', grupA);

      const gruplar = await liste('/kimlik/grup?boyut=100', yonetici());
      for (const [id, ad, ust] of [
        [grupA, 'A', kok],
        [grupB, 'B', kok],
        [grupA1, 'A1', grupA],
      ] as const) {
        expect(gruplar.find((kayit) => kayit['id'] === id)).toMatchObject({
          ad,
          ustGrupId: ust,
        });
      }
    },
    SURE,
  );

  it(
    "(2) ilk yönetici 'Birim yöneticisi' rolünü oluşturur",
    async () => {
      rol = olusanKimlik(
        await gonder('/kimlik/rol', yonetici(), { ad: 'Birim yöneticisi' }),
      );
      const cevap = await al(`/kimlik/rol/${rol}`, yonetici());
      expect(cevap.status).toBe(200);
      expect(cevap.body).toMatchObject({ id: rol, ad: 'Birim yöneticisi' });
    },
    SURE,
  );

  it(
    '(3) ilk yönetici iki kullanıcı açar; her biri dönen kodla parolasını belirler ve giriş yapar',
    async () => {
      for (const kisi of [birinci, ikinci]) {
        const acilis = await gonder('/kimlik/kullanici', yonetici(), {
          kullaniciAdi: kisi.kullaniciAdi,
          gorunenAd: kisi.kullaniciAdi,
        });
        kisi.id = olusanKimlik(acilis);
        const { parolaBaglantisiKodu } = acilis.body as {
          parolaBaglantisiKodu: string;
        };
        expect(typeof parolaBaglantisiKodu).toBe('string');

        const belirle = await request(ortam.app.getHttpServer())
          .post('/kimlik/parola/belirle')
          .send({ kod: parolaBaglantisiKodu, parola: PAROLA });
        expect(belirle.status).toBe(204);

        const girdi = await giris(kisi.kullaniciAdi);
        expect(girdi.status).toBe(200);
        kisi.belirtec = (
          girdi.body as { erisimBelirteci: string }
        ).erisimBelirteci;
      }
    },
    SURE,
  );

  it(
    '(4) birinciye A grubunda, ikinciye B grubunda birim yöneticisi rolü verilir',
    async () => {
      uyelikA = olusanKimlik(
        await gonder('/kimlik/uyelik', yonetici(), {
          kullaniciId: birinci.id,
          grupId: grupA,
          rolId: rol,
        }),
      );
      uyelikB = olusanKimlik(
        await gonder('/kimlik/uyelik', yonetici(), {
          kullaniciId: ikinci.id,
          grupId: grupB,
          rolId: rol,
        }),
      );
      for (const [kisi, uyelik, grup] of [
        [birinci, uyelikA, grupA],
        [ikinci, uyelikB, grupB],
      ] as const) {
        const uyelikler = await liste(
          `/kimlik/uyelik?kullaniciId=${kisi.id}`,
          yonetici(),
        );
        expect(uyelikler).toContainEqual(
          expect.objectContaining({ id: uyelik, grupId: grup, rolId: rol }),
        );
      }
    },
    SURE,
  );

  it(
    '(5) (A, birim yöneticisi) ve (B, birim yöneticisi) kümelerine birim kapsamlı, bütün kolonlu Grup:oku yeteneği yazılır',
    async () => {
      const izin = (await liste('/kimlik/izin?boyut=100', yonetici())).find(
        (kayit) => kayit['kaynak'] === 'Grup' && kayit['eylem'] === 'oku',
      );
      expect(izin).toBeDefined();
      const yetenekYaz = async (grupId: string): Promise<string> =>
        olusanKimlik(
          await gonder('/kimlik/yetenek', yonetici(), {
            grupId,
            rolId: rol,
            izinId: izin?.['id'],
            sart: BIRIM_SARTI,
            butunKayitlar: false,
            butunBirimler: false,
            kolonlar: null,
            butunKolonlar: true,
          }),
        );
      yetenekA = await yetenekYaz(grupA);
      yetenekB = await yetenekYaz(grupB);

      const yazilan = await al(`/kimlik/yetenek/${yetenekA}`, yonetici());
      expect(yazilan.status).toBe(200);
      // Kolon dizisi şemada boş olamaz (String[]): gövdedeki null boş dizi olarak saklanır ve okunur.
      expect(yazilan.body).toMatchObject({
        grupId: grupA,
        rolId: rol,
        sart: BIRIM_SARTI,
        butunKayitlar: false,
        butunBirimler: false,
        kolonlar: [],
        butunKolonlar: true,
      });
    },
    SURE,
  );

  it(
    "(6) iki ayrı birim: birinci yalnız A ve A1'i, ikinci yalnız B'yi görür (liste ve tek kayıt); ikisi de grup oluşturamaz",
    async () => {
      const birinciCevap = await al('/kimlik/grup?boyut=100', birinci.belirtec);
      expect(birinciCevap.status).toBe(200);
      const birinciKayitlari = (birinciCevap.body as ListeCevabi).kayitlar;
      expect(kimlikler(birinciKayitlari)).toEqual([grupA, grupA1].sort());
      for (const kayit of birinciKayitlari) {
        expect(Object.keys(kayit).sort()).toEqual(GRUP_ALANLARI);
      }
      const istekKimligi = birinciCevap.get(ISTEK_KIMLIGI_BASLIGI);
      expect(istekKimligi).toBeDefined();
      birinciListeIstegi = istekKimligi ?? '';

      ikinciListe = await liste('/kimlik/grup?boyut=100', ikinci.belirtec);
      expect(kimlikler(ikinciListe)).toEqual([grupB]);

      for (const [kisi, gorulen, gorulmeyen] of [
        [birinci, [grupA, grupA1], [grupB]],
        [ikinci, [grupB], [grupA, grupA1]],
      ] as const) {
        for (const id of gorulen) {
          const cevap = await al(`/kimlik/grup/${id}`, kisi.belirtec);
          expect(cevap.status).toBe(200);
          expect(cevap.body).toMatchObject({ id });
        }
        for (const id of gorulmeyen) {
          expect((await al(`/kimlik/grup/${id}`, kisi.belirtec)).status).toBe(
            404,
          );
        }
      }

      for (const [kisi, ust] of [
        [birinci, grupA],
        [ikinci, grupB],
      ] as const) {
        const cevap = await gonder('/kimlik/grup', kisi.belirtec, {
          ad: 'İzinsiz',
          ustGrupId: ust,
        });
        expect(cevap.status).toBe(403);
      }
    },
    SURE,
  );

  it(
    "(7) iki kişinin 'yetkilerim' cevabı Grup:oku kuralını taşır ve kuralların koşulları farklıdır",
    async () => {
      const birinciKurali = await grupOkuKurali(birinci);
      const ikinciKurali = await grupOkuKurali(ikinci);
      expect(birinciKurali.yetenekId).toBe(yetenekA);
      expect(ikinciKurali.yetenekId).toBe(yetenekB);

      const kapsam = (kural: Kural): string[] => {
        expect(kural.conditions).toEqual({
          AND: [{ id: { in: expect.any(Array) as unknown } }],
        });
        const { AND } = kural.conditions as {
          AND: [{ id: { in: string[] } }];
        };
        return [...AND[0].id.in].sort();
      };
      expect(kapsam(birinciKurali)).toEqual([grupA, grupA1].sort());
      expect(kapsam(ikinciKurali)).toEqual([grupB]);
      expect(birinciKurali.conditions).not.toEqual(ikinciKurali.conditions);
    },
    SURE,
  );

  it(
    '(8) A kümesindeki yetenek yalnız ad kolonuyla yenilenir: birincinin listesi kimlik ve ad taşır, ikincininki değişmez',
    async () => {
      yetenekAYeni = olusanKimlik(
        await gonder(`/kimlik/yetenek/${yetenekA}/yenile`, yonetici(), {
          sart: BIRIM_SARTI,
          butunKayitlar: false,
          butunBirimler: false,
          kolonlar: ['ad'],
          butunKolonlar: false,
        }),
      );
      expect(yetenekAYeni).not.toBe(yetenekA);

      const birinciKayitlari = await liste(
        '/kimlik/grup?boyut=100',
        birinci.belirtec,
      );
      expect(kimlikler(birinciKayitlari)).toEqual([grupA, grupA1].sort());
      for (const kayit of birinciKayitlari) {
        expect(Object.keys(kayit).sort()).toEqual(['ad', 'id']);
      }

      expect(await liste('/kimlik/grup?boyut=100', ikinci.belirtec)).toEqual(
        ikinciListe,
      );
    },
    SURE,
  );

  it(
    '(9) birinci pasife alınır: eski belirteci 401 döner, giremez; yeniden açılınca eski parolasıyla girer, A üyeliği dönmez, grup listesi 403 döner',
    async () => {
      expect(
        (await gonder(`/kimlik/kullanici/${birinci.id}/pasife-al`, yonetici()))
          .status,
      ).toBe(204);
      expect(
        (await al('/kimlik/grup?boyut=100', birinci.belirtec)).status,
      ).toBe(401);
      expect((await giris(birinci.kullaniciAdi)).status).toBe(401);

      expect(
        (await gonder(`/kimlik/kullanici/${birinci.id}/yeniden-ac`, yonetici()))
          .status,
      ).toBe(204);
      const girdi = await giris(birinci.kullaniciAdi);
      expect(girdi.status).toBe(200);
      birinci.belirtec = (
        girdi.body as { erisimBelirteci: string }
      ).erisimBelirteci;

      // Yeniden açılan kişi yalnız (Kök, Temel) üyeliğiyle döner (KR-008 Seçim 43).
      const uyelikler = await liste(
        `/kimlik/uyelik?kullaniciId=${birinci.id}`,
        yonetici(),
      );
      expect(uyelikler.map((kayit) => kayit['grupId'])).toEqual([kok]);
      expect(uyelikler.map((kayit) => kayit['id'])).not.toContain(uyelikA);

      expect(
        (await al('/kimlik/grup?boyut=100', birinci.belirtec)).status,
      ).toBe(403);
    },
    SURE,
  );

  it(
    "(10) iz: senaryonun yazmalarının notları outbox'tadır ve aktarımdan sonra değişiklik kaydındadır; birincinin (6)'daki liste isteğinin erişim kaydı kullandığı yeteneği taşır",
    async () => {
      // İş adı, kaynak, kayıt ve eylem; her yazma işi için en az bir not.
      const beklenen = [
        ['kimlik:grup-olustur', 'Grup', grupA, 'olusturma'],
        ['kimlik:grup-olustur', 'Grup', grupB, 'olusturma'],
        ['kimlik:grup-olustur', 'Grup', grupA1, 'olusturma'],
        ['kimlik:rol-olustur', 'Rol', rol, 'olusturma'],
        ['kimlik:kullanici-ac', 'Kullanici', birinci.id, 'olusturma'],
        ['kimlik:kullanici-ac', 'Kullanici', ikinci.id, 'olusturma'],
        ['kimlik:uyelik-ver', 'Uyelik', uyelikA, 'olusturma'],
        ['kimlik:uyelik-ver', 'Uyelik', uyelikB, 'olusturma'],
        ['kimlik:yetenek-olustur', 'Yetenek', yetenekA, 'olusturma'],
        ['kimlik:yetenek-olustur', 'Yetenek', yetenekB, 'olusturma'],
        ['kimlik:yetenek-yenile', 'Yetenek', yetenekA, 'guncelleme'],
        ['kimlik:yetenek-yenile', 'Yetenek', yetenekAYeni, 'olusturma'],
        ['kimlik:kullanici-pasife-al', 'Kullanici', birinci.id, 'guncelleme'],
      ].map(([isAdi, kaynak, kayitId, eylem]) => ({
        isAdi,
        kaynak,
        kayitId,
        eylem,
      }));

      const { rows: notlar } = await ortam.db.query<{
        id: string;
        isAdi: string;
        kaynak: string;
        kayitId: string;
        eylem: string;
      }>(
        `select id, govde->>'is_adi' as "isAdi", govde->>'kaynak' as kaynak,
                govde->>'kayit_id' as "kayitId", govde->>'eylem' as eylem
           from outbox_iz`,
      );
      for (const not of beklenen) {
        expect(notlar).toContainEqual(expect.objectContaining(not));
      }

      // Uygulamanın kendi aktarım döngüsü de çalışır; geçiş aktaracak not kalmayana kadar çağrılır.
      const aktarici = ortam.app.get(IzAktarici);
      let aktarilan: number;
      do {
        aktarilan = await aktarici.gecis();
      } while (aktarilan > 0);
      const {
        rows: [aktarilmayan],
      } = await ortam.db.query<{ sayi: number }>(
        'select count(*)::int as sayi from outbox_iz where aktarim_zamani is null',
      );
      expect(aktarilmayan?.sayi).toBe(0);

      const iz = ortam.app.get<IzPrismaClient>(IZ_PRISMA_CLIENT);
      const kayitlar = await iz.degisiklikKaydi.findMany({
        select: {
          id: true,
          isAdi: true,
          kaynak: true,
          kayitId: true,
          eylem: true,
        },
      });
      for (const not of beklenen) {
        expect(kayitlar).toContainEqual(expect.objectContaining(not));
      }
      expect(kayitlar.map((kayit) => kayit.id).sort()).toEqual(
        notlar.map((not) => not.id).sort(),
      );

      const erisimler = await iz.erisimKaydi.findMany({
        where: { istekId: birinciListeIstegi },
        include: { yetenekler: true },
      });
      expect(erisimler).toHaveLength(1);
      expect(erisimler[0]).toMatchObject({
        kullaniciId: birinci.id,
        isAdi: 'GrupController.listele',
        kayitSayisi: 2,
      });
      expect(erisimler[0]?.yetenekler.map((y) => y.yetenekId)).toEqual([
        yetenekA,
      ]);
    },
    SURE,
  );
});
