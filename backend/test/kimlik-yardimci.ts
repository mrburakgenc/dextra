// Kimlik yönetim testlerinin ortak kurulumu (GV-054; ürün kodu değil). Uygulamayı AppModule ve
// testin verdiği sınama uçlarıyla, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açar.
// Başlangıç gerçek yoldan kurulur: tohum koşucusu ilk kurulum göçünü uygular, kurulum komutunun işi
// superadmin için bağlantı üretir, parola o bağlantıyla uçtan belirlenir ve superadmin uçtan girer.
// Ek kullanıcılar SQL ile açılır: kullanıcı satırı, (Kök, Temel) üyeliği (TS-002 değişmez 5) ve
// parola sırrı yazılır, sonra kişi uçtan girer. Bütün istekler aynı adres ve tarayıcı bilgisiyle,
// aracı katmanın yaptığı gibi imzalanarak gider; oturum denetimi adres uymayınca oturumu kapatır.
import { randomUUID } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { KurulumBaglantisiHandler } from '../src/features/kimlik/parola/application/kurulum-baglantisi.handler.js';
import { ParolaOzetleyici } from '../src/features/kimlik/parola/domain/parola-ozetleyici.port.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import { TohumKosucusu } from '../src/shared/tohum/tohum-kosucusu.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

// Yardımcının açtığı her kişinin parolası; parola kuralını geçen uzun bir cümle.
const PAROLA = 'yardimcinin uzun ve dogru parola cümlesi';
const IP = '203.0.113.54';
const TARAYICI = 'Mozilla/5.0 kimlik yardimci';

export interface Oturumlu {
  readonly id: string;
  readonly erisimBelirteci: string;
}

export interface KimlikOrtami {
  readonly app: INestApplication<App>;
  // Asıl geçici veritabanına doğrudan bağlantı (satır hazırlamak ve okumak için).
  readonly db: pg.Client;
  // Açılan geçici veritabanlarının adları (asıl, iz).
  readonly veritabanlari: readonly string[];
  // İlk yönetici (tohumun yazdığı superadmin) ve onun açık oturumunun erişim belirteci.
  readonly superadmin: Oturumlu;
  // Oturumlu istek için Authorization ve imzalı istemci adresi başlıkları.
  basliklar(erisimBelirteci: string): Record<string, string>;
  // SQL ile kullanıcı açar, parola verir ve uçtan oturum açtırır.
  kullaniciAc(kullaniciAdi: string): Promise<Oturumlu>;
  // Uygulamayı kapatır, asıl ve iz veritabanlarında kalan öbür bağlantıları toplar, veritabanlarını siler.
  kapat(): Promise<{ kalanBaglanti: number }>;
}

function adresBasliklari(): Record<string, string> {
  const zaman = Date.now();
  const imza = istemciImzasiUret(
    process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
    { adres: IP, tarayici: TARAYICI, zaman },
  );
  return {
    [ISTEMCI_BASLIKLARI.adres]: IP,
    [ISTEMCI_BASLIKLARI.tarayici]: TARAYICI,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: imza,
  };
}

async function girisYap(
  app: INestApplication<App>,
  kullaniciAdi: string,
): Promise<string> {
  const cevap = await request(app.getHttpServer())
    .post('/kimlik/oturum/giris')
    .set(adresBasliklari())
    .send({ kullaniciAdi, parola: PAROLA });
  if (cevap.status !== 200) {
    throw new Error(
      `${kullaniciAdi} giriş yapamadı: ${String(cevap.status)} ${JSON.stringify(cevap.body)}`,
    );
  }
  return (cevap.body as { erisimBelirteci: string }).erisimBelirteci;
}

async function superadminKur(
  app: INestApplication<App>,
  db: pg.Client,
): Promise<Oturumlu> {
  await app.get(TohumKosucusu).kos();
  const kod = await app.get(KurulumBaglantisiHandler).calistir();
  const belirle = await request(app.getHttpServer())
    .post('/kimlik/parola/belirle')
    .send({ kod, parola: PAROLA });
  if (belirle.status !== 204) {
    throw new Error(
      `superadmin parolası belirlenemedi: ${String(belirle.status)}`,
    );
  }
  const {
    rows: [satir],
  } = await db.query<{ id: string }>(
    "select id from kullanici where kullanici_adi = 'superadmin'",
  );
  if (satir === undefined) {
    throw new Error('tohum superadmin yazmadı');
  }
  return { id: satir.id, erisimBelirteci: await girisYap(app, 'superadmin') };
}

export async function kimlikOrtamiKur({
  controllers = [],
}: { controllers?: Type[] } = {}): Promise<KimlikOrtami> {
  const databases: AppDatabases = await createAppDatabases({
    migrations: true,
  });
  let app: INestApplication<App> | undefined;
  const db = new pg.Client({ connectionString: databases.asil.url });
  let dbAcik = false;
  try {
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers,
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    await db.connect();
    dbAcik = true;
    const acikApp = app;
    const superadmin = await superadminKur(acikApp, db);

    return {
      app: acikApp,
      db,
      veritabanlari: [databases.asil.name, databases.iz.name],
      superadmin,
      basliklar: (erisimBelirteci) => ({
        ...adresBasliklari(),
        authorization: `Bearer ${erisimBelirteci}`,
      }),
      kullaniciAc: async (kullaniciAdi) => {
        const id = randomUUID();
        const ozet = await acikApp.get(ParolaOzetleyici).ozetle(PAROLA);
        await db.query(
          'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
          [id, kullaniciAdi],
        );
        await db.query(
          `insert into uyelik (id, kullanici_id, grup_id, rol_id)
             select gen_random_uuid(), $1, g.id, r.id from grup g, rol r
              where g.ust_grup_id is null and g.silinme_zamani is null and r.kod = 'temel'`,
          [id],
        );
        await db.query(
          'insert into kullanici_sirri (kullanici_id, parola_ozeti) values ($1, $2)',
          [id, ozet],
        );
        return { id, erisimBelirteci: await girisYap(acikApp, kullaniciAdi) };
      },
      kapat: async () => {
        try {
          await acikApp.close();
          // İki veritabanı aynı anda yoklanır; art arda yoklama temizlik kancasının süresini aşabilir.
          const [asil, iz] = await Promise.all([
            kalanBaglantiSayisi(db, databases.asil.name, []),
            kalanBaglantiSayisi(db, databases.iz.name, []),
          ]);
          return { kalanBaglanti: asil + iz };
        } finally {
          await db.end();
          await databases.drop();
        }
      },
    };
  } catch (error) {
    await app?.close();
    if (dbAcik) {
      await db.end();
    }
    await databases.drop();
    throw error;
  }
}
