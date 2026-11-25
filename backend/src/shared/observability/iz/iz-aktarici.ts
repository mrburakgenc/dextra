import {
  IZ_BAGLANMA_SURE_SINIRI_MS,
  IZ_YAZIM_SURE_SINIRI_MS,
} from '../../database/database.module.js';
import {
  type PrismaClient as IzPrismaClient,
  Prisma as IzPrisma,
} from '../../database/iz/generated/client.js';
import {
  ISLEM_SURE_SINIRI_MS,
  type UnitOfWork,
} from '../../database/infrastructure/unit-of-work.js';
import { Dongu } from '../../messaging/infrastructure/aktarim/dongu.js';
import {
  OUTBOX_IZ_REPO,
  type OutboxIzOlculeri,
} from './outbox-iz.repository.js';

// Bir geçişte en çok alınan not sayısı.
export const PARTI_BOYU = 100;
// Aktarıcının anladığı gövde sürümü; daha büyük sürümlü not alınmaz (TS-003 değişmez 4).
export const BILINEN_SURUM = 1;
// Parti dolu gelmediyse döngünün yeniden okumadan önce beklediği süre.
export const BOS_BEKLEME_MS = 1000;
// Parti hatasından sonra bekleme: ilk hatada taban, her ardışık hatada iki katı, üst sınırda durur.
export const PARTI_HATASI_TABAN_BEKLEME_MS = 1000;
export const PARTI_HATASI_UST_BEKLEME_MS = 60_000;
// Temizlik döngüsünün iki koşusu arasındaki süre ve bir temizlik partisinde en çok silinen not.
export const TEMIZLIK_ARALIGI_MS = 3_600_000;
export const TEMIZLIK_PARTI_BOYU = 1000;
// İşlemin sonunda asıl veritabanındaki işaretlemelere ayrılan süre.
const ISARETLEME_PAYI_MS = 1000;
// Geçişin başından bu kadar süre geçtiyse yeni bir tek tek deneme başlatılmaz: en uzun deneme
// (yeni bağlantı kurma süresi + ifade süresi) ve işaretleme payı asıl işlemin süre sınırına sığar
// (TS-003 sözleşme 6). Değerler: 5000 - (1000 + 1000) - 1000 = 2000 ms.
const EN_UZUN_DENEME_MS = IZ_BAGLANMA_SURE_SINIRI_MS + IZ_YAZIM_SURE_SINIRI_MS;
const TEK_TEK_DENEME_SINIRI_MS =
  ISLEM_SURE_SINIRI_MS - EN_UZUN_DENEME_MS - ISARETLEME_PAYI_MS;

// Partinin tamamını etkileyen hata: işlem geri alındı, hiçbir notun alanı değişmedi.
// Asıl hata `cause` içindedir; `code` onun SQLSTATE'idir (yoksa undefined). Döngü günlüğe yalnız
// sınıfı ve bu kodu yazar.
export class PartiHatasi extends Error {
  readonly code: string | undefined;

  constructor(cause: unknown) {
    super('İz aktarımında parti hatası; işlem geri alındı', { cause });
    this.name = 'PartiHatasi';
    this.code = surucuKodu(cause);
  }
}

// Prisma'nın ham sorgu hatasında (P2010) sürücünün taşıdığı SQLSTATE; yoksa undefined.
function surucuKodu(hata: unknown): string | undefined {
  if (
    !(hata instanceof IzPrisma.PrismaClientKnownRequestError) ||
    hata.code !== 'P2010'
  ) {
    return undefined;
  }
  const surucuHatasi = hata.meta?.['driverAdapterError'] as
    { cause?: { originalCode?: unknown } } | undefined;
  const kod = surucuHatasi?.cause?.originalCode;
  return typeof kod === 'string' ? kod : undefined;
}

// Hata sınıflama kuralı (TS-003 sözleşme 4). Satır hatası yalnız şudur: Prisma'nın ham sorgu hatası
// (P2010) ve sürücünün taşıdığı SQLSTATE ya 22 sınıfındadır (data exception: gövdedeki değer kolon
// türüne uymuyor, ör. 22P02 bozuk uuid) ya da 23502'dir (not_null_violation: gövdede zorunlu alan
// yok). İkisi de yalnız satırın verisinden doğar. Bağlantı hatası (SQLSTATE yoktur), süre aşımı
// (57014, 55P03), tablo ya da kolon yok (42P01, 42703) ve tanınmayan her hata parti hatasıdır.
// Satır hatasıysa SQLSTATE'i döner, değilse undefined.
function satirHatasiKodu(hata: unknown): string | undefined {
  const kod = surucuKodu(hata);
  if (kod === undefined) {
    return undefined;
  }
  return kod.startsWith('22') || kod === '23502' ? kod : undefined;
}

type IzSatiri = Record<string, unknown> & { id: string };

// Satır hatası: SQLSTATE ve sürücünün asıl hatası.
interface SatirHatasi {
  kod: string;
  hata: unknown;
}

// outbox_iz notlarını iz veritabanının degisiklik_kaydi tablosuna taşır (TS-003 sözleşme 1–6, 9).
// İz veritabanına Unit of Work değil, bu parça kendi istemcisiyle yazar (KR-011).
export class IzAktarici {
  private readonly aktarimDongusu = new Dongu({
    ad: 'iz-aktarim',
    adim: async () => (await this.gecis()) === PARTI_BOYU,
    bosBeklemeMs: BOS_BEKLEME_MS,
    hataBeklemeTabanMs: PARTI_HATASI_TABAN_BEKLEME_MS,
    hataBeklemeUstMs: PARTI_HATASI_UST_BEKLEME_MS,
  });
  private readonly temizlikDongusu = new Dongu({
    ad: 'iz-temizlik',
    adim: async () => (await this.temizle()) === TEMIZLIK_PARTI_BOYU,
    bosBeklemeMs: TEMIZLIK_ARALIGI_MS,
    hataBeklemeTabanMs: PARTI_HATASI_TABAN_BEKLEME_MS,
    hataBeklemeUstMs: PARTI_HATASI_UST_BEKLEME_MS,
  });

  constructor(
    private readonly uow: UnitOfWork,
    private readonly izIstemci: IzPrismaClient,
  ) {}

  // Aktarım ve temizlik döngülerini başlatır; ikisi de hemen bir kez koşar.
  baslat(): void {
    this.aktarimDongusu.baslat();
    this.temizlikDongusu.baslat();
  }

  // Süren geçişi bitirir; döndükten sonra açık zamanlayıcı kalmaz.
  async durdur(): Promise<void> {
    await Promise.all([
      this.aktarimDongusu.durdur(),
      this.temizlikDongusu.durdur(),
    ]);
  }

  // Bir parti notu işler ve sonuçlanan (aktarılan ya da satır hatasıyla ertelenen) not sayısını
  // döner. Parti hatasında işlem geri alınır ve PartiHatasi atılır.
  async gecis(): Promise<number> {
    try {
      return await this.uow.run(async (islem) => {
        const baslangic = performance.now();
        const repo = islem.repo(OUTBOX_IZ_REPO);
        const notlar = await repo.aktarilacaklariKilitle(
          PARTI_BOYU,
          BILINEN_SURUM,
        );
        if (notlar.length === 0) {
          return 0;
        }
        // Gövdenin anahtarları kolon adlarıdır; kimlik ve oluşma zamanı notun kendisinden gelir.
        const satirlar = notlar.map((not) => ({
          ...not.govde,
          id: not.id,
          olusma_zamani: not.olusturmaZamani,
        }));
        if ((await this.izeYaz(satirlar)) === undefined) {
          await repo.aktarildiIsaretle(satirlar.map((satir) => satir.id));
          return satirlar.length;
        }
        // Toplu yazımı bir satırın verisi bozdu; satırlar tek tek denenir. Süreye sığmayanlar
        // dokunulmadan sonraki geçişe kalır.
        const aktarilanlar: string[] = [];
        const hatalilar: (SatirHatasi & { id: string })[] = [];
        for (const satir of satirlar) {
          if (performance.now() - baslangic > TEK_TEK_DENEME_SINIRI_MS) {
            break;
          }
          const satirHatasi = await this.izeYaz([satir]);
          if (satirHatasi === undefined) {
            aktarilanlar.push(satir.id);
          } else {
            hatalilar.push({ id: satir.id, ...satirHatasi });
          }
        }
        // Parti mi, satır mı: birden çok satırlı partinin bütün satırları denendi ve hepsi aynı
        // SQLSTATE ile düştüyse sorun satırların verisinde değil iz tarafındadır (ör. iz şeması
        // kırıcı biçimde değişti); hiçbir satıra damga vurulmaz, asıl hata atılır, işlem geri
        // alınır. Hiçbir satır yazılmadığı için iz tarafında da geri alınacak bir şey yoktur.
        // Sınır: tek satırlık partide bu ayrım yapılamaz; o satır satır hatası sayılıp ertelenir.
        const [ilkHata] = hatalilar;
        if (
          satirlar.length > 1 &&
          ilkHata !== undefined &&
          hatalilar.length === satirlar.length &&
          hatalilar.every((satirHatasi) => satirHatasi.kod === ilkHata.kod)
        ) {
          throw ilkHata.hata;
        }
        for (const satirHatasi of hatalilar) {
          // Yalnız sınıf yazılır; hatanın metni gövdedeki değeri taşıyabilir.
          await repo.satirHatasiIsaretle(
            satirHatasi.id,
            `SQLSTATE ${satirHatasi.kod}`,
          );
        }
        await repo.aktarildiIsaretle(aktarilanlar);
        return aktarilanlar.length + hatalilar.length;
      });
    } catch (hata) {
      throw new PartiHatasi(hata);
    }
  }

  // Aktarımının üzerinden saklama süresi geçmiş bir parti notu siler, silinen sayıyı döner.
  async temizle(): Promise<number> {
    return this.uow.run((islem) =>
      islem.repo(OUTBOX_IZ_REPO).eskileriSil(TEMIZLIK_PARTI_BOYU),
    );
  }

  olculer(): Promise<OutboxIzOlculeri> {
    return this.uow.read(OUTBOX_IZ_REPO).olculer();
  }

  // Tek ifade, açık işleme sarılmaz, kendi başına onaylanır. Aynı kimlik ikinci kez yazılmaz, hata
  // da vermez. Başarıda undefined, satır hatasında SQLSTATE ve asıl hata döner; parti hatası atılır.
  private async izeYaz(
    satirlar: readonly IzSatiri[],
  ): Promise<SatirHatasi | undefined> {
    try {
      await this.izIstemci.$executeRaw`
        insert into degisiklik_kaydi (
          id, istek_id, kullanici_id, uyelik_id, yetenek_id, is_adi, baslatan_kullanici_id,
          veri_sahibi_kullanici_id, kaynak, kayit_id, eylem, degisen, olusma_zamani)
        select id, istek_id, kullanici_id, uyelik_id, yetenek_id, is_adi, baslatan_kullanici_id,
               veri_sahibi_kullanici_id, kaynak, kayit_id, eylem, degisen, olusma_zamani
          from jsonb_to_recordset(${JSON.stringify(satirlar)}::jsonb) as s(
                 id uuid, istek_id uuid, kullanici_id uuid, uyelik_id uuid, yetenek_id uuid,
                 is_adi text, baslatan_kullanici_id uuid, veri_sahibi_kullanici_id uuid,
                 kaynak text, kayit_id uuid, eylem text, degisen jsonb, olusma_zamani timestamptz)
        on conflict (id) do nothing`;
      return undefined;
    } catch (hata) {
      const kod = satirHatasiKodu(hata);
      if (kod === undefined) {
        throw hata;
      }
      return { kod, hata };
    }
  }
}
