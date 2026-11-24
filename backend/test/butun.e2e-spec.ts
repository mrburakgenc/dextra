// Bağlama ve bütünün sınaması (GV-019). Koşturma:
//   pnpm -C backend test:e2e test/butun.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri ve kuyruk göçü uygulanmış asıl ve iz geçici veritabanlarıyla
// açılır. Gerçek feature yoktur: işi sınamanın kendisi yapar (run içinde yazma yüzeyiyle not
// bırakır); olayı dinleyen sınama tüketicileri abone defterine ve tüketici tabanına buradan
// kaydedilir. Hiçbir aktarım geçişi elle çağrılmaz; notları uygulamayla açılan döngüler taşır.
// Doğrulama sorguları uygulamanın dışındaki pg bağlantılarıyla (gözlemci) atılır.
import { randomUUIDv7 } from 'node:crypto';
import { setTimeout as uyu } from 'node:timers/promises';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { AboneDefteri } from '../src/shared/messaging/olay/abone-defteri.js';
import {
  BOS_BEKLEME_MS,
  HATA_TABAN_BEKLEME_MS,
  OlayAktarici,
} from '../src/shared/messaging/olay/olay-aktarici.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../src/shared/messaging/outbox/outbox-yazici.js';
import {
  type Zarf,
  tuketiciBaslat,
} from '../src/shared/messaging/tuketici/tuketici-tabani.js';
import {
  IzAktarici,
  PARTI_HATASI_TABAN_BEKLEME_MS,
  PartiHatasi,
} from '../src/shared/observability/iz/iz-aktarici.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

// Bir olay ya da kayıt "gelmeyecek" denmeden önce beklenen süre: aktarıcıların boşta bekleme
// aralığının (BOS_BEKLEME_MS, 1 sn) üç katı; bu sürede iki döngü en az iki kez daha okur.
const GELMEME_BEKLEMESI_MS = 3 * BOS_BEKLEME_MS;

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

// Ölçülen süreler koşu çıktısında görünsün diye yazılır.
function olcuYaz(ne: string, ms: number): void {
  process.stdout.write(`[ölçü] ${ne}: ${ms.toFixed(0)} ms\n`);
}

// Süreçte bekleyen zamanlayıcı sayısı.
function zamanlayiciSayisi(): number {
  return process
    .getActiveResourcesInfo()
    .filter((kaynak) => kaynak === 'Timeout').length;
}

// Verilen veritabanına gözlemcilerin dışında açık istemci bağlantısı sayısı.
async function baglantiSayisi(
  gozlemci: pg.Client,
  veritabani: string,
  gozlemciPidleri: readonly number[],
): Promise<number> {
  const { rows } = await gozlemci.query<{ sayi: number }>(
    `select count(*)::int as sayi from pg_stat_activity
      where datname = $1 and backend_type = 'client backend' and pid <> all($2::int[])`,
    [veritabani, gozlemciPidleri],
  );
  return rows[0]?.sayi ?? -1;
}

// Uygulama kapandıktan sonra iki geçici veritabanında da gözlemcilerin dışında bağlantı kalmaz.
async function baglantilarKapanir(
  gozlemci: pg.Client,
  databases: AppDatabases,
  gozlemciPidleri: readonly number[],
): Promise<void> {
  for (const { name } of [databases.asil, databases.iz]) {
    await bekle(
      `${name} veritabanında uygulama bağlantısı kalmaz`,
      5_000,
      async () => (await baglantiSayisi(gozlemci, name, gozlemciPidleri)) === 0,
    );
  }
}

async function pid(istemci: pg.Client): Promise<number> {
  const { rows } = await istemci.query<{ pid: number }>(
    'select pg_backend_pid() as pid',
  );
  return rows[0]?.pid ?? -1;
}

// Silinen veritabanlarından sunucuda kalanlar.
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

function degisiklikNotu(): DegisiklikKaydiNotu {
  return {
    istek_id: randomUUIDv7(),
    kullanici_id: randomUUIDv7(),
    uyelik_id: null,
    yetenek_id: randomUUIDv7(),
    is_adi: 'butun.sinama',
    baslatan_kullanici_id: null,
    veri_sahibi_kullanici_id: randomUUIDv7(),
    kaynak: 'sinama_kaydi',
    kayit_id: randomUUIDv7(),
    eylem: 'guncelleme',
    degisen: { ad: { eski: 'Eski', yeni: 'Yeni' } },
  };
}

describe('uygulama göçleri uygulanmış veritabanlarıyla', () => {
  let databases: AppDatabases;
  let app: INestApplication;
  let acik = false;
  let asilSql: pg.Client;
  let izSql: pg.Client;
  let gozlemciPidleri: number[];
  let oncekiZamanlayicilar: number;
  let uow: UnitOfWork;
  let yazici: OutboxYazici;
  let defter: AboneDefteri;
  let kuyruk: IsKuyrugu;

  // Sınama tüketicisi: abone defterine bildirilir, tüketici tabanıyla başlatılır; gelen zarfları
  // ve geliş anlarını biriktirir. Dinleyicisini uygulamanın kapanışı kapatır.
  async function tuketiciKaydet(
    tuketici: string,
    olay: string,
  ): Promise<{ zarf: Zarf; an: number }[]> {
    const gelen: { zarf: Zarf; an: number }[] = [];
    defter.bildir(tuketici, olay);
    await tuketiciBaslat(uow, kuyruk, tuketici, (zarf) => {
      gelen.push({ zarf, an: performance.now() });
      return Promise.resolve();
    });
    return gelen;
  }

  async function izdeVarMi(id: string): Promise<boolean> {
    const { rowCount } = await izSql.query(
      'select 1 from degisiklik_kaydi where id = $1',
      [id],
    );
    return rowCount === 1;
  }

  async function aktarildiMi(tablo: string, id: string): Promise<boolean> {
    const { rows } = await asilSql.query<{ aktarildi: boolean }>(
      `select aktarim_zamani is not null as aktarildi from ${tablo} where id = $1`,
      [id],
    );
    return rows[0]?.aktarildi === true;
  }

  async function islenenDurumu(
    tuketici: string,
    olayId: string,
  ): Promise<string | undefined> {
    const { rows } = await asilSql.query<{ durum: string }>(
      'select durum from islenen_olay where tuketici = $1 and olay_id = $2',
      [tuketici, olayId],
    );
    return rows[0]?.durum;
  }

  beforeAll(async () => {
    databases = await createAppDatabases({ migrations: true });
    // Kurulum yarıda kalırsa geçici veritabanları sunucuda kalmaz.
    try {
      await kuyrukGocunuKos(databases.asil.url);
      asilSql = new pg.Client({ connectionString: databases.asil.url });
      izSql = new pg.Client({ connectionString: databases.iz.url });
      await asilSql.connect();
      await izSql.connect();
      gozlemciPidleri = [await pid(asilSql), await pid(izSql)];
    } catch (error) {
      await databases.drop();
      throw error;
    }
  });

  afterAll(async () => {
    if (acik) {
      await app.close();
    }
    await asilSql.end();
    await izSql.end();
    await databases.drop();
    expect(
      await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
    ).toEqual([]);
  });

  // Uygulama bir testin içinde açılır: Vitest koşan test için bir zamanlayıcı tutar, beforeAll'da
  // tutmaz; kapanıştan sonraki sayı aynı bağlamda (test içinde, uygulama yokken) alınan tabanla
  // karşılaştırılır.
  it('uygulama açılınca iki aktarıcının aktarım ve temizlik döngüleri başlar', async () => {
    oncekiZamanlayicilar = zamanlayiciSayisi();
    const modul = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    acik = true;
    uow = app.get(UnitOfWork);
    yazici = app.get(OutboxYazici);
    defter = app.get(AboneDefteri);
    kuyruk = app.get<IsKuyrugu>(IS_KUYRUGU);

    // Her döngü başlarken ilk adımını zamanlayıcıyla planlar: dört döngü, dört zamanlayıcı.
    expect(zamanlayiciSayisi()).toBeGreaterThanOrEqual(
      oncekiZamanlayicilar + 4,
    );
  });

  it('a) run içinde bırakılan değişiklik kaydı notu iz veritabanında aynı kimlik ve alanlarla görünür; outbox_iz satırının aktarim_zamani dolar', async () => {
    const not = degisiklikNotu();
    const baslangic = performance.now();
    await uow.run((islem) => yazici.degisiklikKaydi(islem, not));

    const { rows: notlar } = await asilSql.query<{
      id: string;
      olusturma_zamani: string;
    }>(
      `select id, to_jsonb(olusturma_zamani) #>> '{}' as olusturma_zamani
         from outbox_iz where govde ->> 'kayit_id' = $1`,
      [not.kayit_id],
    );
    expect(notlar).toHaveLength(1);
    const outbox = notlar[0];
    if (outbox === undefined) {
      throw new Error('outbox_iz notu yok');
    }

    await bekle('iz kaydı görünür', 10_000, () => izdeVarMi(outbox.id));
    olcuYaz(
      'a) not bırakılmasından iz kaydının görünmesine',
      performance.now() - baslangic,
    );

    const { rows: kayitlar } = await izSql.query(
      `select id, istek_id, kullanici_id, uyelik_id, yetenek_id, is_adi, baslatan_kullanici_id,
              veri_sahibi_kullanici_id, kaynak, kayit_id, eylem, degisen,
              to_jsonb(olusma_zamani) #>> '{}' as olusma_zamani
         from degisiklik_kaydi where id = $1`,
      [outbox.id],
    );
    expect(kayitlar).toEqual([
      { ...not, id: outbox.id, olusma_zamani: outbox.olusturma_zamani },
    ]);
    await bekle('outbox_iz aktarim_zamani dolar', 5_000, () =>
      aktarildiMi('outbox_iz', outbox.id),
    );
  });

  it('b) run içinde bırakılan olay notu sınama tüketicisinin işleyicisine zarfıyla bir kez ulaşır; islenen_olay tamamlandi, outbox_olay aktarim_zamani dolar', async () => {
    const gelen = await tuketiciKaydet('butun-b-tuketici', 'butun.b.oldu');
    const korelasyon = randomUUIDv7();
    const kayitId = randomUUIDv7();
    const baslangic = performance.now();
    const id = await uow.run((islem) =>
      yazici.olay(islem, {
        ad: 'butun.b.oldu',
        surum: 1,
        veri: { kayit_id: kayitId },
        korelasyon_id: korelasyon,
      }),
    );

    await bekle('işleyici çağrılır', 10_000, () => gelen.length > 0);
    olcuYaz(
      'b) not bırakılmasından işleyici çağrısına',
      (gelen[0]?.an ?? Number.NaN) - baslangic,
    );
    await bekle(
      'islenen_olay tamamlandi',
      5_000,
      async () =>
        (await islenenDurumu('butun-b-tuketici', id)) === 'tamamlandi',
    );
    await bekle('outbox_olay aktarim_zamani dolar', 5_000, () =>
      aktarildiMi('outbox_olay', id),
    );
    // Bir kez: aktarıcı en az iki tur daha okur; aynı olay yeniden gelmez.
    await uyu(GELMEME_BEKLEMESI_MS);

    expect(gelen.map((g) => g.zarf)).toEqual([
      {
        id,
        ad: 'butun.b.oldu',
        surum: 1,
        govde: { veri: { kayit_id: kayitId }, korelasyon_id: korelasyon },
      },
    ]);
  });

  it(`c) notları bıraktıktan sonra hata atan işin notları iz veritabanına ve işleyiciye ulaşmaz (${String(GELMEME_BEKLEMESI_MS)} ms beklenir; aynı yoldan onaylanan iş ulaşır)`, async () => {
    const gelen = await tuketiciKaydet('butun-c-tuketici', 'butun.c.oldu');
    const geriAlinan = degisiklikNotu();
    await expect(
      uow.run(async (islem) => {
        await yazici.degisiklikKaydi(islem, geriAlinan);
        await yazici.olay(islem, {
          ad: 'butun.c.oldu',
          surum: 1,
          veri: { kayit_id: geriAlinan.kayit_id },
          korelasyon_id: randomUUIDv7(),
        });
        throw new Error('iş hata verdi');
      }),
    ).rejects.toThrow('iş hata verdi');
    const baslangic = performance.now();

    // Denetim: aynı yoldan onaylanan iş ulaşır; yol bu süre içinde çalışıyordur.
    const onaylanan = degisiklikNotu();
    const onaylananOlay = await uow.run(async (islem) => {
      await yazici.degisiklikKaydi(islem, onaylanan);
      return yazici.olay(islem, {
        ad: 'butun.c.oldu',
        surum: 1,
        veri: { kayit_id: onaylanan.kayit_id },
        korelasyon_id: randomUUIDv7(),
      });
    });
    await bekle('onaylanan olay işleyiciye ulaşır', 10_000, () =>
      gelen.some((g) => g.zarf.id === onaylananOlay),
    );
    await bekle('onaylanan kayıt iz veritabanına ulaşır', 10_000, async () => {
      const { rowCount } = await izSql.query(
        'select 1 from degisiklik_kaydi where kayit_id = $1',
        [onaylanan.kayit_id],
      );
      return rowCount === 1;
    });
    await uyu(
      Math.max(0, GELMEME_BEKLEMESI_MS - (performance.now() - baslangic)),
    );

    expect(gelen.map((g) => g.zarf.id)).toEqual([onaylananOlay]);
    const izde = await izSql.query(
      'select 1 from degisiklik_kaydi where kayit_id = $1',
      [geriAlinan.kayit_id],
    );
    expect(izde.rowCount).toBe(0);
    const outboxta = await asilSql.query(
      `select 1 from outbox_iz where govde ->> 'kayit_id' = $1
       union all
       select 1 from outbox_olay where govde -> 'veri' ->> 'kayit_id' = $1`,
      [geriAlinan.kayit_id],
    );
    expect(outboxta.rowCount).toBe(0);
  });

  it('d) aynı olayı dinleyen iki sınama tüketicisinin ikisi de olayı birer kez işler', async () => {
    const birinci = await tuketiciKaydet('butun-d-birinci', 'butun.d.oldu');
    const ikinci = await tuketiciKaydet('butun-d-ikinci', 'butun.d.oldu');
    const id = await uow.run((islem) =>
      yazici.olay(islem, {
        ad: 'butun.d.oldu',
        surum: 1,
        veri: { kayit_id: randomUUIDv7() },
        korelasyon_id: randomUUIDv7(),
      }),
    );

    await bekle(
      'iki tüketicide de tamamlandi',
      10_000,
      async () =>
        (await islenenDurumu('butun-d-birinci', id)) === 'tamamlandi' &&
        (await islenenDurumu('butun-d-ikinci', id)) === 'tamamlandi',
    );
    await uyu(GELMEME_BEKLEMESI_MS);

    expect(birinci.map((g) => g.zarf.id)).toEqual([id]);
    expect(ikinci.map((g) => g.zarf.id)).toEqual([id]);
  });

  it('e) uygulama kapanınca iki geçici veritabanına uygulamanın bağlantısı ve süreçte uygulamanın zamanlayıcısı kalmaz', async () => {
    // Ölçüm boş değildir: açıkken uygulamanın bağlantıları ve döngü zamanlayıcıları vardır.
    expect(
      await baglantiSayisi(asilSql, databases.asil.name, gozlemciPidleri),
    ).toBeGreaterThan(0);
    expect(
      await baglantiSayisi(asilSql, databases.iz.name, gozlemciPidleri),
    ).toBeGreaterThan(0);
    expect(zamanlayiciSayisi()).toBeGreaterThan(oncekiZamanlayicilar);

    await app.close();
    acik = false;

    await baglantilarKapanir(asilSql, databases, gozlemciPidleri);
    expect(zamanlayiciSayisi()).toBeLessThanOrEqual(oncekiZamanlayicilar);
  });
});

describe('f) göçleri uygulanmamış veritabanlarıyla açılış', () => {
  it('sağlık ucu 200 döner, iki aktarıcının döngüsü hatayı alıp artan aralıkla bekler, uygulama temiz kapanır', async () => {
    const databases = await createAppDatabases({ migrations: false });
    const gozlemci = new pg.Client({ connectionString: databases.asil.url });
    try {
      await gozlemci.connect();
      const gozlemciPidleri = [await pid(gozlemci)];
      const oncekiZamanlayicilar = zamanlayiciSayisi();
      const modul = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      // Geçişler elle çağrılmaz; yalnız döngünün çağırdığı anlar kaydedilir.
      const izAktarici = modul.get(IzAktarici);
      const izGecisi = izAktarici.gecis.bind(izAktarici);
      const izAnlari: number[] = [];
      const izCasusu = vi.spyOn(izAktarici, 'gecis').mockImplementation(() => {
        izAnlari.push(performance.now());
        return izGecisi();
      });
      const olayAktarici = modul.get(OlayAktarici);
      const olayGecisi = olayAktarici.gecis.bind(olayAktarici);
      const olayAnlari: number[] = [];
      const olayCasusu = vi
        .spyOn(olayAktarici, 'gecis')
        .mockImplementation(() => {
          olayAnlari.push(performance.now());
          return olayGecisi();
        });

      const app: INestApplication<App> = modul.createNestApplication();
      await app.init();
      try {
        const ilk = await request(app.getHttpServer()).get('/health');
        expect(ilk.status).toBe(200);

        await bekle(
          'iki döngü üçer kez dener',
          10_000,
          () => izAnlari.length >= 3 && olayAnlari.length >= 3,
        );
        // İlk iki deneme tablo olmadığı için hata verdi.
        expect(
          izCasusu.mock.settledResults.slice(0, 2).map((s) => s.type),
        ).toEqual(['rejected', 'rejected']);
        expect(izCasusu.mock.settledResults[0]?.value).toBeInstanceOf(
          PartiHatasi,
        );
        expect(
          olayCasusu.mock.settledResults.slice(0, 2).map((s) => s.type),
        ).toEqual(['rejected', 'rejected']);
        // Aralık artar: taban, sonra iki katı (zamanlayıcı erken ateşlenmez; 5 ms pay).
        for (const [ad, anlar, taban] of [
          ['iz', izAnlari, PARTI_HATASI_TABAN_BEKLEME_MS],
          ['olay', olayAnlari, HATA_TABAN_BEKLEME_MS],
        ] as const) {
          const [a0 = 0, a1 = 0, a2 = 0] = anlar;
          olcuYaz(`f) ${ad} aktarıcısı, ilk hatadan sonraki aralık`, a1 - a0);
          olcuYaz(
            `f) ${ad} aktarıcısı, ikinci hatadan sonraki aralık`,
            a2 - a1,
          );
          expect(a1 - a0).toBeGreaterThanOrEqual(taban - 5);
          expect(a2 - a1).toBeGreaterThanOrEqual(2 * taban - 5);
        }

        const sonra = await request(app.getHttpServer()).get('/health');
        expect(sonra.status).toBe(200);
        expect(sonra.body).toEqual({ status: 'ok' });
      } finally {
        await app.close();
      }

      await baglantilarKapanir(gozlemci, databases, gozlemciPidleri);
      expect(zamanlayiciSayisi()).toBeLessThanOrEqual(oncekiZamanlayicilar);
    } finally {
      await gozlemci.end();
      await databases.drop();
    }
    expect(
      await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
    ).toEqual([]);
  });
});
