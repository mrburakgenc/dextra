// Parola değiştirme (GV-100; TS-002 "İşlem sınırları" Parola değiştir, AK-50, AK-33, AK-35).
// Koşturma:
//   pnpm -C backend test:e2e test/kimlik-parola-degistir.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (AppModule, göçleri uygulanmış asıl ve iz geçici
// veritabanları, gerçek başlangıç) açılır. Her test kendi kişisini yardımcıyla açar; kişi uçtan girer.
// Yarış, işleyicinin iki adımı arasına girilerek kurulur: eski parola doğrulandıktan sonra yeni
// parola özetlenirken (ParolaOzetleyici.ozetle) sır ya da oturum SQL ile değiştirilir; ardından
// işleyici işlemini açar. Teknik günlük bütün dosya boyunca yakalanır.
import { Logger } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { ParolaOzetleyici } from '../src/features/kimlik/parola/domain/parola-ozetleyici.port.js';
import { ParolaController } from '../src/features/kimlik/parola/presentation/parola.controller.js';
import { isaretleriOku } from '../src/shared/guvenlik/application/isaretler.js';
import { YALNIZ_KENDISI_UCLARI } from '../src/shared/guvenlik/domain/yalniz-kendisi-listesi.js';
import {
  imzaliAdresBasliklari,
  type KimlikOrtami,
  kimlikOrtamiKur,
  tamGiris,
} from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const UC = '/kimlik/parola/degistir';
// Yardımcının açtığı her kişinin parolası (kimlik-yardimci.ts içindeki değerle aynı).
const ESKI = 'yardimcinin uzun ve dogru parola cümlesi';
const YENI = 'yepyeni ve uzun bir parola cümlesi';
const IS_ADI = 'kimlik:parola-degistir';
const GUNLUK_YONTEMLERI = [
  'log',
  'warn',
  'error',
  'debug',
  'verbose',
  'fatal',
] as const;

interface Not {
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  veri_sahibi_kullanici_id: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

interface SirSatiri {
  parola_ozeti: string;
  guncelleme_zamani: Date;
}

let ortam: KimlikOrtami;
type GunlukCasusu = MockInstance<(...args: unknown[]) => void>;
const gunlukCasuslari: GunlukCasusu[] = [];
// Dosya boyunca kullanılan parolalar ve görülen parola özetleri; günlükte ve notlarda aranır.
const sirlar = new Set<string>([ESKI, YENI]);
let kisiSayaci = 0;

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

interface OturumBilgisi {
  id: string;
  erisimBelirteci: string;
}

// Yeni bir kişi açar (yardımcı bir oturum açtırır) ve ikinci oturumu açtırır; ilki isteği yapacak
// oturumdur.
async function kisiAc(): Promise<{
  id: string;
  kullaniciAdi: string;
  oturumlar: [OturumBilgisi, OturumBilgisi];
}> {
  kisiSayaci += 1;
  const kullaniciAdi = `degistiren${String(kisiSayaci)}`;
  const { id, erisimBelirteci } = await ortam.kullaniciAc(kullaniciAdi);
  const [ilk] = await satirlar<{ id: string }>(
    'select id from oturum where kullanici_id = $1',
    [id],
  );
  if (ilk === undefined) {
    throw new Error(`oturum yok: ${kullaniciAdi}`);
  }
  const ikinci = await tamGiris(ortam.app, kullaniciAdi);
  sirlar.add(erisimBelirteci).add(ikinci.erisimBelirteci);
  const ozet = await sir(id);
  if (ozet !== undefined) {
    sirlar.add(ozet.parola_ozeti);
  }
  return {
    id,
    kullaniciAdi,
    oturumlar: [
      { id: ilk.id, erisimBelirteci },
      { id: ikinci.oturumId, erisimBelirteci: ikinci.erisimBelirteci },
    ],
  };
}

function degistir(
  erisimBelirteci: string | undefined,
  govde: object,
): request.Test {
  const istek = request(ortam.app.getHttpServer()).post(UC);
  return (
    erisimBelirteci === undefined
      ? istek.set(imzaliAdresBasliklari())
      : istek.set(ortam.basliklar(erisimBelirteci))
  ).send(govde);
}

function giris(kullaniciAdi: string, parola: string): request.Test {
  return request(ortam.app.getHttpServer())
    .post('/kimlik/oturum/giris')
    .set(imzaliAdresBasliklari())
    .send({ kullaniciAdi, parola });
}

function yetkilerim(erisimBelirteci: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get('/kimlik/oturum/yetkilerim')
    .set(ortam.basliklar(erisimBelirteci));
}

async function sir(kullaniciId: string): Promise<SirSatiri | undefined> {
  const [satir] = await satirlar<SirSatiri>(
    'select parola_ozeti, guncelleme_zamani from kullanici_sirri where kullanici_id = $1',
    [kullaniciId],
  );
  return satir;
}

async function kapanmaNedenleri(
  kullaniciId: string,
): Promise<Record<string, string | null>> {
  const rows = await satirlar<{ id: string; kapatilma_nedeni: string | null }>(
    'select id, kapatilma_nedeni from oturum where kullanici_id = $1',
    [kullaniciId],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.kapatilma_nedeni]));
}

async function bununNotlari(): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      "select govde from outbox_iz where govde->>'is_adi' = $1 order by olusturma_zamani, id",
      [IS_ADI],
    )
  ).map((s) => s.govde);
}

// Kişinin parola değiştirmenin dokunabileceği bütün satırları ve not sayısı (değişmediğini göstermek
// için).
async function anlikGoruntu(kullaniciId: string): Promise<unknown> {
  return {
    kullanici: await satirlar('select * from kullanici where id = $1', [
      kullaniciId,
    ]),
    sir: await satirlar(
      'select * from kullanici_sirri where kullanici_id = $1',
      [kullaniciId],
    ),
    oturum: await satirlar(
      'select * from oturum where kullanici_id = $1 order by id',
      [kullaniciId],
    ),
    notSayisi: (
      await satirlar<{ sayi: string }>(
        'select count(*)::text as sayi from outbox_iz',
      )
    )[0]?.sayi,
  };
}

// Yeni parolanın özetlenmesinden hemen önce (eski parola doğrulandıktan sonra, işlem açılmadan)
// verilen işi bir kez koşturur.
function ozetlemedenOnce(is: () => Promise<void>): void {
  const ozetleyici = ortam.app.get(ParolaOzetleyici);
  const asil = ozetleyici.ozetle.bind(ozetleyici);
  vi.spyOn(ozetleyici, 'ozetle').mockImplementationOnce(async (parola) => {
    await is();
    return asil(parola);
  });
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
    gunlukCasuslari.push(vi.spyOn(Logger.prototype, yontem));
  }
  ortam = await kimlikOrtamiKur();
}, 60_000);

afterAll(async () => {
  vi.restoreAllMocks();
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) başarı', () => {
  it('iki oturumu açık kişi parolasını değiştirir: 204; iki oturum parola_degisimi ile kapanır ve 401 alır; eski parola girmez, yeni girer; iki kapatma notu ve değer taşımayan sır notu, yazan kişidir', async () => {
    const kisi = await kisiAc();
    const [istekte, obur] = kisi.oturumlar;
    const onceki = await sir(kisi.id);

    const cevap = await degistir(istekte.erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');
    expect(await kapanmaNedenleri(kisi.id)).toEqual({
      [istekte.id]: 'parola_degisimi',
      [obur.id]: 'parola_degisimi',
    });
    expect((await yetkilerim(istekte.erisimBelirteci)).status).toBe(401);
    expect((await yetkilerim(obur.erisimBelirteci)).status).toBe(401);

    const sonraki = await sir(kisi.id);
    if (onceki === undefined || sonraki === undefined) {
      throw new Error('sır satırı yok');
    }
    sirlar.add(sonraki.parola_ozeti);
    expect(sonraki.parola_ozeti).not.toBe(onceki.parola_ozeti);
    expect(sonraki.guncelleme_zamani.getTime()).toBeGreaterThan(
      onceki.guncelleme_zamani.getTime(),
    );

    expect((await giris(kisi.kullaniciAdi, ESKI)).status).toBe(401);
    expect((await giris(kisi.kullaniciAdi, YENI)).status).toBe(200);

    const notlar = await bununNotlari();
    expect(notlar).toHaveLength(3);
    for (const not of notlar) {
      expect(not.kullanici_id).toBe(kisi.id);
      expect(not.veri_sahibi_kullanici_id).toBe(kisi.id);
      expect(not.eylem).toBe('guncelleme');
    }
    const sirNotu = notlar.filter((n) => n.kaynak === 'KullaniciSirri');
    expect(sirNotu).toHaveLength(1);
    expect(sirNotu[0]?.kayit_id).toBe(kisi.id);
    expect(sirNotu[0]?.degisen).toEqual({
      guncelleme_zamani: {
        eski: onceki.guncelleme_zamani.toISOString(),
        yeni: sonraki.guncelleme_zamani.toISOString(),
      },
    });
    const kapatmaNotlari = notlar.filter((n) => n.kaynak === 'Oturum');
    expect(kapatmaNotlari.map((n) => n.kayit_id).sort()).toEqual(
      [istekte.id, obur.id].sort(),
    );
    for (const not of kapatmaNotlari) {
      expect(not.degisen['kapatilma_nedeni']).toEqual({
        eski: null,
        yeni: 'parola_degisimi',
      });
    }
  });
});

describe('b) eski parola yanlış', () => {
  it('400 dogrulama_hatasi, alan eskiParola; sır, oturumlar ve notlar değişmez', async () => {
    const kisi = await kisiAc();
    const once = await anlikGoruntu(kisi.id);

    const cevap = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: 'bu eski parola degil ama uzun',
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(400);
    expect(cevap.body).toEqual({
      kod: 'dogrulama_hatasi',
      ileti: 'Eski parola yanlış',
      ayrinti: [{ alan: 'eskiParola', neden: 'Eski parola yanlış' }],
    });
    expect(await anlikGoruntu(kisi.id)).toEqual(once);
  });
});

describe('c) yeni parola kurala uymuyor', () => {
  it('14 karakterlik yeni parola 400 alır, alan yeniParola; hiçbir satır değişmez', async () => {
    const kisi = await kisiAc();
    const once = await anlikGoruntu(kisi.id);

    const cevap = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: 'a'.repeat(14),
    });

    expect(cevap.status).toBe(400);
    expect((cevap.body as { kod: string }).kod).toBe('dogrulama_hatasi');
    expect(
      (cevap.body as { ayrinti: { alan: string }[] }).ayrinti.map(
        (a) => a.alan,
      ),
    ).toEqual(['yeniParola']);
    expect(await anlikGoruntu(kisi.id)).toEqual(once);
  });
});

describe('d) yarış ve kilit altındaki yeniden bakış', () => {
  it('eski parola doğrulandıktan sonra sır başka yoldan değişmişse 409 döner; sır o değişikliğin bıraktığı gibidir, oturumlar açıktır', async () => {
    const kisi = await kisiAc();
    const baskaOzet = await ortam.app
      .get(ParolaOzetleyici)
      .ozetle('baska bir yoldan konan parola');
    sirlar.add(baskaOzet);
    let birakilan: SirSatiri | undefined;
    // Yol: işleyicinin iki adımı arasına girilir (eski parola doğrulandı, işlem henüz açılmadı);
    // sır SQL ile yeni bir özet ve güncelleme zamanıyla yazılır.
    ozetlemedenOnce(async () => {
      [birakilan] = await satirlar<SirSatiri>(
        `update kullanici_sirri
            set parola_ozeti = $2, guncelleme_zamani = clock_timestamp() + interval '1 second'
          where kullanici_id = $1
         returning parola_ozeti, guncelleme_zamani`,
        [kisi.id, baskaOzet],
      );
    });
    const notSayisi = (await bununNotlari()).length;

    const cevap = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(409);
    expect((cevap.body as { kod: string }).kod).toBe('cakisma');
    expect(birakilan).toBeDefined();
    expect(await sir(kisi.id)).toEqual(birakilan);
    expect(Object.values(await kapanmaNedenleri(kisi.id))).toEqual([
      null,
      null,
    ]);
    expect(await bununNotlari()).toHaveLength(notSayisi);
  });

  it('isteği yapan oturum bu arada kapanmışsa 401 kimlik_gerekli döner; hiçbir şey yazılmaz', async () => {
    const kisi = await kisiAc();
    const [istekte, obur] = kisi.oturumlar;
    let once: unknown;
    // Yol: işleyicinin iki adımı arasına girilir; isteği yapan oturum SQL ile kapatılır.
    ozetlemedenOnce(async () => {
      await ortam.db.query(
        "update oturum set kapatilma_zamani = clock_timestamp(), kapatilma_nedeni = 'cikis' where id = $1",
        [istekte.id],
      );
      once = await anlikGoruntu(kisi.id);
    });

    const cevap = await degistir(istekte.erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(401);
    expect((cevap.body as { kod: string }).kod).toBe('kimlik_gerekli');
    expect(await anlikGoruntu(kisi.id)).toEqual(once);
    expect((await kapanmaNedenleri(kisi.id))[obur.id]).toBeNull();
  });

  it('kişinin parolası yoksa 409 cakisma döner; oturumlar açık kalır', async () => {
    const kisi = await kisiAc();
    await ortam.db.query('delete from kullanici_sirri where kullanici_id = $1', [
      kisi.id,
    ]);
    const once = await anlikGoruntu(kisi.id);

    const cevap = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(409);
    expect((cevap.body as { kod: string }).kod).toBe('cakisma');
    expect(await anlikGoruntu(kisi.id)).toEqual(once);
  });
});

describe('e) oturumsuz istek ve başkasının parolası', () => {
  it('oturumsuz istek 401 kimlik_gerekli alır', async () => {
    const cevap = await degistir(undefined, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(cevap.status).toBe(401);
    expect((cevap.body as { kod: string }).kod).toBe('kimlik_gerekli');
  });

  it('gövdede kişi seçen fazla alan 400 alır; iki kişide de hiçbir şey değişmez; başarılı değişim yalnız isteği yapanı etkiler', async () => {
    const kisi = await kisiAc();
    const baskasi = await kisiAc();
    const kisiOnce = await anlikGoruntu(kisi.id);
    const baskasiSir = await sir(baskasi.id);

    const fazla = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
      kullaniciId: baskasi.id,
    });

    expect(fazla.status).toBe(400);
    expect((fazla.body as { kod: string }).kod).toBe('dogrulama_hatasi');
    expect(await anlikGoruntu(kisi.id)).toEqual(kisiOnce);
    expect(await sir(baskasi.id)).toEqual(baskasiSir);

    // Başkasının eski parolası da aynı olduğu hâlde değişim yalnız oturumun sahibine uygulanır.
    const dogru = await degistir(kisi.oturumlar[0].erisimBelirteci, {
      eskiParola: ESKI,
      yeniParola: YENI,
    });

    expect(dogru.status).toBe(204);
    expect(await sir(baskasi.id)).toEqual(baskasiSir);
    expect(Object.values(await kapanmaNedenleri(baskasi.id))).toEqual([
      null,
      null,
    ]);
  });
});

describe('f) açılış ve sayılı liste', () => {
  it('sayılı listede ParolaController.degistir vardır, uç yalnız kendisi işaretlidir ve uygulama açılmıştır', () => {
    expect(YALNIZ_KENDISI_UCLARI).toContain('ParolaController.degistir');
    expect(
      isaretleriOku(
        Reflect.get(ParolaController.prototype as object, 'degistir') as object,
      ),
    ).toEqual([{ tur: 'yalniz_kendisi' }]);
    expect(ortam.app.getHttpServer()).toBeDefined();
  });
});

describe('g) günlük ve notlar', () => {
  it('günlükte ve notlarda parola ya da özet geçmez', async () => {
    for (const { parola_ozeti } of await satirlar<{ parola_ozeti: string }>(
      'select parola_ozeti from kullanici_sirri',
    )) {
      sirlar.add(parola_ozeti);
    }
    const gunlukSatirlari = gunlukCasuslari.flatMap((casus) =>
      casus.mock.calls.map((args) =>
        args.map((arg) => JSON.stringify(arg)).join(' '),
      ),
    );
    const notMetinleri = (
      await satirlar<{ metin: string }>(
        'select govde::text as metin from outbox_iz',
      )
    ).map((s) => s.metin);
    expect(notMetinleri.length).toBeGreaterThan(0);
    expect(sirlar.size).toBeGreaterThan(2);
    for (const satir of [...gunlukSatirlari, ...notMetinleri]) {
      for (const deger of sirlar) {
        expect(satir).not.toContain(deger);
      }
    }
  });
});
