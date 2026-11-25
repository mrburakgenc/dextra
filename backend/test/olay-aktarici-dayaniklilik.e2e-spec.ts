// Olay aktarıcısının dayanıklılığı (GV-018): erteleme, tıkanmama, neden, süre bütçesi, döngü,
// temizlik, ölçüler. Koşturma:
//   pnpm -C backend test:e2e test/olay-aktarici-dayaniklilik.e2e-spec.ts --reporter=verbose
// Asıl şemanın göçleri ve kuyruk göçü uygulanmış geçici bir veritabanında koşar. Notlar yazma
// yüzeyiyle run içinde bırakılır; kuyruğa kapısından (IS_KUYRUGU) ya da onun yerine geçen sınama
// gerçeklemesinden ulaşılır; doğrulama sorguları pg ile atılır.
import { createHook } from 'node:async_hooks';
import { randomUUIDv7 } from 'node:crypto';
import { setTimeout as uyu } from 'node:timers/promises';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import type { Prisma } from '../src/shared/database/generated/client.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/registrar.js';
import {
  ISLEM_SURE_SINIRI_MS,
  UnitOfWork,
} from '../src/shared/database/unit-of-work.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
  type KuyrukIsi,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { KuyrukModule } from '../src/shared/messaging/kuyruk/kuyruk.module.js';
import { AboneDefteri } from '../src/shared/messaging/olay/abone-defteri.js';
import {
  BOS_BEKLEME_MS,
  GECIS_BUTCESI_MS,
  KUYRUK_CAGRISI_SURE_SINIRI_MS,
  OlayAktarici,
  PARTI_BOYU,
} from '../src/shared/messaging/olay/olay-aktarici.js';
import { outboxOlayRepoKaydet } from '../src/shared/messaging/olay/outbox-olay.repository.js';
import {
  OUTBOX_REPO,
  outboxRepo,
} from '../src/shared/messaging/outbox/outbox-repo.js';
import { OutboxYazici } from '../src/shared/messaging/outbox/outbox-yazici.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

async function bekle(
  ne: string,
  sinirMs: number,
  kosul: () => Promise<boolean> | boolean,
): Promise<void> {
  const son = Date.now() + sinirMs;
  while (!(await kosul())) {
    if (Date.now() > son) {
      throw new Error(`${ne}: ${String(sinirMs)} ms içinde gerçekleşmedi`);
    }
    await uyu(25);
  }
}

// Aktarıcının kurduğu ve henüz ateşlenmemiş ya da kaldırılmamış zamanlayıcılar: döngünün beklemesi
// ve kuyruk çağrısının süre sınırı. Sürecin bütün zamanlayıcıları sayılmaz (vitest ve kuyruk
// kitaplığı kendi zamanlayıcılarını açıp kapatır). Zamanlayıcı kurulurken çağrı yığını
// Dongu.planla'dan ya da sureyleSinirla'dan geçiyorsa izlenir; ateşlenince ya da kaldırılınca
// Node'un destroy olayıyla kümeden çıkar.
const aktariciZamanlayicilari = new Set<number>();
createHook({
  init(kimlik, tur) {
    const yigin = new Error().stack ?? '';
    if (
      tur === 'Timeout' &&
      (yigin.includes('Dongu.planla') || yigin.includes('sureyleSinirla'))
    ) {
      aktariciZamanlayicilari.add(kimlik);
    }
  },
  destroy(kimlik) {
    aktariciZamanlayicilari.delete(kimlik);
  },
}).enable();

// Kaldırılan zamanlayıcının destroy olayı eşzamanlı gelmez; bir setImmediate turu beklenir.
async function acikAktariciZamanlayicisi(): Promise<number> {
  await new Promise((coz) => setImmediate(coz));
  return aktariciZamanlayicilari.size;
}

let db: TestDatabase;
// Doğrulama sorgularını atan bağlantı.
let gozlemci: pg.Client;
let prisma: PrismaClient;
let uow: UnitOfWork;
let kuyrukModulu: TestingModule;
let kuyruk: IsKuyrugu;
const yazici = new OutboxYazici();
const asilAdres = process.env['DATABASE_URL'];

// Verilen ad için bir ya da daha çok olay notunu tek run içinde bırakır; kimlikleri döner.
async function notBirak(
  ad: string,
  kac = 1,
  veri: Prisma.InputJsonObject = {},
): Promise<string[]> {
  return uow.run(async (islem) => {
    const kimlikler: string[] = [];
    for (let i = 0; i < kac; i += 1) {
      kimlikler.push(
        await yazici.olay(islem, {
          ad,
          surum: 1,
          veri,
          korelasyon_id: randomUUIDv7(),
        }),
      );
    }
    return kimlikler;
  });
}

async function aktarilmislar(): Promise<string[]> {
  const { rows } = await gozlemci.query<{ id: string }>(
    'select id from outbox_olay where aktarim_zamani is not null order by id',
  );
  return rows.map((satir) => satir.id);
}

async function isKimlikleri(kuyrukAdi: string): Promise<string[]> {
  const { rows } = await gozlemci.query<{ id: string }>(
    'select id from kuyruk.job where queue = $1 order by id',
    [kuyrukAdi],
  );
  return rows.map((satir) => satir.id);
}

interface NotDurumu {
  id: string;
  aktarim_zamani: string | null;
  deneme_sayisi: number;
  // Sonraki denemeye kalan süre (sn); sonraki_deneme_zamani boşsa null.
  kalan_sn: number | null;
  son_hata: string | null;
}

async function notDurumlari(): Promise<NotDurumu[]> {
  const { rows } = await gozlemci.query<NotDurumu>(
    `select id, aktarim_zamani::text, deneme_sayisi, son_hata,
            extract(epoch from sonraki_deneme_zamani - clock_timestamp())::float8 as kalan_sn
       from outbox_olay order by id`,
  );
  return rows;
}

// Gerçek kapının önüne konan sınama gerçeklemesi: `engel` verilen kuyruk için bir söz dönerse o
// söz döner; dönmezse iş gerçek kapıya gider.
function sinamaKuyrugu(
  engel: (kuyrukAdi: string, is: KuyrukIsi) => Promise<void> | undefined,
): IsKuyrugu {
  return {
    koy: (ad, is) => engel(ad, is) ?? kuyruk.koy(ad, is),
    dinle: (ad, isleyici) => kuyruk.dinle(ad, isleyici),
    basarisizSayisi: (ad) => kuyruk.basarisizSayisi(ad),
  };
}

// Kuyruğu kapıdan dinleyen sınama işleyicisi; aldığı işleri biriktirir.
async function sinamaIsleyicisi(
  kuyrukAdi: string,
): Promise<{ gelen: KuyrukIsi[]; kapat: () => Promise<void> }> {
  const gelen: KuyrukIsi[] = [];
  const dinleyici = await kuyruk.dinle(kuyrukAdi, (is) => {
    gelen.push(is);
    return Promise.resolve();
  });
  return { gelen, kapat: () => dinleyici.kapat() };
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  // Kurulum burada yarıda kalırsa geçici veritabanı sunucuda kalmaz.
  try {
    await kuyrukGocunuKos(db.url);
    gozlemci = new pg.Client({ connectionString: db.url });
    await gozlemci.connect();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: db.url }),
    });
    const kayitlar = new RepoKayitlari();
    kayitlar.register(OUTBOX_REPO, outboxRepo);
    outboxOlayRepoKaydet(kayitlar);
    uow = new UnitOfWork(prisma, kayitlar);
    // Kuyruk modülü bağlantı adresini DATABASE_URL'den okur; bu dosyada geçici veritabanını gösterir.
    process.env['DATABASE_URL'] = db.url;
    kuyrukModulu = await Test.createTestingModule({
      imports: [KuyrukModule],
    }).compile();
    kuyruk = kuyrukModulu.get<IsKuyrugu>(IS_KUYRUGU);
  } catch (error) {
    await db.drop();
    throw error;
  }
});

afterAll(async () => {
  process.env['DATABASE_URL'] = asilAdres;
  // Uygulamanın kapanışı: kuyruk bağdaştırıcısı açtığı kuyruk ve dinleyicileri kapatır.
  await kuyrukModulu.close();
  await prisma.$disconnect();
  expect(
    await kalanBaglantiSayisi(gozlemci, db.name, []),
    'geçici veritabanında açık bağlantı kalmaz',
  ).toBe(0);
  await gozlemci.end();
  await db.drop();
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const kalan = await sunucu.query(
      'select 1 from pg_database where datname = $1',
      [db.name],
    );
    expect(kalan.rows).toHaveLength(0);
  } finally {
    await sunucu.end();
  }
  expect(await acikAktariciZamanlayicisi()).toBe(0);
});

beforeEach(async () => {
  await gozlemci.query('truncate outbox_olay');
});

describe('b) erteleme', () => {
  it('bir kuyruğuna iş konamayan not ertelenir, son_hata kuyruğun adını taşır ve olayın verisini taşımaz; ardından gelen geçiş onu almaz ama yeni notu aktarır; zamanı geri çekilince aktarılır ve ilk kuyrukta iş ikilenmez', async () => {
    const defter = new AboneDefteri();
    defter.bildir('b-tuketici-1', 'b.olay');
    defter.bildir('b-tuketici-2', 'b.olay');
    defter.bildir('b-tuketici-3', 'b.diger-olay');
    // Engel varken b-tuketici-2'ye konan iş, metninde işin verisini taşıyan bir hatayla düşer.
    let engel = true;
    const aktarici = new OlayAktarici(
      uow,
      defter,
      sinamaKuyrugu((ad, is) =>
        engel && ad === 'b-tuketici-2'
          ? Promise.reject(
              new Error(`kuyruk erişilemez: ${JSON.stringify(is.veri)}`),
            )
          : undefined,
      ),
    );
    const gizli = 'gizli-olay-degeri-4b9e';
    const [takilan = ''] = await notBirak('b.olay', 1, { gizli });

    expect(await aktarici.gecis()).toEqual({
      aktarilan: 0,
      kalan: 1,
      konamayanlar: [
        { olayId: takilan, kuyruk: 'b-tuketici-2', hataSinifi: 'Error' },
      ],
    });
    const [durum] = await notDurumlari();
    expect(durum).toMatchObject({
      id: takilan,
      aktarim_zamani: null,
      deneme_sayisi: 1,
      son_hata: 'b-tuketici-2: Error',
    });
    expect(durum?.kalan_sn).toBeGreaterThan(0);
    expect(durum?.son_hata).not.toContain(gizli);
    expect(await isKimlikleri('b-tuketici-1')).toEqual([takilan]);

    // Hemen ardından gelen geçiş ertelenen notu almaz; sonradan eklenen notu aktarır.
    const [yeni = ''] = await notBirak('b.diger-olay');
    expect(await aktarici.gecis()).toEqual({
      aktarilan: 1,
      kalan: 0,
      konamayanlar: [],
    });
    expect(await aktarilmislar()).toEqual([yeni]);

    // Zaman SQL ile geri çekilir, engel kalkar: not yeniden denenir ve aktarılır.
    engel = false;
    await gozlemci.query(
      `update outbox_olay set sonraki_deneme_zamani = clock_timestamp() - interval '1 second'
        where id = $1`,
      [takilan],
    );
    expect(await aktarici.gecis()).toEqual({
      aktarilan: 1,
      kalan: 0,
      konamayanlar: [],
    });
    expect((await aktarilmislar()).sort()).toEqual([takilan, yeni].sort());
    // İlk kuyrukta önceki geçişin işi duruyordu; aynı kimlikli ikinci iş üretilmedi.
    expect(await isKimlikleri('b-tuketici-1')).toEqual([takilan]);
    expect(await isKimlikleri('b-tuketici-2')).toEqual([takilan]);
  });
});

describe('c) tıkanmama', () => {
  it('sürekli konamayan 150 not varken eklenen yeni not en geç ikinci geçişte aktarılır', async ({
    annotate,
  }) => {
    const defter = new AboneDefteri();
    defter.bildir('c-takilan', 'c.takilan');
    defter.bildir('c-tuketici', 'c.olay');
    const aktarici = new OlayAktarici(
      uow,
      defter,
      sinamaKuyrugu((ad) =>
        ad === 'c-takilan'
          ? Promise.reject(new Error('kuyruk erişilemez'))
          : undefined,
      ),
    );
    await notBirak('c.takilan', 150);
    const [yeni = ''] = await notBirak('c.olay');

    const sonuclar = [];
    for (let gecis = 0; gecis < 2; gecis += 1) {
      sonuclar.push(await aktarici.gecis());
      if ((await aktarilmislar()).includes(yeni)) break;
    }
    await annotate(
      `geçişler: ${sonuclar.map((s) => `aktarılan ${String(s.aktarilan)}, kalan ${String(s.kalan)}`).join(' | ')}`,
    );
    expect(await aktarilmislar()).toEqual([yeni]);
    // İlk geçiş dolu bir parti aldı; sıra güvencesi olmadığından yeni not ilk ya da ikinci geçişte gelir.
    expect(
      (sonuclar[0]?.aktarilan ?? 0) + (sonuclar[0]?.kalan ?? 0),
    ).toBe(PARTI_BOYU);
    expect(await isKimlikleri('c-tuketici')).toEqual([yeni]);
  });
});

describe('d) neden', () => {
  it('geçişin sonucu konamayan iş için kuyruğun adını ve hatanın sınıfını taşır', async () => {
    class KuyrukKapali extends Error {
      override name = 'KuyrukKapali';
    }
    const defter = new AboneDefteri();
    defter.bildir('d-tuketici-1', 'd.olay');
    defter.bildir('d-tuketici-2', 'd.olay');
    const aktarici = new OlayAktarici(
      uow,
      defter,
      sinamaKuyrugu((ad) =>
        ad === 'd-tuketici-2'
          ? Promise.reject(new KuyrukKapali('bağlantı yok'))
          : undefined,
      ),
    );
    const [id = ''] = await notBirak('d.olay');

    expect(await aktarici.gecis()).toEqual({
      aktarilan: 0,
      kalan: 1,
      konamayanlar: [
        { olayId: id, kuyruk: 'd-tuketici-2', hataSinifi: 'KuyrukKapali' },
      ],
    });
  });
});

describe('e) süre bütçesi', () => {
  it('kuyruk çağrısı asılı kalınca geçiş 5 saniyeden kısa sürede hata atmadan döner, açık işlem bırakmaz; asılı çağrının notu konamamış sayılır; bütçe dolunca kalan notlara dokunulmaz', async ({
    annotate,
  }) => {
    const defter = new AboneDefteri();
    defter.bildir('e-asili', 'e.olay');
    // Bu kuyruğa konan iş hiç bitmez: söz ne çözülür ne reddedilir.
    const aktarici = new OlayAktarici(
      uow,
      defter,
      sinamaKuyrugu((ad) =>
        ad === 'e-asili' ? new Promise<void>(() => undefined) : undefined,
      ),
    );
    const notSayisi = 6;
    await notBirak('e.olay', notSayisi);

    const baslangic = performance.now();
    const sonuc = await aktarici.gecis();
    const sure = performance.now() - baslangic;

    const { rows } = await gozlemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()
          and xact_start is not null`,
    );
    const acikIslem = rows[0]?.sayi ?? -1;
    const durumlar = await notDurumlari();
    const ertelenenler = durumlar.filter((d) => d.deneme_sayisi === 1);
    const dokunulmayanlar = durumlar.filter(
      (d) =>
        d.aktarim_zamani === null &&
        d.deneme_sayisi === 0 &&
        d.kalan_sn === null &&
        d.son_hata === null,
    );
    await annotate(
      `asılı kuyrukla geçiş ${sure.toFixed(0)} ms (KUYRUK_CAGRISI_SURE_SINIRI_MS ${String(KUYRUK_CAGRISI_SURE_SINIRI_MS)}, GECIS_BUTCESI_MS ${String(GECIS_BUTCESI_MS)}, ISLEM_SURE_SINIRI_MS ${String(ISLEM_SURE_SINIRI_MS)}); ertelenen ${String(ertelenenler.length)}, dokunulmayan ${String(dokunulmayanlar.length)}; açık işlem ${String(acikIslem)}`,
    );

    expect(sure).toBeLessThan(ISLEM_SURE_SINIRI_MS);
    expect(acikIslem).toBe(0);
    expect(sonuc.aktarilan).toBe(0);
    expect(sonuc.kalan).toBe(notSayisi);
    expect(ertelenenler.length).toBeGreaterThan(0);
    expect(dokunulmayanlar.length).toBeGreaterThan(0);
    expect(ertelenenler.length + dokunulmayanlar.length).toBe(notSayisi);
    for (const ertelenen of ertelenenler) {
      expect(ertelenen).toMatchObject({
        aktarim_zamani: null,
        son_hata: 'e-asili: KuyrukSuresiDoldu',
      });
    }
    expect(sonuc.konamayanlar).toEqual(
      ertelenenler.map((d) => ({
        olayId: d.id,
        kuyruk: 'e-asili',
        hataSinifi: 'KuyrukSuresiDoldu',
      })),
    );
    expect(await acikAktariciZamanlayicisi()).toBe(0);
  }, 15_000);
});

describe('f) döngü', () => {
  it('başlatılınca bırakılan notlar çağrısız dinleyenin kuyruğuna ulaşır; durdurulunca bırakılan not ulaşmaz ve açık zamanlayıcı kalmaz', async ({
    annotate,
  }) => {
    // Bekleme aralığı kısaltılmaz: ürünün BOS_BEKLEME_MS değeri kullanılır.
    const defter = new AboneDefteri();
    defter.bildir('f-tuketici', 'f.olay');
    const aktarici = new OlayAktarici(uow, defter, kuyruk);
    const isleyici = await sinamaIsleyicisi('f-tuketici');
    try {
      aktarici.baslat();
      // Aktarım ve temizlik döngüleri birer zamanlayıcı kurmuştur.
      expect(aktariciZamanlayicilari.size).toBe(2);
      let sure: number;
      let ikinciSure: number;
      let kimlikler: string[];
      try {
        const baslangic = performance.now();
        kimlikler = await notBirak('f.olay', 3);
        await bekle(
          'işleyici üç işi alır',
          BOS_BEKLEME_MS * 3,
          () => isleyici.gelen.length === 3,
        );
        sure = performance.now() - baslangic;
        // Döngü boşta beklerken bırakılan not da bekleme bitince alınır.
        const ikinciBaslangic = performance.now();
        kimlikler.push(...(await notBirak('f.olay')));
        await bekle(
          'işleyici dördüncü işi alır',
          BOS_BEKLEME_MS * 3,
          () => isleyici.gelen.length === 4,
        );
        ikinciSure = performance.now() - ikinciBaslangic;
      } finally {
        await aktarici.durdur();
      }
      await annotate(
        `bırakılan üç notun işleyiciye ulaşması: ${sure.toFixed(0)} ms; boşta beklerken bırakılan notun: ${ikinciSure.toFixed(0)} ms (BOS_BEKLEME_MS ${String(BOS_BEKLEME_MS)} ms)`,
      );
      expect(isleyici.gelen.map((is) => is.kimlik).sort()).toEqual(
        [...kimlikler].sort(),
      );
      expect(await acikAktariciZamanlayicisi()).toBe(0);

      const [gec = ''] = await notBirak('f.olay');
      await uyu(BOS_BEKLEME_MS * 2);
      expect(await aktarilmislar()).not.toContain(gec);
      expect(await isKimlikleri('f-tuketici')).not.toContain(gec);
      expect(isleyici.gelen.map((is) => is.kimlik)).not.toContain(gec);
      expect(await acikAktariciZamanlayicisi()).toBe(0);
    } finally {
      await isleyici.kapat();
    }
  }, 15_000);
});

describe('g) temizlik', () => {
  it('aktarımı 4 gün önce olan silinir; 2 gün önce olan kalır; 10 gün önce oluşturulmuş ama aktarılmamış kalır', async () => {
    const aktarici = new OlayAktarici(uow, new AboneDefteri(), kuyruk);
    const [dortGun = '', ikiGun = '', aktarilmamis = ''] = await notBirak(
      'g.olay',
      3,
    );
    await gozlemci.query(
      `update outbox_olay set aktarim_zamani = clock_timestamp() - interval '4 days' where id = $1`,
      [dortGun],
    );
    await gozlemci.query(
      `update outbox_olay set aktarim_zamani = clock_timestamp() - interval '2 days' where id = $1`,
      [ikiGun],
    );
    await gozlemci.query(
      `update outbox_olay set olusturma_zamani = clock_timestamp() - interval '10 days' where id = $1`,
      [aktarilmamis],
    );

    expect(await aktarici.temizle()).toBe(1);

    const { rows } = await gozlemci.query<{ id: string }>(
      'select id from outbox_olay order by id',
    );
    expect(rows.map((satir) => satir.id)).toEqual(
      [ikiGun, aktarilmamis].sort(),
    );
  });
});

describe('h) ölçüler', () => {
  it('en eski denenmemiş notun yaşı ve denenmiş bekleyen sayısı; ertelenen not yaşı etkilemez, aktarılan not sayılmaz', async () => {
    const defter = new AboneDefteri();
    defter.bildir('h-tuketici', 'h.olay');
    const aktarici = new OlayAktarici(
      uow,
      defter,
      sinamaKuyrugu((ad) =>
        ad === 'h-tuketici'
          ? Promise.reject(new Error('kuyruk erişilemez'))
          : undefined,
      ),
    );
    expect(await aktarici.olculer()).toEqual({
      enEskiDenenmemisYasSn: null,
      denenmisBekleyenSayisi: 0,
    });

    // 1 saat önceki not konamaz ve ertelenir; 2 saat önceki notun dinleyeni yoktur, aktarılır.
    const [ertelenen = ''] = await notBirak('h.olay');
    const [aktarilan = ''] = await notBirak('h.dinleyensiz');
    await gozlemci.query(
      `update outbox_olay set olusturma_zamani = clock_timestamp() - interval '1 hour' where id = $1`,
      [ertelenen],
    );
    await gozlemci.query(
      `update outbox_olay set olusturma_zamani = clock_timestamp() - interval '2 hours' where id = $1`,
      [aktarilan],
    );
    expect(await aktarici.gecis()).toMatchObject({ aktarilan: 1, kalan: 1 });
    // Denenmemiş iki not: 10 ve 5 dakika önce.
    const [onDakika = '', besDakika = ''] = await notBirak('h.olay', 2);
    await gozlemci.query(
      `update outbox_olay set olusturma_zamani = clock_timestamp() - interval '10 minutes' where id = $1`,
      [onDakika],
    );
    await gozlemci.query(
      `update outbox_olay set olusturma_zamani = clock_timestamp() - interval '5 minutes' where id = $1`,
      [besDakika],
    );

    const olculer = await aktarici.olculer();
    expect(olculer.denenmisBekleyenSayisi).toBe(1);
    expect(olculer.enEskiDenenmemisYasSn).toBeGreaterThanOrEqual(600);
    expect(olculer.enEskiDenenmemisYasSn).toBeLessThan(660);
  });
});
