// Oturumların listelenmesi, tek kaydı ve kapatılması (GV-101; TS-002 AK-39, AK-51; izin Oturum:oku ve
// Oturum:kapat). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-oturum-yonetim.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Kişiler yalnız temel üyelikle açılır ve
// oturumları uçtan (giriş) açılır; yetenekler tohumdan gelir (temel üyelikte şartı "oturumun sahibi
// isteği yapandır" olan Oturum:oku ve Oturum:kapat, SuperAdmin'de bütün kayıtlar). Zaman gerektiren
// durumlar (kapatılmış, mutlak bitişi geçmiş, hareketsizlik sınırı dolmuş) geçici veritabanında SQL ile
// kurulur. Notlar outbox_iz tablosundan okunur. Bölümler sırayla koşar.
import pg from 'pg';
import request from 'supertest';
import {
  type KimlikOrtami,
  kimlikOrtamiKur,
  tamGiris,
} from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/oturum';
const IS_ADI = 'kimlik:oturum-kapat';
const YOK = '9e000000-0000-7000-8000-0000000000ff';

// Oturum kaynağının kolonları (TS-002 "Veri modeli"); sır kolonları kaynak değildir.
const OTURUM_KOLONLARI = [
  'baslangicZamani',
  'girisYontemi',
  'id',
  'ipAdresi',
  'kapatilmaNedeni',
  'kapatilmaZamani',
  'kullaniciId',
  'mutlakBitisZamani',
  'sonDondurmeZamani',
  'tarayiciBilgisi',
];

interface Kayit {
  id: string;
  kullaniciId: string;
  baslangicZamani: string;
  [kolon: string]: unknown;
}

interface Liste {
  kayitlar: Kayit[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
  buOturumId: string;
}

interface Not {
  kullanici_id: string;
  yetenek_id: string | null;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

interface Kisi {
  id: string;
  // Kişinin oturumları, açılış sırasıyla; ilki yardımcının açtığıdır.
  oturumlar: { id: string; erisimBelirteci: string }[];
}

let ortam: KimlikOrtami;

function listele(belirtec: string, sorgu = ''): request.Test {
  return request(ortam.app.getHttpServer())
    .get(`${YOL}${sorgu}`)
    .set(ortam.basliklar(belirtec));
}

function oku(id: string, belirtec: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get(`${YOL}/${id}`)
    .set(ortam.basliklar(belirtec));
}

function kapat(id: string, belirtec: string): request.Test {
  return request(ortam.app.getHttpServer())
    .post(`${YOL}/${id}/kapat`)
    .set(ortam.basliklar(belirtec));
}

function yetkilerim(belirtec: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get(`${YOL}/yetkilerim`)
    .set(ortam.basliklar(belirtec));
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

// Yardımcıyla bir kişi açar (ilk oturum) ve uçtan ek oturumlar açar.
async function kisiAc(kullaniciAdi: string, ekOturum = 0): Promise<Kisi> {
  const { id, erisimBelirteci } = await ortam.kullaniciAc(kullaniciAdi);
  const [ilk] = await satirlar<{ id: string }>(
    'select id from oturum where kullanici_id = $1',
    [id],
  );
  if (ilk === undefined) {
    throw new Error(`oturum yok: ${kullaniciAdi}`);
  }
  const oturumlar = [{ id: ilk.id, erisimBelirteci }];
  for (let i = 0; i < ekOturum; i++) {
    const giris = await tamGiris(ortam.app, kullaniciAdi);
    oturumlar.push({
      id: giris.oturumId,
      erisimBelirteci: giris.erisimBelirteci,
    });
  }
  return { id, oturumlar };
}

function oturum(kisi: Kisi, sira: number): { id: string; belirtec: string } {
  const o = kisi.oturumlar[sira];
  if (o === undefined) {
    throw new Error(`oturum yok: ${String(sira)}`);
  }
  return { id: o.id, belirtec: o.erisimBelirteci };
}

async function oturumSatiri(
  id: string,
): Promise<{ kapatilma_zamani: Date | null; kapatilma_nedeni: string | null }> {
  const [satir] = await satirlar<{
    kapatilma_zamani: Date | null;
    kapatilma_nedeni: string | null;
  }>('select kapatilma_zamani, kapatilma_nedeni from oturum where id = $1', [
    id,
  ]);
  if (satir === undefined) {
    throw new Error(`oturum satırı yok: ${id}`);
  }
  return satir;
}

// Kapatma işinin o oturum için yazdığı notlar.
async function notlar(oturumId: string): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      `select govde from outbox_iz
        where govde->>'is_adi' = $1 and govde->>'kayit_id' = $2
        order by olusturma_zamani, id`,
      [IS_ADI, oturumId],
    )
  ).map((s) => s.govde);
}

async function tohumYetenegi(tohumAnahtari: string): Promise<string> {
  const [satir] = await satirlar<{ id: string }>(
    'select id from yetenek where tohum_anahtari = $1',
    [tohumAnahtari],
  );
  if (satir === undefined) {
    throw new Error(`tohum yeteneği yok: ${tohumAnahtari}`);
  }
  return satir.id;
}

// Bütün oturum satırları ve not sayısı; reddedilen istekte değişmez.
async function durum(): Promise<unknown> {
  const [sonuc] = await satirlar(
    `select (select count(*)::int from outbox_iz) as notlar,
            (select json_agg(o order by o.id) from oturum o) as oturumlar`,
  );
  return sonuc;
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

// Kişiler: ali iki oturumlu, berk tek oturumlu; cem süzgeç bölümünün kişisi (bir açık oturum ve
// SQL ile hazırlanan üç açık olmayan oturum).
let ali: Kisi;
let berk: Kisi;
let cem: Kisi;
let cemKapali: string;
let cemMutlak: string;
let cemHareketsiz: string;

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
  ali = await kisiAc('ali', 1);
  berk = await kisiAc('berk');
  // Giriş kişi başına en çok üç açık oturum bırakır (fazlası oturum_siniri ile kapanır); bu yüzden
  // dördüncü oturum, ikisi açık olmaktan çıkarıldıktan sonra açılır.
  cem = await kisiAc('cem', 2);
  cemKapali = oturum(cem, 1).id;
  cemMutlak = oturum(cem, 2).id;
  // Başlangıç zamanları ayrık ve bilinen sıradadır: hareketsiz (1 saat önce), mutlak (2 saat önce),
  // kapalı (3 saat önce); açık oturum en yenisidir.
  await ortam.db.query(
    `update oturum set baslangic_zamani = now() - interval '3 hours',
                       kapatilma_zamani = now(), kapatilma_nedeni = 'cikis'
      where id = $1`,
    [cemKapali],
  );
  await ortam.db.query(
    `update oturum set baslangic_zamani = now() - interval '2 hours',
                       mutlak_bitis_zamani = now() - interval '1 minute'
      where id = $1`,
    [cemMutlak],
  );
  const dorduncu = await tamGiris(ortam.app, 'cem');
  cem.oturumlar.push({
    id: dorduncu.oturumId,
    erisimBelirteci: dorduncu.erisimBelirteci,
  });
  cemHareketsiz = dorduncu.oturumId;
  await ortam.db.query(
    `update oturum set baslangic_zamani = now() - interval '1 hour',
                       son_dondurme_zamani = now() - interval '31 minutes'
      where id = $1`,
    [cemHareketsiz],
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) kendi oturumları', () => {
  it('sıradan kişi listede yalnız kendi iki oturumunu görür; buOturumId isteği yapandır', async () => {
    const { id: ilk, belirtec } = oturum(ali, 0);
    const cevap = await listele(belirtec);
    expect(cevap.status).toBe(200);
    const liste = cevap.body as Liste;
    // Varsayılan sıra başlangıç zamanı azalandır: sonra açılan önce gelir.
    expect(liste.kayitlar.map((k) => k.id)).toEqual([oturum(ali, 1).id, ilk]);
    expect(liste.kayitlar.every((k) => k.kullaniciId === ali.id)).toBe(true);
    expect(liste).toMatchObject({
      sayfa: 1,
      boyut: 20,
      sonrakiVar: false,
      buOturumId: ilk,
    });
  });

  it('kayıtlar kaynağın kolonlarını taşır; sır ya da özet alanı yoktur', async () => {
    const liste = (await listele(oturum(ali, 0).belirtec)).body as Liste;
    for (const kayit of liste.kayitlar) {
      expect(Object.keys(kayit).sort()).toEqual(OTURUM_KOLONLARI);
      expect(
        Object.keys(kayit).filter((k) => /sir|ozet|nesil/i.test(k)),
      ).toEqual([]);
    }
    const tek = await oku(oturum(ali, 1).id, oturum(ali, 0).belirtec);
    expect(tek.status).toBe(200);
    expect(Object.keys(tek.body as object).sort()).toEqual(OTURUM_KOLONLARI);
  });

  it('başka kişinin oturumu tek kayıt ucunda 404, olmayan oturum da 404 döner', async () => {
    const baska = await oku(oturum(berk, 0).id, oturum(ali, 0).belirtec);
    expect(baska.status).toBe(404);
    expect(baska.body).toMatchObject({ kod: 'bulunamadi' });
    const yok = await oku(YOK, oturum(ali, 0).belirtec);
    expect(yok.status).toBe(404);
    expect(yok.body).toMatchObject({ kod: 'bulunamadi' });
  });
});

describe('b) süzgeç ve sıralama', () => {
  it('acik=true yalnız açık oturumu verir; kapatılmış, mutlak bitişi geçmiş ve hareketsiz olan dışarıdadır', async () => {
    const cevap = await listele(oturum(cem, 0).belirtec, '?acik=true');
    expect(cevap.status).toBe(200);
    expect((cevap.body as Liste).kayitlar.map((k) => k.id)).toEqual([
      oturum(cem, 0).id,
    ]);
  });

  it('acik=false o üçünü başlangıç zamanı azalan sırayla verir', async () => {
    const cevap = await listele(oturum(cem, 0).belirtec, '?acik=false');
    expect(cevap.status).toBe(200);
    expect((cevap.body as Liste).kayitlar.map((k) => k.id)).toEqual([
      cemHareketsiz,
      cemMutlak,
      cemKapali,
    ]);
  });

  it('acik=false sayfalanır: her sayfada bir kayıt, sıra bozulmadan', async () => {
    const sayfalar: Liste[] = [];
    for (const sayfa of [1, 2, 3]) {
      const cevap = await listele(
        oturum(cem, 0).belirtec,
        `?acik=false&boyut=1&sayfa=${String(sayfa)}`,
      );
      expect(cevap.status).toBe(200);
      sayfalar.push(cevap.body as Liste);
    }
    expect(sayfalar.map((s) => s.kayitlar.map((k) => k.id))).toEqual([
      [cemHareketsiz],
      [cemMutlak],
      [cemKapali],
    ]);
    expect(sayfalar.map((s) => s.sonrakiVar)).toEqual([true, true, false]);
  });

  it('yönetici kullaniciId ile süzer; süzgeçler birlikte çalışır', async () => {
    const yonetici = ortam.superadmin.erisimBelirteci;
    const cemin = await listele(yonetici, `?kullaniciId=${cem.id}`);
    expect(cemin.status).toBe(200);
    expect((cemin.body as Liste).kayitlar.map((k) => k.id).sort()).toEqual(
      cem.oturumlar.map((o) => o.id).sort(),
    );
    const alinin = await listele(yonetici, `?kullaniciId=${ali.id}`);
    expect((alinin.body as Liste).kayitlar.map((k) => k.id).sort()).toEqual(
      ali.oturumlar.map((o) => o.id).sort(),
    );
    const kapali = await listele(yonetici, `?kullaniciId=${cem.id}&acik=false`);
    expect((kapali.body as Liste).kayitlar.map((k) => k.id)).toEqual([
      cemHareketsiz,
      cemMutlak,
      cemKapali,
    ]);
    // Yöneticinin süzgeçsiz listesi başka kişilerin oturumlarını da taşır.
    const hepsi = (await listele(yonetici, '?boyut=100')).body as Liste;
    expect(new Set(hepsi.kayitlar.map((k) => k.kullaniciId))).toEqual(
      new Set([ortam.superadmin.id, ali.id, berk.id, cem.id]),
    );
  });

  it('sıralama artan ve azalan çalışır; son döndürme zamanına göre de sıralanır', async () => {
    const belirtec = oturum(cem, 0).belirtec;
    const artan = await listele(belirtec, '?acik=false&sirala=baslangicZamani');
    expect(artan.status).toBe(200);
    expect((artan.body as Liste).kayitlar.map((k) => k.id)).toEqual([
      cemKapali,
      cemMutlak,
      cemHareketsiz,
    ]);
    const azalan = await listele(belirtec, '?sirala=-baslangicZamani');
    expect((azalan.body as Liste).kayitlar.map((k) => k.id)).toEqual([
      oturum(cem, 0).id,
      cemHareketsiz,
      cemMutlak,
      cemKapali,
    ]);
    const dondurme = await listele(belirtec, '?sirala=sonDondurmeZamani');
    expect(dondurme.status).toBe(200);
    const sira = (dondurme.body as Liste).kayitlar.map((k) =>
      Date.parse(k['sonDondurmeZamani'] as string),
    );
    expect(sira).toEqual([...sira].sort((a, b) => a - b));
    // Hareketsiz oturumun son döndürmesi en eskidir.
    expect((dondurme.body as Liste).kayitlar[0]?.id).toBe(cemHareketsiz);
  });

  it('geçersiz sıralama, süzgeç ve boyut 400 döner', async () => {
    const belirtec = oturum(cem, 0).belirtec;
    for (const sorgu of [
      '?sirala=ipAdresi',
      '?sirala=-kapatilmaZamani',
      '?acik=evet',
      '?kullaniciId=kimlik-degil',
      '?boyut=101',
    ]) {
      const cevap = await listele(belirtec, sorgu);
      expect(cevap.status, sorgu).toBe(400);
      expect(cevap.body, sorgu).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });
});

describe('c) sahibi öbür oturumunu kapatır', () => {
  it('204; neden sahibi_kapatti; kapanan oturum 401 alır, isteği yapan açık kalır; not yetenek kimliğini taşır', async () => {
    const isteyen = oturum(ali, 0);
    const hedef = oturum(ali, 1);
    const cevap = await kapat(hedef.id, isteyen.belirtec);
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');

    const satir = await oturumSatiri(hedef.id);
    expect(satir.kapatilma_nedeni).toBe('sahibi_kapatti');
    expect(satir.kapatilma_zamani).not.toBeNull();
    expect(await oturumSatiri(isteyen.id)).toEqual({
      kapatilma_zamani: null,
      kapatilma_nedeni: null,
    });

    expect((await yetkilerim(hedef.belirtec)).status).toBe(401);
    expect((await listele(isteyen.belirtec)).status).toBe(200);

    const yetenek = await tohumYetenegi('kimlik:Oturum:kapat:temel');
    const kapatma = (await notlar(hedef.id)).filter(
      (n) => 'kapatilma_nedeni' in n.degisen,
    );
    expect(kapatma).toHaveLength(1);
    expect(kapatma[0]).toMatchObject({
      kullanici_id: ali.id,
      yetenek_id: yetenek,
      kaynak: 'Oturum',
      kayit_id: hedef.id,
      eylem: 'guncelleme',
      degisen: {
        kapatilma_zamani: {
          eski: null,
          yeni: satir.kapatilma_zamani?.toISOString(),
        },
        kapatilma_nedeni: { eski: null, yeni: 'sahibi_kapatti' },
      },
    });
  });
});

describe('d) yönetici başka kişinin oturumunu kapatır', () => {
  it('204; neden yonetici; not SuperAdmin yeteneğini taşır', async () => {
    const hedef = oturum(berk, 0);
    const cevap = await kapat(hedef.id, ortam.superadmin.erisimBelirteci);
    expect(cevap.status).toBe(204);
    expect((await oturumSatiri(hedef.id)).kapatilma_nedeni).toBe('yonetici');
    expect((await yetkilerim(hedef.belirtec)).status).toBe(401);
    const yetenek = await tohumYetenegi('kimlik:Oturum:kapat:superadmin');
    const kapatma = (await notlar(hedef.id)).filter(
      (n) => 'kapatilma_nedeni' in n.degisen,
    );
    expect(kapatma).toHaveLength(1);
    expect(kapatma[0]).toMatchObject({
      kullanici_id: ortam.superadmin.id,
      yetenek_id: yetenek,
      degisen: { kapatilma_nedeni: { eski: null, yeni: 'yonetici' } },
    });
  });
});

describe('e) sıradan kişi başkasının oturumunu kapatamaz', () => {
  it('404 bulunamadi (niyet eylemlerinin şarta uymayan kayıttaki kodu); satır ve notlar değişmez', async () => {
    const hedef = oturum(ali, 0);
    const once = await durum();
    const cevap = await kapat(hedef.id, oturum(cem, 0).belirtec);
    expect(cevap.status).toBe(404);
    expect(cevap.body).toMatchObject({ kod: 'bulunamadi' });
    expect(await durum()).toEqual(once);
    expect(await oturumSatiri(hedef.id)).toEqual({
      kapatilma_zamani: null,
      kapatilma_nedeni: null,
    });
  });

  it('olmayan oturum 404 döner', async () => {
    const cevap = await kapat(YOK, ortam.superadmin.erisimBelirteci);
    expect(cevap.status).toBe(404);
    expect(cevap.body).toMatchObject({ kod: 'bulunamadi' });
  });
});

describe('f) zaten kapalı oturum', () => {
  it('409 cakisma; satır ve notlar değişmez', async () => {
    for (const [id, belirtec] of [
      [oturum(ali, 1).id, oturum(ali, 0).belirtec],
      [cemKapali, oturum(cem, 0).belirtec],
      [oturum(berk, 0).id, ortam.superadmin.erisimBelirteci],
    ] as const) {
      const once = await durum();
      const cevap = await kapat(id, belirtec);
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({ kod: 'cakisma' });
      expect(await durum()).toEqual(once);
    }
  });
});

describe('g) kişi o anki oturumunu kapatır', () => {
  it('204; neden sahibi_kapatti; sonraki isteği 401 alır', async () => {
    const dora = await kisiAc('dora');
    const { id, belirtec } = oturum(dora, 0);
    expect(((await listele(belirtec)).body as Liste).buOturumId).toBe(id);
    expect((await kapat(id, belirtec)).status).toBe(204);
    expect((await oturumSatiri(id)).kapatilma_nedeni).toBe('sahibi_kapatti');
    const sonraki = await listele(belirtec);
    expect(sonraki.status).toBe(401);
  });
});

describe('h) yol çakışması yok', () => {
  it('GET kimlik/oturum/yetkilerim 200 döner', async () => {
    const cevap = await yetkilerim(oturum(ali, 0).belirtec);
    expect(cevap.status).toBe(200);
    expect(Array.isArray((cevap.body as { kurallar: unknown }).kurallar)).toBe(
      true,
    );
  });
});
