// Çekirdek ekleri (GV-079; TS-002 AK-43): bütünlük sorularına yedi ek, iki künye okuması ve "parola
// sırrı" parçası. Koşturma:
//   pnpm -C backend test:e2e test/kimlik-cekirdek-ekleri.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) açılır; satırlar SQL ile hazırlanır,
// sorular Unit of Work'ün işleminde sorulur. "İsteyenin yeteneğinden bağımsızdır" sınaması için
// herkese açık bir sınama ucu, testin verdiği soruları isteğin içinde, işlem açarak sorar ve isteğin
// derlenmiş kural sayısıyla birlikte döner (yetki yoksa -1).
import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { ButunlukSorusu } from '../src/features/kimlik/_shared/application/butunluk-sorusu.js';
import type { IzBilgisi } from '../src/features/kimlik/_shared/application/iz.js';
import { KisiKilidi } from '../src/features/kimlik/_shared/application/kisi-kilidi.js';
import { ParolaSirri } from '../src/features/kimlik/_shared/application/parola-sirri.js';
import { type Islem, UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { HerkeseAcik } from '../src/shared/guvenlik/isaretler.js';
import { istekBaglami } from '../src/shared/http/istek-baglami.js';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

type Sorulacak = (soru: ButunlukSorusu, islem: Islem) => Promise<unknown>;

let ortam: KimlikOrtami;
let istekteSorulacak: Sorulacak | undefined;
let kokGrup: string;
let temelRol: string;
let superadminRol: string;
let grupOkuIzni: string;
let sistemAktoru: string;
let adSayaci = 0;

// İsteğin içinde, istekteSorulacak'taki soruları sorar.
@Controller('cekirdek-ekleri-sinama')
class CekirdekEkleriSinamaUcu {
  @Get('sor')
  @HerkeseAcik()
  async sor(): Promise<{ kuralSayisi: number; cevaplar: unknown }> {
    const sorulacak = istekteSorulacak;
    if (sorulacak === undefined) {
      throw new Error('sorulacak soru verilmedi');
    }
    const kuralSayisi = istekBaglami().yetki?.kurallar.length ?? -1;
    const cevaplar = await ortam.app
      .get(UnitOfWork)
      .run((islem) => sorulacak(ortam.app.get(ButunlukSorusu), islem));
    return { kuralSayisi, cevaplar };
  }
}

function sor<T>(
  is: (soru: ButunlukSorusu, islem: Islem) => Promise<T>,
): Promise<T> {
  return ortam.app
    .get(UnitOfWork)
    .run((islem) => is(ortam.app.get(ButunlukSorusu), islem));
}

async function tekDeger(
  sql: string,
  degerler: unknown[] = [],
): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ deger: string }>(sql, degerler);
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir.deger;
}

function yeniAd(): string {
  adSayaci += 1;
  return `ekler${String(adSayaci)}`;
}

async function grupEkle(ustGrupId: string | null): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad) values ($1, $2, 'Sınama')`,
    [id, ustGrupId],
  );
  return id;
}

async function rolEkle(kod: string | null): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into rol (id, kod, ad) values ($1, $2, 'Sınama')`,
    [id, kod],
  );
  return id;
}

async function uyelikEkle(
  kullaniciId: string,
  grupId: string,
  rolId: string,
  silinmis = false,
): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id, silinme_zamani)
     values ($1, $2, $3, $4, case when $5 then clock_timestamp() end)`,
    [id, kullaniciId, grupId, rolId, silinmis],
  );
  return id;
}

// Giriş yapmayan, (Kök, Temel) üyesi ve parola sırrı olmayan kişi; kullanıcı adı verilen değerdir.
async function kisiEkle(kullaniciAdi: string | null): Promise<string> {
  const id = randomUUID();
  await ortam.db.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $3)',
    [id, kullaniciAdi, 'Sınama'],
  );
  await uyelikEkle(id, kokGrup, temelRol);
  return id;
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
  ortam = await kimlikOrtamiKur({ controllers: [CekirdekEkleriSinamaUcu] });
  kokGrup = await tekDeger(
    'select id as deger from grup where ust_grup_id is null and silinme_zamani is null',
  );
  temelRol = await tekDeger("select id as deger from rol where kod = 'temel'");
  superadminRol = await tekDeger(
    "select id as deger from rol where kod = 'superadmin'",
  );
  grupOkuIzni = await tekDeger(
    "select id as deger from izin where kaynak = 'Grup' and eylem = 'oku'",
  );
  sistemAktoru = await tekDeger(
    'select id as deger from kullanici where sistem_aktoru',
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) bütünlük sorularına ekler', () => {
  it('bu rol sistem rolü mü: evet kodu dolu rol; hayır kodsuz rol ve var olmayan rol', async () => {
    const kodsuz = await rolEkle(null);
    expect(await sor((s, i) => s.rolSistemRoluMu(i, temelRol))).toBe(true);
    expect(await sor((s, i) => s.rolSistemRoluMu(i, superadminRol))).toBe(
      true,
    );
    expect(await sor((s, i) => s.rolSistemRoluMu(i, kodsuz))).toBe(false);
    expect(await sor((s, i) => s.rolSistemRoluMu(i, randomUUID()))).toBe(
      false,
    );
  });

  it('bu grup kök grup mu: evet üstü olmayan grup; hayır alt grup ve var olmayan grup', async () => {
    const alt = await grupEkle(kokGrup);
    expect(await sor((s, i) => s.grupKokMu(i, kokGrup))).toBe(true);
    expect(await sor((s, i) => s.grupKokMu(i, alt))).toBe(false);
    expect(await sor((s, i) => s.grupKokMu(i, randomUUID()))).toBe(false);
  });

  it('bu kişi pasif mi: evet pasif zamanı dolu; hayır etkin kişi ve var olmayan kişi', async () => {
    const etkin = await kisiEkle(yeniAd());
    const pasif = await kisiEkle(yeniAd());
    await ortam.db.query(
      'update kullanici set pasif_zamani = clock_timestamp() where id = $1',
      [pasif],
    );
    expect(await sor((s, i) => s.kisiPasifMi(i, pasif))).toBe(true);
    expect(await sor((s, i) => s.kisiPasifMi(i, etkin))).toBe(false);
    expect(await sor((s, i) => s.kisiPasifMi(i, randomUUID()))).toBe(false);
  });

  it('bu kişi unutulmuş mu: evet unutulma zamanı dolu; hayır unutulmamış kişi ve var olmayan kişi', async () => {
    const olagan = await kisiEkle(yeniAd());
    const unutulmus = await kisiEkle(yeniAd());
    await ortam.db.query(
      'update kullanici set unutulma_zamani = clock_timestamp() where id = $1',
      [unutulmus],
    );
    expect(await sor((s, i) => s.kisiUnutulmusMu(i, unutulmus))).toBe(true);
    expect(await sor((s, i) => s.kisiUnutulmusMu(i, olagan))).toBe(false);
    expect(await sor((s, i) => s.kisiUnutulmusMu(i, randomUUID()))).toBe(
      false,
    );
  });

  it('bu kişi sistem aktörü mü: evet kimlik sistem aktörü; hayır olağan kişi ve var olmayan kişi', async () => {
    const olagan = await kisiEkle(yeniAd());
    expect(await sor((s, i) => s.kisiSistemAktoruMu(i, sistemAktoru))).toBe(
      true,
    );
    expect(await sor((s, i) => s.kisiSistemAktoruMu(i, olagan))).toBe(false);
    expect(await sor((s, i) => s.kisiSistemAktoruMu(i, randomUUID()))).toBe(
      false,
    );
  });

  it('bu kişinin kullanıcı adı dolu mu: evet adı olan kişi; hayır adsız kişi ve var olmayan kişi', async () => {
    const adli = await kisiEkle(yeniAd());
    const adsiz = await kisiEkle(null);
    expect(await sor((s, i) => s.kullaniciAdiDoluMu(i, adli))).toBe(true);
    expect(await sor((s, i) => s.kullaniciAdiDoluMu(i, adsiz))).toBe(false);
    expect(await sor((s, i) => s.kullaniciAdiDoluMu(i, randomUUID()))).toBe(
      false,
    );
  });

  it('bu izin katalogda var mı: evet katalogdaki izin; hayır var olmayan kimlik', async () => {
    expect(await sor((s, i) => s.izinKatalogdaMi(i, grupOkuIzni))).toBe(true);
    expect(await sor((s, i) => s.izinKatalogdaMi(i, randomUUID()))).toBe(
      false,
    );
  });
});

describe('b) künyeler', () => {
  it('üyelik künyesi canlı ve silinmiş üyelikte kimlikleri ve canlılığı verir; var olmayan kimlikte tanımsızdır', async () => {
    const kisi = await kisiEkle(yeniAd());
    const grup = await grupEkle(kokGrup);
    const rol = await rolEkle(null);
    const canli = await uyelikEkle(kisi, grup, rol);
    const silinmis = await uyelikEkle(kisi, grup, rol, true);
    expect(await sor((s, i) => s.uyelikKunyesi(i, canli))).toEqual({
      kullaniciId: kisi,
      grupId: grup,
      rolId: rol,
      canli: true,
    });
    expect(await sor((s, i) => s.uyelikKunyesi(i, silinmis))).toEqual({
      kullaniciId: kisi,
      grupId: grup,
      rolId: rol,
      canli: false,
    });
    expect(
      await sor((s, i) => s.uyelikKunyesi(i, randomUUID())),
    ).toBeUndefined();
  });

  it('izin künyesi kaynak ve eylemi verir; var olmayan kimlikte tanımsızdır', async () => {
    expect(await sor((s, i) => s.izinKunyesi(i, grupOkuIzni))).toEqual({
      kaynak: 'Grup',
      eylem: 'oku',
    });
    expect(await sor((s, i) => s.izinKunyesi(i, randomUUID()))).toBeUndefined();
  });
});

describe('c) parola sırrı parçası', () => {
  const IS_ADI = 'test:kimlik-cekirdek-ekleri';

  function sirriSil(kullaniciId: string): Promise<void> {
    const iz: IzBilgisi = { yazanId: sistemAktoru, isAdi: IS_ADI };
    return ortam.app.get(UnitOfWork).run(async (islem) => {
      // Parça kişi kilidinin çağıran tarafından alınmış olmasını bekler.
      await ortam.app.get(KisiKilidi).kilitle(islem, kullaniciId);
      await ortam.app.get(ParolaSirri).sil(islem, kullaniciId, iz);
    });
  }

  async function sirNotlari(kullaniciId: string): Promise<string[]> {
    const { rows } = await ortam.db.query<{ metin: string }>(
      `select govde::text as metin from outbox_iz
        where govde->>'kaynak' = 'KullaniciSirri' and govde->>'kayit_id' = $1
        order by olusturma_zamani`,
      [kullaniciId],
    );
    return rows.map((satir) => satir.metin);
  }

  it('sırrı olan kişide satır silinir ve parola özetini taşımayan bir silme notu yazılır', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    const {
      rows: [sir],
    } = await ortam.db.query<{ parola_ozeti: string; guncelleme_zamani: Date }>(
      'select parola_ozeti, guncelleme_zamani from kullanici_sirri where kullanici_id = $1',
      [kisi.id],
    );
    expect(sir).toBeDefined();

    await sirriSil(kisi.id);

    const { rowCount } = await ortam.db.query(
      'select 1 from kullanici_sirri where kullanici_id = $1',
      [kisi.id],
    );
    expect(rowCount).toBe(0);
    const notlar = await sirNotlari(kisi.id);
    expect(notlar).toHaveLength(1);
    const [metin] = notlar;
    expect(metin).not.toContain(sir?.parola_ozeti);
    expect(JSON.parse(metin ?? '{}')).toMatchObject({
      eylem: 'silme',
      kaynak: 'KullaniciSirri',
      kayit_id: kisi.id,
      kullanici_id: sistemAktoru,
      veri_sahibi_kullanici_id: kisi.id,
      is_adi: IS_ADI,
      degisen: {
        kullanici_id: { eski: kisi.id },
        guncelleme_zamani: { eski: sir?.guncelleme_zamani.toISOString() },
      },
    });
  });

  it('sırrı olmayan kişide hata vermez ve not yazmaz', async () => {
    const kisi = await kisiEkle(yeniAd());
    await expect(sirriSil(kisi)).resolves.toBeUndefined();
    expect(await sirNotlari(kisi)).toEqual([]);
  });
});

describe('d) sorular ve künyeler isteyenin yeteneğinden bağımsızdır', () => {
  it('yetkisi olmayan oturumsuz isteğin içinde de aynı cevabı verir', async () => {
    const pasif = await kisiEkle(yeniAd());
    await ortam.db.query(
      'update kullanici set pasif_zamani = clock_timestamp() where id = $1',
      [pasif],
    );
    const grup = await grupEkle(kokGrup);
    const uyelik = await uyelikEkle(pasif, grup, temelRol, true);
    istekteSorulacak = async (s, i) => ({
      temelSistemRolu: await s.rolSistemRoluMu(i, temelRol),
      kokGrupKok: await s.grupKokMu(i, kokGrup),
      pasifPasif: await s.kisiPasifMi(i, pasif),
      superadminUnutulmus: await s.kisiUnutulmusMu(i, ortam.superadmin.id),
      aktorSistemAktoru: await s.kisiSistemAktoruMu(i, sistemAktoru),
      superadminAdiDolu: await s.kullaniciAdiDoluMu(i, ortam.superadmin.id),
      izinKatalogda: await s.izinKatalogdaMi(i, grupOkuIzni),
      uyelikKunyesi: await s.uyelikKunyesi(i, uyelik),
      izinKunyesi: await s.izinKunyesi(i, grupOkuIzni),
    });
    try {
      // Oturumsuz istek: bağlamda derlenmiş yetki hiç yoktur; yetki kapısından okunsaydı hiçbir
      // satır görünmezdi.
      const cevap = await request(ortam.app.getHttpServer()).get(
        '/cekirdek-ekleri-sinama/sor',
      );
      expect(cevap.status).toBe(200);
      expect(cevap.body).toEqual({
        kuralSayisi: -1,
        cevaplar: {
          temelSistemRolu: true,
          kokGrupKok: true,
          pasifPasif: true,
          superadminUnutulmus: false,
          aktorSistemAktoru: true,
          superadminAdiDolu: true,
          izinKatalogda: true,
          uyelikKunyesi: {
            kullaniciId: pasif,
            grupId: grup,
            rolId: temelRol,
            canli: false,
          },
          izinKunyesi: { kaynak: 'Grup', eylem: 'oku' },
        },
      });
    } finally {
      istekteSorulacak = undefined;
    }
  });
});
