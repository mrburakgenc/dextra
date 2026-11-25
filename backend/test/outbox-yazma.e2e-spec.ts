// Outbox yazma yüzeyi, göçleri uygulanmış geçici bir veritabanında, uygulamanın modülleriyle
// kurulmuş Unit of Work üzerinden sınanır; notlar ayrı bir bağlantıdan okunur.
import { randomUUIDv7 } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { z } from 'zod';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { PRISMA_CLIENT } from '../src/shared/database/domain/istemci-belirtecleri.js';
import type { Islem } from '../src/shared/database/domain/islem.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import { MessagingModule } from '../src/shared/messaging/messaging.module.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../src/shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

interface OlaySatiri {
  id: string;
  ad: string;
  surum: number;
  govde: Record<string, unknown>;
  olusturma_zamani: Date | null;
  aktarim_zamani: Date | null;
}

interface IzSatiri {
  id: string;
  surum: number;
  govde: Record<string, unknown>;
  deneme_sayisi: number;
  aktarim_zamani: Date | null;
}

let db: TestDatabase;
let prisma: PrismaClient;
let moduleRef: TestingModule;
let gozlemci: pg.Client;
let uow: UnitOfWork;
let yazici: OutboxYazici;

function degisiklikKaydi(): DegisiklikKaydiNotu {
  return {
    istek_id: randomUUIDv7(),
    kullanici_id: randomUUIDv7(),
    uyelik_id: null,
    yetenek_id: randomUUIDv7(),
    is_adi: 'kullanici.guncelle',
    baslatan_kullanici_id: null,
    veri_sahibi_kullanici_id: randomUUIDv7(),
    kaynak: 'Kullanici',
    kayit_id: randomUUIDv7(),
    eylem: 'guncelleme',
    degisen: { ad: { eski: 'Ayşe', yeni: 'Ayşe Nur' } },
  };
}

async function olaySatirlari(): Promise<OlaySatiri[]> {
  return (
    await gozlemci.query<OlaySatiri>(
      'select id, ad, surum, govde, olusturma_zamani, aktarim_zamani from outbox_olay',
    )
  ).rows;
}

async function izSatirlari(): Promise<IzSatiri[]> {
  return (
    await gozlemci.query<IzSatiri>(
      'select id, surum, govde, deneme_sayisi, aktarim_zamani from outbox_iz',
    )
  ).rows;
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });
  // Outbox repository'sini Unit of Work'e MessagingModule'ün kendi kaydı tanıtır.
  moduleRef = await Test.createTestingModule({ imports: [MessagingModule] })
    .overrideProvider(PRISMA_CLIENT)
    .useValue(prisma)
    .compile();
  uow = moduleRef.get(UnitOfWork);
  yazici = moduleRef.get(OutboxYazici);
  gozlemci = new pg.Client({ connectionString: db.url });
  await gozlemci.connect();
});

afterAll(async () => {
  await gozlemci.end();
  // Modülün kapanışı asıl istemciyi (burada test veritabanınınkini) kapatır.
  await moduleRef.close();
  await db.drop();
});

beforeEach(async () => {
  await gozlemci.query('truncate outbox_olay, outbox_iz');
});

describe('olay notu', () => {
  it('a) run içinde bırakılan not onaydan sonra görünür; kimlik, ad ve sürüm kolonlardadır, gövdede yinelenmez', async () => {
    const korelasyon = randomUUIDv7();
    const neden = randomUUIDv7();
    const baslatan = randomUUIDv7();

    const id = await uow.run((islem) =>
      yazici.olay(islem, {
        ad: 'kullanici.olusturuldu',
        surum: 2,
        veri: { kullanici_id: 'k1', etiketler: ['a', 'b'] },
        korelasyon_id: korelasyon,
        neden_olay_id: neden,
        baslatan_kullanici_id: baslatan,
      }),
    );

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const satirlar = await olaySatirlari();
    expect(satirlar).toHaveLength(1);
    const [satir] = satirlar;
    expect(satir?.id).toBe(id);
    expect(satir?.ad).toBe('kullanici.olusturuldu');
    expect(satir?.surum).toBe(2);
    expect(satir?.govde).toStrictEqual({
      veri: { kullanici_id: 'k1', etiketler: ['a', 'b'] },
      korelasyon_id: korelasyon,
      neden_olay_id: neden,
      baslatan_kullanici_id: baslatan,
    });
    expect(satir?.olusturma_zamani).toBeInstanceOf(Date);
    expect(satir?.aktarim_zamani).toBeNull();
  });

  it('a) verilmeyen zincir alanı gövdede yer almaz', async () => {
    const korelasyon = randomUUIDv7();

    await uow.run((islem) =>
      yazici.olay(islem, {
        ad: 'kullanici.olusturuldu',
        surum: 1,
        veri: {},
        korelasyon_id: korelasyon,
      }),
    );

    const [satir] = await olaySatirlari();
    expect(Object.keys(satir?.govde ?? {}).sort()).toEqual([
      'korelasyon_id',
      'veri',
    ]);
  });

  it('g) çağıranın verdiği fazladan anahtarlar (bir id dahil) gövdeye girmez; satırın kimliği yazma yüzeyinindir', async () => {
    const korelasyon = randomUUIDv7();
    const verilenId = randomUUIDv7();
    // Değişkenden verilir: tipte olmayan anahtarlar böylece derleyiciden geçer.
    const not = {
      ad: 'kullanici.olusturuldu',
      surum: 1,
      veri: { kullanici_id: 'k1' },
      korelasyon_id: korelasyon,
      id: verilenId,
      fazla: 'x',
      aktarim_zamani: '2026-01-01T00:00:00Z',
    };

    const id = await uow.run((islem) => yazici.olay(islem, not));

    const [satir] = await olaySatirlari();
    expect(id).not.toBe(verilenId);
    expect(satir?.id).toBe(id);
    expect(satir?.aktarim_zamani).toBeNull();
    expect(satir?.govde).toStrictEqual({
      veri: { kullanici_id: 'k1' },
      korelasyon_id: korelasyon,
    });
  });
});

describe('değişiklik kaydı notu', () => {
  it('b) run içinde bırakılan not görünür; sürüm 1, gövde verilenle birebir aynı, deneme sayısı 0', async () => {
    const kayit = degisiklikKaydi();

    await uow.run((islem) => yazici.degisiklikKaydi(islem, kayit));

    const satirlar = await izSatirlari();
    expect(satirlar).toHaveLength(1);
    const [satir] = satirlar;
    expect(satir?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(satir?.surum).toBe(1);
    expect(satir?.govde).toStrictEqual(kayit);
    expect(satir?.deneme_sayisi).toBe(0);
    expect(satir?.aktarim_zamani).toBeNull();
  });

  // Katı şema: her biri ayrı hata atar ve outbox_iz boş kalır.
  const gecersizler: [string, () => unknown][] = [
    ['bilinmeyen alan', () => ({ ...degisiklikKaydi(), fazla: 'x' })],
    [
      'zorunlu alan eksik',
      () => {
        const eksik: Partial<DegisiklikKaydiNotu> = degisiklikKaydi();
        delete eksik.kullanici_id;
        return eksik;
      },
    ],
    ['geçersiz eylem', () => ({ ...degisiklikKaydi(), eylem: 'yamama' })],
  ];

  it.each(gecersizler)(
    'd) %s hata atar ve satır yazılmaz',
    async (_ad, uret) => {
      const sonuc = uow.run((islem) =>
        yazici.degisiklikKaydi(islem, uret() as DegisiklikKaydiNotu),
      );

      await expect(sonuc).rejects.toBeInstanceOf(z.ZodError);
      expect(await izSatirlari()).toEqual([]);
    },
  );
});

describe('kapı', () => {
  it('c) notları bıraktıktan sonra hata atan işte iki tabloda da satır kalmaz', async () => {
    const hata = new Error('iş bozuldu');

    const sonuc = uow.run(async (islem) => {
      await yazici.olay(islem, {
        ad: 'kullanici.olusturuldu',
        surum: 1,
        veri: {},
        korelasyon_id: randomUUIDv7(),
      });
      await yazici.degisiklikKaydi(islem, degisiklikKaydi());
      throw hata;
    });

    await expect(sonuc).rejects.toBe(hata);
    expect(await olaySatirlari()).toEqual([]);
    expect(await izSatirlari()).toEqual([]);
  });

  it('e) kapanmış işlem nesnesiyle yapılan yazma hata atar', async () => {
    let disari: Islem | undefined;
    await uow.run((islem) => {
      disari = islem;
      return Promise.resolve();
    });
    if (disari === undefined) throw new Error('işlem nesnesi alınamadı');
    const kapali = disari;

    await expect(
      yazici.olay(kapali, {
        ad: 'kullanici.olusturuldu',
        surum: 1,
        veri: {},
        korelasyon_id: randomUUIDv7(),
      }),
    ).rejects.toThrow('İşlem kapandı');
    await expect(
      yazici.degisiklikKaydi(kapali, degisiklikKaydi()),
    ).rejects.toThrow('İşlem kapandı');
    expect(await olaySatirlari()).toEqual([]);
    expect(await izSatirlari()).toEqual([]);
  });
});
