// Kimlik feature'ının on bir tablosu (GV-020): kolonlar, adlar, kısıtlar ve onları kuran göç. Testler
// göçleri uygulanmış geçici veritabanında koşar; her davranış testi kendi işleminde çalışır ve işlem
// hiç onaylanmaz (bağlantı kapanınca geri alınır), satırlar testler arasında taşınmaz.
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const gocKlasoru = `${backendDir}prisma/migrations`;
const kimlikGocu = '20261124230000_kimlik';

// Bu görevden önceki göç dosyalarının SHA-256 özetleri (HEAD ac5be71).
const oncekiGocOzetleri: Record<string, string> = {
  '20261124163457_outbox':
    'a32d08e15b19ddc59eb92d90620aff9af00083d3a85aa7c85f134f9f7c8706e8',
  '20261124200000_islenen_olay':
    '801b7652b3af1c89d23113aa37b51cf09edadb8f261954571725630b12000e81',
  '20261124210000_outbox_olay_deneme':
    '4bdf4ea2d6e1344e317110536b281abd52e323424614c99a29225885fd1a8644',
  '20261124220000_islenen_olay_sahip_id':
    '088d120132194db5ac0e31b6793fa577e4747cdacb3950d4b94d4bb3441be849',
};

const zaman = 'timestamp with time zone';

// Hedefteki kolon listesi, sırayla; her satır "ad | tür | boş olabilir mi | varsayılan | hassasiyet".
// Varsayılanı olmayan kolonda varsayılan, zaman dışı kolonda hassasiyet "-" yazılır; dizi kolonunun
// türü öğe türüyle yazılır (text[]).
const tablolar: { ad: string; kolonlar: string[] }[] = [
  {
    ad: 'kullanici',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kullanici_adi | text | YES | - | -',
      'telefon | text | YES | - | -',
      'gorunen_ad | text | NO | - | -',
      'sistem_aktoru | boolean | NO | false | -',
      'yetki_surumu | integer | NO | 0 | -',
      `pasif_zamani | ${zaman} | YES | - | 6`,
      `unutulma_zamani | ${zaman} | YES | - | 6`,
      `olusturma_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'kullanici_sirri',
    kolonlar: [
      'kullanici_id | uuid | NO | - | -',
      'parola_ozeti | text | NO | - | -',
      `guncelleme_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'oturum',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kullanici_id | uuid | NO | - | -',
      'giris_yontemi | text | NO | - | -',
      `baslangic_zamani | ${zaman} | NO | clock_timestamp() | 6`,
      `mutlak_bitis_zamani | ${zaman} | NO | - | 6`,
      `son_dondurme_zamani | ${zaman} | NO | - | 6`,
      'ip_adresi | text | NO | - | -',
      'tarayici_bilgisi | text | NO | - | -',
      `kapatilma_zamani | ${zaman} | YES | - | 6`,
      'kapatilma_nedeni | text | YES | - | -',
    ],
  },
  {
    ad: 'oturum_sirri',
    kolonlar: [
      'oturum_id | uuid | NO | - | -',
      'nesil | integer | NO | - | -',
      'gecerli_yenileme_ozeti | text | NO | - | -',
      'onceki_yenileme_ozeti | text | YES | - | -',
      'cihaz_sirri_ozeti | text | NO | - | -',
    ],
  },
  {
    ad: 'parola_baglantisi',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kullanici_id | uuid | NO | - | -',
      'kod_ozeti | text | NO | - | -',
      `son_gecerlilik_zamani | ${zaman} | NO | - | 6`,
      `kullanilma_zamani | ${zaman} | YES | - | 6`,
      'olusturan_id | uuid | YES | - | -',
      `olusturma_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'grup',
    kolonlar: [
      'id | uuid | NO | - | -',
      'ust_grup_id | uuid | YES | - | -',
      'ad | text | NO | - | -',
      `silinme_zamani | ${zaman} | YES | - | 6`,
      `olusturma_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'rol',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kod | text | YES | - | -',
      'ad | text | NO | - | -',
      `silinme_zamani | ${zaman} | YES | - | 6`,
    ],
  },
  {
    ad: 'izin',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kaynak | text | NO | - | -',
      'eylem | text | NO | - | -',
    ],
  },
  {
    ad: 'uyelik',
    kolonlar: [
      'id | uuid | NO | - | -',
      'kullanici_id | uuid | NO | - | -',
      'grup_id | uuid | NO | - | -',
      'rol_id | uuid | NO | - | -',
      `silinme_zamani | ${zaman} | YES | - | 6`,
      `olusturma_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'yetenek',
    kolonlar: [
      'id | uuid | NO | - | -',
      'grup_id | uuid | NO | - | -',
      'rol_id | uuid | NO | - | -',
      'izin_id | uuid | NO | - | -',
      'sart | jsonb | YES | - | -',
      'butun_kayitlar | boolean | NO | false | -',
      'butun_birimler | boolean | NO | false | -',
      'kolonlar | text[] | YES | - | -',
      'butun_kolonlar | boolean | NO | false | -',
      'sistem_satiri | boolean | NO | false | -',
      `silinme_zamani | ${zaman} | YES | - | 6`,
      'tohum_anahtari | text | YES | - | -',
      'yerine_gectigi_id | uuid | YES | - | -',
      'koken | text | NO | - | -',
      `olusturma_zamani | ${zaman} | NO | clock_timestamp() | 6`,
    ],
  },
  {
    ad: 'yetki_surumu',
    kolonlar: [
      'id | integer | NO | - | -',
      'sayac | integer | NO | 0 | -',
    ],
  },
];

const tabloAdlari = tablolar.map((tablo) => tablo.ad);

const yaKurali = 'ON UPDATE CASCADE ON DELETE RESTRICT';
const ya = (kolon: string, hedef: string) =>
  `FOREIGN KEY (${kolon}) REFERENCES ${hedef}(id) ${yaKurali}`;

// On bir tablonun bütün kısıtları ("boş olamaz" dışında), tanımlarıyla: "tablo | ad | tanım".
const beklenenKisitlar = [
  'grup | grup_ba | PRIMARY KEY (id)',
  `grup | grup_ust_grup_id_ya | ${ya('ust_grup_id', 'grup')}`,
  'izin | izin_ba | PRIMARY KEY (id)',
  'kullanici | kullanici_ba | PRIMARY KEY (id)',
  'kullanici_sirri | kullanici_sirri_ba | PRIMARY KEY (kullanici_id)',
  `kullanici_sirri | kullanici_sirri_kullanici_id_ya | ${ya('kullanici_id', 'kullanici')}`,
  'oturum | oturum_ba | PRIMARY KEY (id)',
  `oturum | oturum_kullanici_id_ya | ${ya('kullanici_id', 'kullanici')}`,
  'oturum_sirri | oturum_sirri_ba | PRIMARY KEY (oturum_id)',
  `oturum_sirri | oturum_sirri_oturum_id_ya | ${ya('oturum_id', 'oturum')}`,
  'parola_baglantisi | parola_baglantisi_ba | PRIMARY KEY (id)',
  `parola_baglantisi | parola_baglantisi_kullanici_id_ya | ${ya('kullanici_id', 'kullanici')}`,
  `parola_baglantisi | parola_baglantisi_olusturan_id_ya | ${ya('olusturan_id', 'kullanici')}`,
  'rol | rol_ba | PRIMARY KEY (id)',
  'uyelik | uyelik_ba | PRIMARY KEY (id)',
  `uyelik | uyelik_grup_id_ya | ${ya('grup_id', 'grup')}`,
  `uyelik | uyelik_kullanici_id_ya | ${ya('kullanici_id', 'kullanici')}`,
  `uyelik | uyelik_rol_id_ya | ${ya('rol_id', 'rol')}`,
  'yetenek | yetenek_ba | PRIMARY KEY (id)',
  `yetenek | yetenek_grup_id_ya | ${ya('grup_id', 'grup')}`,
  `yetenek | yetenek_izin_id_ya | ${ya('izin_id', 'izin')}`,
  'yetenek | yetenek_kayit_siniri_denetim | CHECK ((NOT (butun_kayitlar AND (sart IS NOT NULL))))',
  'yetenek | yetenek_kolon_siniri_denetim | CHECK ((NOT (butun_kolonlar AND (kolonlar IS NOT NULL))))',
  `yetenek | yetenek_rol_id_ya | ${ya('rol_id', 'rol')}`,
  `yetenek | yetenek_yerine_gectigi_id_ya | ${ya('yerine_gectigi_id', 'yetenek')}`,
  'yetki_surumu | yetki_surumu_ba | PRIMARY KEY (id)',
  'yetki_surumu | yetki_surumu_tek_satir_denetim | CHECK ((id = 1))',
];

const dizin = (tablo: string, ad: string, govde: string, tekil = true) =>
  `${ad} | CREATE ${tekil ? 'UNIQUE ' : ''}INDEX ${ad} ON public.${tablo} USING btree ${govde}`;

// On bir tablonun bütün dizinleri: "ad | tanım".
const beklenenDizinler = [
  dizin('grup', 'grup_ba', '(id)'),
  dizin(
    'grup',
    'grup_kok_tekil',
    '((true)) WHERE ((ust_grup_id IS NULL) AND (silinme_zamani IS NULL))',
  ),
  dizin('grup', 'grup_ust_grup_id_dizin', '(ust_grup_id)', false),
  dizin('izin', 'izin_ba', '(id)'),
  dizin('izin', 'izin_kaynak_eylem_tekil', '(kaynak, eylem)'),
  dizin('kullanici', 'kullanici_ba', '(id)'),
  dizin('kullanici', 'kullanici_kullanici_adi_tekil', '(kullanici_adi)'),
  dizin('kullanici', 'kullanici_telefon_tekil', '(telefon)'),
  dizin('kullanici_sirri', 'kullanici_sirri_ba', '(kullanici_id)'),
  dizin('oturum', 'oturum_ba', '(id)'),
  dizin(
    'oturum',
    'oturum_kullanici_id_dizin',
    '(kullanici_id) WHERE (kapatilma_zamani IS NULL)',
    false,
  ),
  dizin('oturum_sirri', 'oturum_sirri_ba', '(oturum_id)'),
  dizin('parola_baglantisi', 'parola_baglantisi_ba', '(id)'),
  dizin('parola_baglantisi', 'parola_baglantisi_kod_ozeti_tekil', '(kod_ozeti)'),
  dizin(
    'parola_baglantisi',
    'parola_baglantisi_kullanici_id_tekil',
    '(kullanici_id) WHERE (kullanilma_zamani IS NULL)',
  ),
  dizin('rol', 'rol_ba', '(id)'),
  dizin('rol', 'rol_kod_tekil', '(kod)'),
  dizin('uyelik', 'uyelik_ba', '(id)'),
  dizin(
    'uyelik',
    'uyelik_kullanici_id_dizin',
    '(kullanici_id) WHERE (silinme_zamani IS NULL)',
    false,
  ),
  dizin(
    'uyelik',
    'uyelik_kullanici_id_grup_id_rol_id_tekil',
    '(kullanici_id, grup_id, rol_id) WHERE (silinme_zamani IS NULL)',
  ),
  dizin('yetenek', 'yetenek_ba', '(id)'),
  dizin(
    'yetenek',
    'yetenek_grup_id_rol_id_dizin',
    '(grup_id, rol_id) WHERE (silinme_zamani IS NULL)',
    false,
  ),
  dizin(
    'yetenek',
    'yetenek_tohum_anahtari_tekil',
    '(tohum_anahtari) WHERE (silinme_zamani IS NULL)',
  ),
  dizin('yetki_surumu', 'yetki_surumu_ba', '(id)'),
];

// Ad kuralı (KR-011 Seçim 7): <tablo>_ba, <tablo>_<kolonlar>_dizin|_tekil|_ya, <tablo>_<ad>_denetim.
// Kök grubun tekili kartta adı açıkça verilen bir ad olduğu için kolon adı taşımaz.
const adKurali = /^[a-z0-9_]+_(ba|dizin|tekil|ya|denetim)$/;

let database: TestDatabase;

async function query<T extends pg.QueryResultRow>(
  connectionString: string,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
}

type Calistir = (sql: string, values?: unknown[]) => Promise<void>;

// Verilen işi tek işlemde koşar; her komut kendi kayıt noktasındadır, reddedilen komut işlemi bozmaz.
// İşlem onaylanmaz: bağlantı kapanınca PostgreSQL açık işlemi geri alır.
async function islemde(is: (calistir: Calistir) => Promise<void>) {
  const client = new pg.Client({ connectionString: database.url });
  await client.connect();
  try {
    await client.query('begin');
    await is(async (sql, values = []) => {
      await client.query('savepoint komut');
      try {
        await client.query(sql, values);
      } catch (error) {
        await client.query('rollback to savepoint komut');
        throw error;
      }
    });
  } finally {
    await client.end();
  }
}

// PostgreSQL hata kodları: 23505 tekil, 23503 yabancı anahtar (olmayan üst satır), 23001 RESTRICT
// silme kuralı (bağlı satırı olan kaydın silinmesi), 23514 denetim kısıtı ihlali.
const reddi = (code: string, constraint: string) => ({ code, constraint });

async function kullaniciEkle(
  calistir: Calistir,
  kullaniciAdi: string | null = null,
  telefon: string | null = null,
): Promise<string> {
  const id = randomUUID();
  await calistir(
    'insert into kullanici (id, kullanici_adi, telefon, gorunen_ad) values ($1, $2, $3, $4)',
    [id, kullaniciAdi, telefon, 'Deneme'],
  );
  return id;
}

async function grupEkle(
  calistir: Calistir,
  ustGrupId: string | null,
): Promise<string> {
  const id = randomUUID();
  await calistir('insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)', [
    id,
    ustGrupId,
    'Deneme',
  ]);
  return id;
}

async function rolEkle(
  calistir: Calistir,
  kod: string | null,
): Promise<string> {
  const id = randomUUID();
  await calistir('insert into rol (id, kod, ad) values ($1, $2, $3)', [
    id,
    kod,
    'Deneme',
  ]);
  return id;
}

async function izinEkle(
  calistir: Calistir,
  kaynak: string,
  eylem: string,
): Promise<string> {
  const id = randomUUID();
  await calistir('insert into izin (id, kaynak, eylem) values ($1, $2, $3)', [
    id,
    kaynak,
    eylem,
  ]);
  return id;
}

const oturumEkleSql = `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani,
  son_dondurme_zamani, ip_adresi, tarayici_bilgisi)
  values ($1, $2, 'parola', clock_timestamp(), clock_timestamp(), '127.0.0.1', 'deneme')`;

const baglantiEkleSql = `insert into parola_baglantisi (id, kullanici_id, kod_ozeti, son_gecerlilik_zamani)
  values ($1, $2, $3, clock_timestamp())`;

const uyelikEkleSql =
  'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)';

// Yalnız verilen sütunlar ($5'ten sonrası) değişir; ötekiler varsayılanında kalır.
const yetenekEkleSql = `insert into yetenek (id, grup_id, rol_id, izin_id, koken, butun_kayitlar,
  sart, butun_kolonlar, kolonlar, tohum_anahtari)
  values ($1, $2, $3, $4, 'deneme', $5, $6, $7, $8, $9)`;

beforeAll(async () => {
  database = await createTestDatabase([], { migrations: true });
});

afterAll(async () => {
  // Açılış başarısızsa yardımcı veritabanını zaten silmiştir; asıl hatanın yanına ikinci hata eklenmez.
  const acilan = database as TestDatabase | undefined;
  if (acilan === undefined) return;
  await acilan.drop();
  const kalan = await query(
    localInfrastructure.databaseUrl,
    'select 1 from pg_database where datname = $1',
    [acilan.name],
  );
  expect(kalan).toHaveLength(0);
});

describe('a-b) kimlik tablolarının yapısı', () => {
  it.each(tablolar)(
    'a) $ad kolonları ad, tür, boş olabilirlik, varsayılan ve hassasiyet olarak hedefle birebir aynıdır',
    async ({ ad, kolonlar }) => {
      const rows = await query<{ kolon: string }>(
        database.url,
        `select concat_ws(' | ', column_name,
                          case when data_type = 'ARRAY' then substr(udt_name, 2) || '[]'
                               else data_type end,
                          is_nullable,
                          coalesce(column_default, '-'),
                          coalesce(datetime_precision::text, '-')) as kolon
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [ad],
      );
      expect(rows.map((row) => row.kolon)).toEqual(kolonlar);
    },
  );

  it('a) public şemasında kimliğin on bir tablosu vardır; kolonlarında tür yoktur', async () => {
    const tablo = await query<{ ad: string }>(
      database.url,
      "select table_name as ad from information_schema.tables where table_schema = 'public' order by 1",
    );
    // Liste ve tür şemanın bütününde sayılmaz; başka görevin tablosu ya da türü bu testi kırmasın
    // diye yalnız kimliğin tabloları ve kolonları sınanır (TS-003 Onarım).
    expect(tablo.map((row) => row.ad)).toEqual(
      expect.arrayContaining(tabloAdlari),
    );
    // Kimlik tablolarının kolonlarında tür (enum, alan, bileşik, aralık) ya da onların dizisi yoktur.
    const tur = await query(
      database.url,
      `select tablo.relname, a.attname from pg_attribute a
         join pg_class tablo on tablo.oid = a.attrelid
         join pg_type t on t.oid = a.atttypid
         left join pg_type e on e.oid = t.typelem
        where tablo.relnamespace = 'public'::regnamespace and tablo.relname = any($1)
          and a.attnum > 0 and not a.attisdropped
          and (t.typtype <> 'b' or e.typtype <> 'b')`,
      [tabloAdlari],
    );
    expect(tur).toEqual([]);
  });

  it('b) kısıtlar adları ve tanımlarıyla hedefle birebir aynıdır; her yabancı anahtarda silme RESTRICT', async () => {
    const rows = await query<{ kisit: string }>(
      database.url,
      `select concat_ws(' | ', tablo.relname, con.conname, pg_get_constraintdef(con.oid)) as kisit
         from pg_constraint con
         join pg_class tablo on tablo.oid = con.conrelid
        where con.connamespace = 'public'::regnamespace and con.contype <> 'n'
          and tablo.relname = any($1)
        order by 1`,
      [tabloAdlari],
    );
    expect(rows.map((row) => row.kisit)).toEqual(beklenenKisitlar);
  });

  it('b) dizinler adları ve tanımlarıyla hedefle birebir aynıdır', async () => {
    const rows = await query<{ dizin: string }>(
      database.url,
      `select concat_ws(' | ', indexname, indexdef) as dizin
         from pg_indexes
        where schemaname = 'public' and tablename = any($1)
        order by tablename, indexname`,
      [tabloAdlari],
    );
    expect(rows.map((row) => row.dizin)).toEqual(beklenenDizinler);
  });

  it('b) bütün kısıt ve dizin adları tablo adıyla başlar ve ad kuralının ekiyle biter', () => {
    const adlar = [
      ...beklenenKisitlar.map((satir) => satir.split(' | ').slice(0, 2)),
      ...beklenenDizinler.map((satir) => {
        const ad = satir.split(' | ')[0] ?? '';
        const tablo = tabloAdlari.find((t) =>
          satir.includes(` ON public.${t} USING`),
        );
        return [tablo, ad];
      }),
    ];
    expect(
      adlar.filter(
        ([tablo, ad]) =>
          tablo === undefined ||
          ad === undefined ||
          !ad.startsWith(`${tablo}_`) ||
          !adKurali.test(ad),
      ),
    ).toEqual([]);
  });
});

describe('c-j) kısıtların davranışı', () => {
  it('c) kullanıcı adı ve telefon tekildir; boş değerli birden çok satır eklenebilir', async () => {
    await islemde(async (calistir) => {
      await kullaniciEkle(calistir, 'ayse', '5550000001');
      await expect(kullaniciEkle(calistir, 'ayse')).rejects.toMatchObject(
        reddi('23505', 'kullanici_kullanici_adi_tekil'),
      );
      await expect(
        kullaniciEkle(calistir, null, '5550000001'),
      ).rejects.toMatchObject(reddi('23505', 'kullanici_telefon_tekil'));
      await kullaniciEkle(calistir);
      await kullaniciEkle(calistir);
      await kullaniciEkle(calistir, 'ali');
      await kullaniciEkle(calistir, 'veli');
      await kullaniciEkle(calistir, null, '5550000002');
      await kullaniciEkle(calistir, null, '5550000003');
    });
  });

  it('d) bir kişinin kullanılmamış ikinci bağlantısı reddedilir; ilki kullanılınca yenisi eklenir; kod özeti tekildir', async () => {
    await islemde(async (calistir) => {
      const kisi = await kullaniciEkle(calistir);
      const ilk = randomUUID();
      await calistir(baglantiEkleSql, [ilk, kisi, 'kod-1']);
      await expect(
        calistir(baglantiEkleSql, [randomUUID(), kisi, 'kod-2']),
      ).rejects.toMatchObject(
        reddi('23505', 'parola_baglantisi_kullanici_id_tekil'),
      );
      await calistir(
        'update parola_baglantisi set kullanilma_zamani = clock_timestamp() where id = $1',
        [ilk],
      );
      await calistir(baglantiEkleSql, [randomUUID(), kisi, 'kod-2']);
      const baska = await kullaniciEkle(calistir);
      await expect(
        calistir(baglantiEkleSql, [randomUUID(), baska, 'kod-1']),
      ).rejects.toMatchObject(
        reddi('23505', 'parola_baglantisi_kod_ozeti_tekil'),
      );
    });
  });

  it('e) üstü olmayan silinmemiş ikinci grup reddedilir; ilki silinince yenisi eklenir; alt gruplar etkilenmez', async () => {
    await islemde(async (calistir) => {
      const kok = await grupEkle(calistir, null);
      await expect(grupEkle(calistir, null)).rejects.toMatchObject(
        reddi('23505', 'grup_kok_tekil'),
      );
      await grupEkle(calistir, kok);
      await grupEkle(calistir, kok);
      await calistir(
        'update grup set silinme_zamani = clock_timestamp() where id = $1',
        [kok],
      );
      const yeniKok = await grupEkle(calistir, null);
      await grupEkle(calistir, yeniKok);
      await expect(grupEkle(calistir, null)).rejects.toMatchObject(
        reddi('23505', 'grup_kok_tekil'),
      );
    });
  });

  it('f) aynı (kullanıcı, grup, rol) için silinmemiş ikinci üyelik reddedilir; ilki silinince yenisi eklenir', async () => {
    await islemde(async (calistir) => {
      const kisi = await kullaniciEkle(calistir);
      const grup = await grupEkle(calistir, null);
      const rol = await rolEkle(calistir, null);
      const ilk = randomUUID();
      await calistir(uyelikEkleSql, [ilk, kisi, grup, rol]);
      await expect(
        calistir(uyelikEkleSql, [randomUUID(), kisi, grup, rol]),
      ).rejects.toMatchObject(
        reddi('23505', 'uyelik_kullanici_id_grup_id_rol_id_tekil'),
      );
      await calistir(
        'update uyelik set silinme_zamani = clock_timestamp() where id = $1',
        [ilk],
      );
      await calistir(uyelikEkleSql, [randomUUID(), kisi, grup, rol]);
    });
  });

  it('g) yetenek: sınır bayrağıyla birlikte şart ya da kolon reddedilir; ikisi de yoksa kabul edilir; tohum anahtarı silinmemişlerde tekildir', async () => {
    await islemde(async (calistir) => {
      const grup = await grupEkle(calistir, null);
      const rol = await rolEkle(calistir, null);
      const izin = await izinEkle(calistir, 'kullanici', 'okuma');
      const ekle = (
        butunKayitlar: boolean,
        sart: string | null,
        butunKolonlar: boolean,
        kolonlar: string[] | null,
        tohumAnahtari: string | null = null,
      ) => {
        const id = randomUUID();
        return calistir(yetenekEkleSql, [
          id,
          grup,
          rol,
          izin,
          butunKayitlar,
          sart,
          butunKolonlar,
          kolonlar,
          tohumAnahtari,
        ]).then(() => id);
      };
      await expect(
        ekle(true, '{"sahip": "ben"}', false, null),
      ).rejects.toMatchObject(reddi('23514', 'yetenek_kayit_siniri_denetim'));
      await expect(ekle(false, null, true, ['ad'])).rejects.toMatchObject(
        reddi('23514', 'yetenek_kolon_siniri_denetim'),
      );
      // İkisi de yok: sınır bayrağı da, şart ya da kolon listesi de verilmemiş satır saklanır.
      await ekle(false, null, false, null);
      await ekle(true, null, true, null);
      await ekle(false, '{"sahip": "ben"}', false, ['ad']);

      const ilk = await ekle(false, null, false, null, 'tohum-1');
      await expect(
        ekle(false, null, false, null, 'tohum-1'),
      ).rejects.toMatchObject(reddi('23505', 'yetenek_tohum_anahtari_tekil'));
      await calistir(
        'update yetenek set silinme_zamani = clock_timestamp() where id = $1',
        [ilk],
      );
      await ekle(false, null, false, null, 'tohum-1');
      await ekle(false, null, false, null, null);
      await ekle(false, null, false, null, null);
    });
  });

  it('h) yetki_surumu tablosunda yalnız id 1 olan tek satır bulunabilir', async () => {
    await islemde(async (calistir) => {
      await calistir('insert into yetki_surumu (id) values (1)');
      await expect(
        calistir('insert into yetki_surumu (id) values (2)'),
      ).rejects.toMatchObject(reddi('23514', 'yetki_surumu_tek_satir_denetim'));
      await expect(
        calistir('insert into yetki_surumu (id) values (1)'),
      ).rejects.toMatchObject(reddi('23505', 'yetki_surumu_ba'));
    });
  });

  it('i) bağlı satırı olan kullanıcı, grup, rol ve izin silinemez; olmayan kullanıcıya oturum eklenemez', async () => {
    await islemde(async (calistir) => {
      const kisi = await kullaniciEkle(calistir);
      await calistir(oturumEkleSql, [randomUUID(), kisi]);
      await expect(
        calistir('delete from kullanici where id = $1', [kisi]),
      ).rejects.toMatchObject(reddi('23001', 'oturum_kullanici_id_ya'));

      const uye = await kullaniciEkle(calistir);
      const grup = await grupEkle(calistir, null);
      const rol = await rolEkle(calistir, null);
      await calistir(uyelikEkleSql, [randomUUID(), uye, grup, rol]);
      await expect(
        calistir('delete from grup where id = $1', [grup]),
      ).rejects.toMatchObject(reddi('23001', 'uyelik_grup_id_ya'));
      await expect(
        calistir('delete from rol where id = $1', [rol]),
      ).rejects.toMatchObject(reddi('23001', 'uyelik_rol_id_ya'));

      const izin = await izinEkle(calistir, 'grup', 'okuma');
      await calistir(
        "insert into yetenek (id, grup_id, rol_id, izin_id, koken) values ($1, $2, $3, $4, 'deneme')",
        [randomUUID(), grup, rol, izin],
      );
      await expect(
        calistir('delete from izin where id = $1', [izin]),
      ).rejects.toMatchObject(reddi('23001', 'yetenek_izin_id_ya'));

      await expect(
        calistir(oturumEkleSql, [randomUUID(), randomUUID()]),
      ).rejects.toMatchObject(reddi('23503', 'oturum_kullanici_id_ya'));
    });
  });

  it('j) aynı (kaynak, eylem) ikinci kez reddedilir; rol kodu tekildir, kodu boş birden çok rol eklenebilir', async () => {
    await islemde(async (calistir) => {
      await izinEkle(calistir, 'kullanici', 'yazma');
      await expect(
        izinEkle(calistir, 'kullanici', 'yazma'),
      ).rejects.toMatchObject(reddi('23505', 'izin_kaynak_eylem_tekil'));
      await izinEkle(calistir, 'kullanici', 'silme');

      await rolEkle(calistir, 'yonetici');
      await expect(rolEkle(calistir, 'yonetici')).rejects.toMatchObject(
        reddi('23505', 'rol_kod_tekil'),
      );
      await rolEkle(calistir, null);
      await rolEkle(calistir, null);
    });
  });
});

describe('k) göç', () => {
  it('k) önceki göç dosyaları değişmemiştir; kimlik göçünün klasörü vardır ve göçlerin hepsi uygulanmıştır', async ({
    annotate,
  }) => {
    const klasorler = (await readdir(gocKlasoru, { withFileTypes: true }))
      .filter((g) => g.isDirectory())
      .map((g) => g.name)
      .sort();
    const ozetler: Record<string, string> = {};
    for (const goc of Object.keys(oncekiGocOzetleri)) {
      ozetler[goc] = createHash('sha256')
        .update(await readFile(`${gocKlasoru}/${goc}/migration.sql`))
        .digest('hex');
    }
    const uygulanan = await query<{ migration_name: string }>(
      database.url,
      'select migration_name from _prisma_migrations where finished_at is not null order by migration_name',
    );
    await annotate(`göç klasörleri: ${JSON.stringify(klasorler)}`);
    expect(ozetler).toEqual(oncekiGocOzetleri);
    // Klasör sayısı ve son göçün adı sınanmaz; her yeni göçte kırılır (TS-003 Onarım).
    expect(klasorler).toContain(kimlikGocu);
    expect(uygulanan.map((g) => g.migration_name)).toEqual(klasorler);
  });

  it('k) elle yazılan nesneler göçün sonundaki işaretli bölümdedir ve her komutun önünde işaret yorumu vardır', async () => {
    const metin = await readFile(
      `${gocKlasoru}/${kimlikGocu}/migration.sql`,
      'utf8',
    );
    const [uretilen = '', elle = ''] = metin.split(
      '-- ELLE YAZILDI (başlangıç)',
    );
    const elleAdlar = [
      'grup_kok_tekil',
      'yetenek_kayit_siniri_denetim',
      'yetenek_kolon_siniri_denetim',
      'yetki_surumu_tek_satir_denetim',
    ];
    expect(elleAdlar.filter((ad) => !elle.includes(`"${ad}"`))).toEqual([]);
    expect(elleAdlar.filter((ad) => uretilen.includes(ad))).toEqual([]);
    expect(uretilen).not.toContain('ELLE YAZILDI');
    // Elle bölümde her komut, boş satırla ayrılmış bir öbektir ve öbek bir işaret yorumuyla başlar.
    const komutlar = elle
      .split(/\n\s*\n/)
      .filter((obek) => /^(CREATE|ALTER)/m.test(obek));
    expect(komutlar).toHaveLength(elleAdlar.length);
    expect(
      komutlar.filter((obek) => !obek.trimStart().startsWith('-- ELLE YAZILDI:')),
    ).toEqual([]);
  });

  it("k) Prisma'nın migrate diff komutu şema ile göçleri uygulanmış veritabanı arasında fark görmez", async ({
    annotate,
  }) => {
    // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 0 dışı çıkış execFile'ı reddettirir.
    const { stdout } = await promisify(execFile)(
      `${backendDir}node_modules/.bin/prisma`,
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
        '--exit-code',
      ],
      { cwd: backendDir, env: { ...process.env, DATABASE_URL: database.url } },
    );
    await annotate(`prisma migrate diff çıktısı: ${stdout.trim()}`);
    expect(stdout).toContain('-- This is an empty migration.');
  }, 30_000);
});
