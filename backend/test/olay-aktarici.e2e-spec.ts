// Abone defteri ve olay aktarıcısının tek geçişi (GV-016). Koşturma:
//   pnpm -C backend test:e2e test/olay-aktarici.e2e-spec.ts --reporter=verbose
// Asıl şemanın göçleri ve kuyruk göçü uygulanmış geçici bir veritabanında koşar. Notlar yazma
// yüzeyiyle run içinde bırakılır; kuyruğa yalnız kapısından (IS_KUYRUGU) ulaşılır, doğrulama
// sorguları pg ile atılır.
import { randomUUIDv7 } from 'node:crypto';
import { setTimeout as uyu } from 'node:timers/promises';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/registrar.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
  type KuyrukIsi,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { KuyrukModule } from '../src/shared/messaging/kuyruk/kuyruk.module.js';
import { AboneDefteri } from '../src/shared/messaging/olay/abone-defteri.js';
import { OlayAktarici } from '../src/shared/messaging/olay/olay-aktarici.js';
import { outboxOlayRepoKaydet } from '../src/shared/messaging/olay/outbox-olay.repository.js';
import {
  OUTBOX_REPO,
  outboxRepo,
} from '../src/shared/messaging/outbox/outbox-repo.js';
import { OutboxYazici } from '../src/shared/messaging/outbox/outbox-yazici.js';
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
async function notBirak(ad: string, kac = 1): Promise<string[]> {
  return uow.run(async (islem) => {
    const kimlikler: string[] = [];
    for (let i = 0; i < kac; i += 1) {
      kimlikler.push(
        await yazici.olay(islem, {
          ad,
          surum: 1,
          veri: { sira: i },
          korelasyon_id: randomUUIDv7(),
        }),
      );
    }
    return kimlikler;
  });
}

async function govdesi(id: string): Promise<Record<string, unknown>> {
  const { rows } = await gozlemci.query<{ govde: Record<string, unknown> }>(
    'select govde from outbox_olay where id = $1',
    [id],
  );
  return rows[0]?.govde ?? {};
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
  await bekle('geçici veritabanında açık bağlantı kalmaz', 5_000, async () => {
    const { rows } = await gozlemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = $1 and backend_type = 'client backend' and pid <> pg_backend_pid()`,
      [db.name],
    );
    return rows[0]?.sayi === 0;
  });
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
});

beforeEach(async () => {
  await gozlemci.query('truncate outbox_olay');
});

describe('a) abone defteri', () => {
  it('a) bir olayı iki tüketici dinliyorsa ikisinin adını verir; dinleyeni olmayan olay için boş liste verir', () => {
    const defter = new AboneDefteri();
    defter.bildir('fatura-tuketicisi', 'siparis.verildi');
    defter.bildir('bildirim-tuketicisi', 'siparis.verildi');
    defter.bildir('rapor-tuketicisi', 'kullanici.olusturuldu');

    expect(defter.dinleyenler('siparis.verildi').sort()).toEqual([
      'bildirim-tuketicisi',
      'fatura-tuketicisi',
    ]);
    expect(defter.dinleyenler('kimse.dinlemiyor')).toEqual([]);
  });

  it('a) aynı tüketici adı ikinci kez bildirilirse hata atar', () => {
    const defter = new AboneDefteri();
    defter.bildir('fatura-tuketicisi', 'siparis.verildi');

    expect(() => {
      defter.bildir('fatura-tuketicisi', 'kullanici.olusturuldu');
    }).toThrow('fatura-tuketicisi tüketicisi zaten bildirildi');
    expect(defter.dinleyenler('kullanici.olusturuldu')).toEqual([]);
  });
});

describe('b-f) olay aktarıcısının tek geçişi', () => {
  it('b) iki tüketicinin dinlediği not için her iki kuyruğa kimliği olayın kimliği olan ve zarfı taşıyan birer iş konur; not işaretlenir', async () => {
    const defter = new AboneDefteri();
    defter.bildir('b-tuketici-1', 'b.olay');
    defter.bildir('b-tuketici-2', 'b.olay');
    const aktarici = new OlayAktarici(uow, defter, kuyruk);
    const [id = ''] = await notBirak('b.olay');
    const birinci = await sinamaIsleyicisi('b-tuketici-1');
    const ikinci = await sinamaIsleyicisi('b-tuketici-2');
    try {
      expect(await aktarici.gecis()).toEqual({ aktarilan: 1, kalan: 0 });
      await bekle(
        'iki işleyici işi alır',
        5_000,
        () => birinci.gelen.length === 1 && ikinci.gelen.length === 1,
      );
      // İkinci bir işleme olmadığını görmek için kısa süre daha beklenir.
      await uyu(500);

      const beklenen: KuyrukIsi = {
        kimlik: id,
        ad: 'b.olay',
        veri: { id, ad: 'b.olay', surum: 1, govde: await govdesi(id) },
      };
      expect(birinci.gelen).toEqual([beklenen]);
      expect(ikinci.gelen).toEqual([beklenen]);
      expect(await aktarilmislar()).toEqual([id]);
    } finally {
      await birinci.kapat();
      await ikinci.kapat();
    }
  }, 15_000);

  it('c) dinleyeni olmayan olay için hiçbir kuyruğa iş konmaz ve not işaretlenir', async () => {
    const defter = new AboneDefteri();
    defter.bildir('c-tuketici', 'c.baska-olay');
    const aktarici = new OlayAktarici(uow, defter, kuyruk);
    const [id = ''] = await notBirak('c.olay');

    expect(await aktarici.gecis()).toEqual({ aktarilan: 1, kalan: 0 });

    const { rows } = await gozlemci.query<{ sayi: number }>(
      'select count(*)::int as sayi from kuyruk.job where id = $1',
      [id],
    );
    expect(rows[0]?.sayi).toBe(0);
    expect(await isKimlikleri('c-tuketici')).toEqual([]);
    expect(await aktarilmislar()).toEqual([id]);
  });

  it('d) bir kuyruğa iş konamazsa not işaretlenmez, öbür not işaretlenir, geçiş kalanı döner; engel kalkınca not işaretlenir ve ilk kuyrukta iş ikilenmez', async () => {
    const defter = new AboneDefteri();
    defter.bildir('d-tuketici-1', 'd.olay');
    defter.bildir('d-tuketici-2', 'd.olay');
    defter.bildir('d-tuketici-3', 'd.diger-olay');
    // Kuyruk kapısının yerine geçen sınama gerçeklemesi: engel varken yalnız d-tuketici-2'ye
    // konan iş hata atar; öbür her şey gerçek kapıya gider.
    let engel = true;
    const sinamaKuyrugu: IsKuyrugu = {
      koy: (ad, is) =>
        engel && ad === 'd-tuketici-2'
          ? Promise.reject(new Error('kuyruk erişilemez'))
          : kuyruk.koy(ad, is),
      dinle: (ad, isleyici) => kuyruk.dinle(ad, isleyici),
      basarisizSayisi: (ad) => kuyruk.basarisizSayisi(ad),
    };
    const aktarici = new OlayAktarici(uow, defter, sinamaKuyrugu);
    const [takilan = ''] = await notBirak('d.olay');
    const [oteki = ''] = await notBirak('d.diger-olay');

    expect(await aktarici.gecis()).toEqual({ aktarilan: 1, kalan: 1 });
    expect(await aktarilmislar()).toEqual([oteki]);
    expect(await isKimlikleri('d-tuketici-1')).toEqual([takilan]);
    expect(await isKimlikleri('d-tuketici-2')).toEqual([]);
    expect(await isKimlikleri('d-tuketici-3')).toEqual([oteki]);

    engel = false;
    expect(await aktarici.gecis()).toEqual({ aktarilan: 1, kalan: 0 });
    expect((await aktarilmislar()).sort()).toEqual([takilan, oteki].sort());
    // İlk kuyrukta önceki geçişin işi duruyordu; aynı kimlikli ikinci iş üretilmedi.
    expect(await isKimlikleri('d-tuketici-1')).toEqual([takilan]);
    expect(await isKimlikleri('d-tuketici-2')).toEqual([takilan]);

    const birinci = await sinamaIsleyicisi('d-tuketici-1');
    try {
      await bekle('işleyici işi alır', 5_000, () => birinci.gelen.length === 1);
      await uyu(500);
      expect(birinci.gelen.map((is) => is.kimlik)).toEqual([takilan]);
    } finally {
      await birinci.kapat();
    }
  }, 15_000);

  it('e) 200 not varken aynı anda başlatılan iki geçiş, not kalmayana kadar yinelenince her notu işaretler ve her olay için tek dinleyenin kuyruğuna tam bir iş koyar', async ({
    annotate,
  }) => {
    const defter = new AboneDefteri();
    defter.bildir('e-tuketici', 'e.olay');
    const aktarici = new OlayAktarici(uow, defter, kuyruk);
    const kimlikler = await notBirak('e.olay', 200);
    const isleyici = await sinamaIsleyicisi('e-tuketici');
    try {
      const baslangic = Date.now();
      let tur = 0;
      let toplam = 0;
      for (;;) {
        tur += 1;
        const sonuclar = await Promise.all([
          aktarici.gecis(),
          aktarici.gecis(),
        ]);
        expect(sonuclar.map((sonuc) => sonuc.kalan)).toEqual([0, 0]);
        const bu = sonuclar.reduce((t, sonuc) => t + sonuc.aktarilan, 0);
        if (bu === 0) break;
        toplam += bu;
      }
      const gecisSuresi = Date.now() - baslangic;
      await bekle(
        'işleyici 200 işi alır',
        30_000,
        () => isleyici.gelen.length >= 200,
      );
      await annotate(
        `geçişler ${String(gecisSuresi)} ms (${String(tur)} tur); işleyicinin 200 işi alması toplam ${String(Date.now() - baslangic)} ms`,
      );
      await uyu(500);

      expect(toplam).toBe(200);
      expect((await aktarilmislar()).sort()).toEqual([...kimlikler].sort());
      const gorulen = isleyici.gelen.map((is) => is.kimlik);
      expect(gorulen).toHaveLength(200);
      expect(new Set(gorulen)).toEqual(new Set(kimlikler));
    } finally {
      await isleyici.kapat();
    }
  }, 60_000);

  it('f) aktarılmış notlar ikinci geçişte yeniden alınmaz; geçiş 0 döner', async () => {
    const defter = new AboneDefteri();
    defter.bildir('f-tuketici', 'f.olay');
    const aktarici = new OlayAktarici(uow, defter, kuyruk);
    const [id = ''] = await notBirak('f.olay');

    expect(await aktarici.gecis()).toEqual({ aktarilan: 1, kalan: 0 });
    expect(await aktarici.gecis()).toEqual({ aktarilan: 0, kalan: 0 });
    expect(await isKimlikleri('f-tuketici')).toEqual([id]);
  });
});
