// Oturum yenileme (GV-094; TS-002 "İşlem sınırları" Yenile ve "Kapatıp reddeden dallar", AK-49;
// KR-009 Kural 3, 4, 7, 8 ve 11). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-oturum-yenile.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (AppModule, göçleri uygulanmış asıl ve iz geçici
// veritabanları, gerçek başlangıç) açılır; kişi yardımcıyla açılır ve her testte uçtan girer. Her
// testten önce oturum, sır ve not satırları silinir. Zaman gerektiren durumlar satırın zamanı SQL ile
// geri alınarak kurulur; beklenmez. Teknik günlük bütün dosya boyunca yakalanır.
import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import {
  HAREKETSIZLIK_SINIRI_MS,
  HOSGORU_PENCERESI_MS,
} from '../src/features/kimlik/oturum/domain/entities/oturum.entity.js';
import {
  BelirtecServisi,
  YENILEME_BELIRTECI_SURESI_SN,
} from '../src/shared/guvenlik/belirtec.js';
import {
  imzaliAdresBasliklari,
  type KimlikOrtami,
  kimlikOrtamiKur,
  tamGiris,
} from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YENILE = '/kimlik/oturum/yenile';
const KISI = 'yenileyen';
// Başarısızlığın her türünde dönen tek cevap (AK-49 madde 1).
const RET = {
  kod: 'kimlik_gerekli',
  ileti: 'Oturum yenilenemedi',
  ayrinti: null,
};
const GUNLUK_YONTEMLERI = [
  'log',
  'warn',
  'error',
  'debug',
  'verbose',
  'fatal',
] as const;

type Giris = Awaited<ReturnType<typeof tamGiris>>;

interface Yenileme {
  erisimBelirteci: string;
  yenilemeBelirteci: string;
}

interface OturumSatiri {
  baslangic_zamani: Date;
  son_dondurme_zamani: Date;
  kapatilma_zamani: Date | null;
  kapatilma_nedeni: string | null;
}

interface SirSatiri {
  nesil: number;
  gecerli_yenileme_ozeti: string;
  onceki_yenileme_ozeti: string | null;
  cihaz_sirri_ozeti: string;
}

interface Not {
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  veri_sahibi_kullanici_id: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

let ortam: KimlikOrtami;
let kisi: string;
let sistemAktoru: string;
type GunlukCasusu = MockInstance<(...args: unknown[]) => void>;
let uyarilar: GunlukCasusu;
// Dosya boyunca alınan bütün 401 gövdeleri, günlük casusları ve görülen sırlar.
const retGovdeleri: unknown[] = [];
const gunlukCasuslari: GunlukCasusu[] = [];
const sirlar = new Set<string>();

function ozeti(deger: string): string {
  return createHash('sha256').update(deger).digest('hex');
}

// Belirteç ve sırrın kendisi ile özeti günlükte aranacaklar listesine girer.
function sirOlarakKaydet(...degerler: string[]): void {
  for (const deger of degerler) {
    sirlar.add(deger);
    sirlar.add(ozeti(deger));
  }
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

async function girisYap(): Promise<Giris> {
  const giris = await tamGiris(ortam.app, KISI);
  sirOlarakKaydet(
    giris.erisimBelirteci,
    giris.yenilemeBelirteci,
    giris.cihazSirri,
  );
  return giris;
}

function yenile(
  yenilemeBelirteci: string,
  cihazSirri: string,
  basliklar: Record<string, string> = imzaliAdresBasliklari(),
): request.Test {
  return request(ortam.app.getHttpServer())
    .post(YENILE)
    .set(basliklar)
    .send({ yenilemeBelirteci, cihazSirri });
}

async function yenileTamam(
  yenilemeBelirteci: string,
  cihazSirri: string,
): Promise<Yenileme> {
  const cevap = await yenile(yenilemeBelirteci, cihazSirri);
  expect(cevap.status).toBe(200);
  const govde = cevap.body as Yenileme;
  sirOlarakKaydet(govde.erisimBelirteci, govde.yenilemeBelirteci);
  return govde;
}

function retBekle(cevap: request.Response): void {
  retGovdeleri.push(cevap.body);
  expect(cevap.status).toBe(401);
  expect(cevap.body).toEqual(RET);
}

function yetkilerim(erisimBelirteci: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get('/kimlik/oturum/yetkilerim')
    .set(ortam.basliklar(erisimBelirteci));
}

async function oturum(id: string): Promise<OturumSatiri> {
  const [satir] = await satirlar<OturumSatiri>(
    `select baslangic_zamani, son_dondurme_zamani, kapatilma_zamani, kapatilma_nedeni
       from oturum where id = $1`,
    [id],
  );
  if (satir === undefined) {
    throw new Error(`oturum yok: ${id}`);
  }
  return satir;
}

async function sir(id: string): Promise<SirSatiri | undefined> {
  const [satir] = await satirlar<SirSatiri>(
    `select nesil, gecerli_yenileme_ozeti, onceki_yenileme_ozeti, cihaz_sirri_ozeti
       from oturum_sirri where oturum_id = $1`,
    [id],
  );
  return satir;
}

async function kapanmaNedeni(id: string): Promise<string | null> {
  return (await oturum(id)).kapatilma_nedeni;
}

async function notlar(): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      'select govde from outbox_iz order by olusturma_zamani, id',
    )
  ).map((s) => s.govde);
}

// Yenilemenin dokunabileceği tabloların bütün satırları (değişmediğini göstermek için).
async function anlikGoruntu(): Promise<unknown> {
  return {
    oturum: await satirlar('select * from oturum order by id'),
    oturumSirri: await satirlar(
      'select * from oturum_sirri order by oturum_id',
    ),
    outbox: await satirlar('select * from outbox_iz order by id'),
  };
}

function yeniUyarilar(once: number): string[] {
  return uyarilar.mock.calls.slice(once).map(([ileti]) => String(ileti));
}

async function zamaniGeriAl(
  oturumId: string,
  kolon: 'son_dondurme_zamani' | 'mutlak_bitis_zamani',
  saniye: number,
): Promise<void> {
  await ortam.db.query(
    `update oturum set ${kolon} = clock_timestamp() - make_interval(secs => $2) where id = $1`,
    [oturumId, saniye],
  );
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
  // Günlük bütün dosya boyunca yakalanır; asıl yazım da sürer.
  for (const yontem of GUNLUK_YONTEMLERI) {
    const casus: GunlukCasusu = vi.spyOn(Logger.prototype, yontem);
    gunlukCasuslari.push(casus);
    if (yontem === 'warn') {
      uyarilar = casus;
    }
  }
  ortam = await kimlikOrtamiKur();
  kisi = (await ortam.kullaniciAc(KISI)).id;
  const [aktor] = await satirlar<{ id: string }>(
    "select id from kullanici where sistem_aktoru and gorunen_ad = 'kimlik'",
  );
  if (aktor === undefined) {
    throw new Error('kimlik sistem aktörü yok');
  }
  sistemAktoru = aktor.id;
}, 60_000);

afterAll(async () => {
  vi.restoreAllMocks();
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

beforeEach(async () => {
  await ortam.db.query(
    'delete from oturum_sirri; delete from oturum; delete from outbox_iz;',
  );
});

describe('a) başarı', () => {
  it('girişten sonra yenileme 200 döner; yeni erişim belirteci çalışır; nesil 2, özetler kayar, son döndürme ilerler; cevapta cihaz sırrı yoktur', async () => {
    const giris = await girisYap();
    const once = await oturum(giris.oturumId);

    const yeni = await yenileTamam(giris.yenilemeBelirteci, giris.cihazSirri);

    expect(Object.keys(yeni).sort()).toEqual([
      'erisimBelirteci',
      'yenilemeBelirteci',
    ]);
    expect((await yetkilerim(yeni.erisimBelirteci)).status).toBe(200);
    await expect(
      ortam.app
        .get(BelirtecServisi)
        .yenilemeBelirteciDogrula(yeni.yenilemeBelirteci),
    ).resolves.toEqual({
      gecerli: true,
      icerik: { kullaniciId: kisi, oturumId: giris.oturumId, nesil: 2 },
    });
    expect(await sir(giris.oturumId)).toEqual({
      nesil: 2,
      gecerli_yenileme_ozeti: ozeti(yeni.yenilemeBelirteci),
      onceki_yenileme_ozeti: ozeti(giris.yenilemeBelirteci),
      cihaz_sirri_ozeti: ozeti(giris.cihazSirri),
    });
    const sonra = await oturum(giris.oturumId);
    expect(sonra.son_dondurme_zamani.getTime()).toBeGreaterThan(
      once.son_dondurme_zamani.getTime(),
    );
    expect(sonra.kapatilma_zamani).toBeNull();

    // Döndürmenin notları: yazan kişi; sır satırının notu değer taşımaz.
    const dondurmeNotlari = (await notlar()).filter(
      (n) => n.is_adi === 'kimlik:yenile',
    );
    expect(dondurmeNotlari).toEqual([
      expect.objectContaining({
        kullanici_id: kisi,
        kaynak: 'Oturum',
        kayit_id: giris.oturumId,
        eylem: 'guncelleme',
        veri_sahibi_kullanici_id: kisi,
        degisen: {
          son_dondurme_zamani: {
            eski: once.son_dondurme_zamani.toISOString(),
            yeni: sonra.son_dondurme_zamani.toISOString(),
          },
        },
      }),
      expect.objectContaining({
        kullanici_id: kisi,
        kaynak: 'OturumSirri',
        kayit_id: giris.oturumId,
        eylem: 'guncelleme',
        degisen: {},
      }),
    ]);
  });
});

describe('b) pencere içi tekrar', () => {
  it('aynı eski belirteçle hemen yapılan ikinci istek 200 döner, aynı yenileme belirtecini taşır; nesil 2 kalır', async () => {
    const giris = await girisYap();

    const birinci = await yenileTamam(
      giris.yenilemeBelirteci,
      giris.cihazSirri,
    );
    const ikinci = await yenileTamam(giris.yenilemeBelirteci, giris.cihazSirri);

    expect(ikinci.yenilemeBelirteci).toBe(birinci.yenilemeBelirteci);
    expect((await yetkilerim(ikinci.erisimBelirteci)).status).toBe(200);
    expect(await sir(giris.oturumId)).toMatchObject({
      nesil: 2,
      gecerli_yenileme_ozeti: ozeti(birinci.yenilemeBelirteci),
    });
    expect(await kapanmaNedeni(giris.oturumId)).toBeNull();

    // Pencere içi cevabın belirteci geçerli nesildir: bir sonraki döndürme olağan yoldan geçer.
    await yenileTamam(ikinci.yenilemeBelirteci, giris.cihazSirri);
    expect((await sir(giris.oturumId))?.nesil).toBe(3);
  });
});

describe('c) eşzamanlı', () => {
  it('aynı belirteçle aynı anda gönderilen iki istek 200 döner ve aynı yenileme belirtecini taşır; nesil 2', async () => {
    const giris = await girisYap();

    const [x, y] = await Promise.all([
      yenile(giris.yenilemeBelirteci, giris.cihazSirri),
      yenile(giris.yenilemeBelirteci, giris.cihazSirri),
    ]);

    expect([x.status, y.status]).toEqual([200, 200]);
    const bx = x.body as Yenileme;
    const by = y.body as Yenileme;
    sirOlarakKaydet(
      bx.erisimBelirteci,
      bx.yenilemeBelirteci,
      by.erisimBelirteci,
    );
    expect(bx.yenilemeBelirteci).toBe(by.yenilemeBelirteci);
    expect((await sir(giris.oturumId))?.nesil).toBe(2);
    expect(await kapanmaNedeni(giris.oturumId)).toBeNull();
  });
});

describe('d) yeniden kullanım', () => {
  it('pencere dolduktan sonra gelen bir önceki nesil 401 alır; kişinin iki oturumu da kapanır, notları kalır, erişim belirteçleri 401 alır', async () => {
    const a = await girisYap();
    const b = await girisYap();
    const yeni = await yenileTamam(a.yenilemeBelirteci, a.cihazSirri);
    await zamaniGeriAl(
      a.oturumId,
      'son_dondurme_zamani',
      HOSGORU_PENCERESI_MS / 1000 + 1,
    );
    const once = uyarilar.mock.calls.length;

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('yeniden_kullanim');
    expect(await kapanmaNedeni(b.oturumId)).toBe('yeniden_kullanim');
    // Ret işlemi geri almadı: iki kapatma notu outbox'tadır; yazan kimlik sistem aktörüdür.
    const kapatmalar = (await notlar()).filter(
      (n) => n.degisen['kapatilma_nedeni'] !== undefined,
    );
    expect(kapatmalar.map((n) => n.kayit_id).sort()).toEqual(
      [a.oturumId, b.oturumId].sort(),
    );
    for (const not of kapatmalar) {
      expect(not).toMatchObject({
        kullanici_id: sistemAktoru,
        is_adi: 'kimlik:yenile',
        kaynak: 'Oturum',
        eylem: 'guncelleme',
        veri_sahibi_kullanici_id: kisi,
        degisen: { kapatilma_nedeni: { eski: null, yeni: 'yeniden_kullanim' } },
      });
    }
    expect(yeniUyarilar(once).sort()).toEqual(
      [a.oturumId, b.oturumId]
        .map((id) => `Oturum kapatıldı: oturum=${id} neden=yeniden_kullanim`)
        .sort(),
    );
    for (const erisim of [
      a.erisimBelirteci,
      b.erisimBelirteci,
      yeni.erisimBelirteci,
    ]) {
      expect((await yetkilerim(erisim)).status).toBe(401);
    }
  });

  it('iki nesil eski belirteç pencere içinde bile 401 alır ve kişinin iki oturumu da kapanır', async () => {
    const a = await girisYap();
    const b = await girisYap();
    const ikinci = await yenileTamam(a.yenilemeBelirteci, a.cihazSirri);
    await yenileTamam(ikinci.yenilemeBelirteci, a.cihazSirri);

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('yeniden_kullanim');
    expect(await kapanmaNedeni(b.oturumId)).toBe('yeniden_kullanim');
  });
});

describe('e) cihaz sırrı', () => {
  it('yanlış cihaz sırrı 401 alır; yalnız o oturum cihaz_uymadi ile kapanır', async () => {
    const a = await girisYap();
    const b = await girisYap();

    retBekle(await yenile(a.yenilemeBelirteci, b.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('cihaz_uymadi');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
  });

  it('pencere içi dalda yanlış cihaz sırrı da 401 alır; yalnız o oturum cihaz_uymadi ile kapanır', async () => {
    const a = await girisYap();
    const b = await girisYap();
    await yenileTamam(a.yenilemeBelirteci, a.cihazSirri);

    retBekle(await yenile(a.yenilemeBelirteci, b.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('cihaz_uymadi');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
  });
});

describe('f) adres', () => {
  it.each([
    { ad: 'başka adresle', ip: '198.51.100.7', tarayici: undefined },
    { ad: 'başka tarayıcı bilgisiyle', ip: undefined, tarayici: 'curl/8.0' },
  ])(
    '$ad imzalanmış istek 401 alır; yalnız o oturum adres_degisti ile kapanır',
    async ({ ip, tarayici }) => {
      const a = await girisYap();
      const b = await girisYap();

      retBekle(
        await yenile(
          a.yenilemeBelirteci,
          a.cihazSirri,
          imzaliAdresBasliklari(ip, tarayici),
        ),
      );

      expect(await kapanmaNedeni(a.oturumId)).toBe('adres_degisti');
      expect(await kapanmaNedeni(b.oturumId)).toBeNull();
    },
  );

  it('imzasız istek 401 alır ve hiçbir satır değişmez', async () => {
    const a = await girisYap();
    const once = await anlikGoruntu();

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri, {}));

    expect(await anlikGoruntu()).toEqual(once);
  });
});

describe('g) süre', () => {
  it.each([
    {
      ad: 'son döndürmesi hareketsizlik sınırından eski',
      kolon: 'son_dondurme_zamani' as const,
      saniye: HAREKETSIZLIK_SINIRI_MS / 1000 + 1,
    },
    {
      ad: 'mutlak bitişi geçmiş',
      kolon: 'mutlak_bitis_zamani' as const,
      saniye: 1,
    },
  ])('$ad oturum 401 alır ve sure ile kapanır', async ({ kolon, saniye }) => {
    const a = await girisYap();
    const b = await girisYap();
    await zamaniGeriAl(a.oturumId, kolon, saniye);

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('sure');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
  });
});

describe('h) kapalı oturum', () => {
  function cikis(erisimBelirteci: string): request.Test {
    return request(ortam.app.getHttpServer())
      .post('/kimlik/oturum/cikis')
      .set(ortam.basliklar(erisimBelirteci));
  }

  it('çıkış yapılmış oturumun geçerli belirteci 401 alır; öbür oturum açık kalır; güvenlik olayı yazılmaz', async () => {
    const a = await girisYap();
    const b = await girisYap();
    expect((await cikis(a.erisimBelirteci)).status).toBe(204);
    const once = uyarilar.mock.calls.length;

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('cikis');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
    expect(yeniUyarilar(once)).toEqual([]);
  });

  it('kapalı oturuma eski nesil gelince 401 alır; öbür oturum açık kalır; uyarı düzeyinde günlük satırı oluşur', async () => {
    const a = await girisYap();
    const b = await girisYap();
    const yeni = await yenileTamam(a.yenilemeBelirteci, a.cihazSirri);
    expect((await cikis(yeni.erisimBelirteci)).status).toBe(204);
    const once = uyarilar.mock.calls.length;

    retBekle(await yenile(a.yenilemeBelirteci, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('cikis');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
    expect(yeniUyarilar(once)).toEqual([
      `Kapalı oturuma eski nesil geldi: oturum=${a.oturumId} neden=kapali_oturuma_eski_nesil`,
    ]);
  });
});

describe('i) tür ve imza', () => {
  it('erişim belirteci, imzası bozuk belirteç ve süresi dolmuş yenileme belirteci 401 alır; hiçbir satır değişmez', async () => {
    const a = await girisYap();
    const [baslik, yuk, imza = ''] = a.yenilemeBelirteci.split('.');
    const bozukImza = `${imza.slice(0, 10)}${imza[10] === 'A' ? 'B' : 'A'}${imza.slice(11)}`;
    const suresiDolmus = await ortam.app
      .get(BelirtecServisi)
      .yenilemeBelirteciUret(
        { kullaniciId: kisi, oturumId: a.oturumId, nesil: 1 },
        new Date(Date.now() - (YENILEME_BELIRTECI_SURESI_SN + 60) * 1000),
      );
    sirOlarakKaydet(suresiDolmus);
    const once = await anlikGoruntu();

    for (const belirtec of [
      a.erisimBelirteci,
      `${String(baslik)}.${String(yuk)}.${bozukImza}`,
      suresiDolmus,
    ]) {
      retBekle(await yenile(belirtec, a.cihazSirri));
    }

    expect(await anlikGoruntu()).toEqual(once);
  });
});

describe('j) tutarsız nesil', () => {
  it('satırdakinden büyük nesil taşıyan belirteç 401 alır; oturum tutarsiz_nesil ile kapanır', async () => {
    const a = await girisYap();
    const b = await girisYap();
    const buyuk = await ortam.app.get(BelirtecServisi).yenilemeBelirteciUret({
      kullaniciId: kisi,
      oturumId: a.oturumId,
      nesil: 5,
    });
    sirOlarakKaydet(buyuk);

    retBekle(await yenile(buyuk, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('tutarsiz_nesil');
    expect(await kapanmaNedeni(b.oturumId)).toBeNull();
  });

  it('nesli eşit ama özeti farklı belirteç 401 alır; oturum tutarsiz_nesil ile kapanır', async () => {
    const a = await girisYap();
    const esit = await ortam.app
      .get(BelirtecServisi)
      .yenilemeBelirteciUret(
        { kullaniciId: kisi, oturumId: a.oturumId, nesil: 1 },
        new Date(Date.now() - 100_000),
      );
    sirOlarakKaydet(esit);
    expect(esit).not.toBe(a.yenilemeBelirteci);

    retBekle(await yenile(esit, a.cihazSirri));

    expect(await kapanmaNedeni(a.oturumId)).toBe('tutarsiz_nesil');
  });
});

describe('k) tek cevap', () => {
  it('bütün 401 cevaplarının kodu ve iletisi aynıdır; günlükte belirteç, cihaz sırrı ve özet geçmez', () => {
    expect(retGovdeleri.length).toBeGreaterThanOrEqual(16);
    for (const govde of retGovdeleri) {
      expect(govde).toEqual(RET);
    }
    const gunlukSatirlari = gunlukCasuslari.flatMap((casus) =>
      casus.mock.calls.map((args) =>
        args.map((arg) => JSON.stringify(arg)).join(' '),
      ),
    );
    expect(gunlukSatirlari.length).toBeGreaterThan(0);
    expect(sirlar.size).toBeGreaterThan(0);
    for (const satir of gunlukSatirlari) {
      for (const deger of sirlar) {
        expect(satir).not.toContain(deger);
      }
    }
  });
});
