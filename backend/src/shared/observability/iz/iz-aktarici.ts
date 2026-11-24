import type { UnitOfWork } from '../../database/unit-of-work.js';
import type { PrismaClient as IzPrismaClient } from '../../database/iz/generated/client.js';
import { OUTBOX_IZ_REPO } from './outbox-iz.repository.js';

// Bir geçişte en çok alınan not sayısı.
export const PARTI_BOYU = 100;
// Aktarıcının anladığı gövde sürümü; daha büyük sürümlü not alınmaz (TS-003 değişmez 4).
export const BILINEN_SURUM = 1;

// outbox_iz notlarını iz veritabanının degisiklik_kaydi tablosuna taşır (TS-003 sözleşme 1–3).
// İz veritabanına Unit of Work değil, bu parça kendi istemcisiyle yazar (KR-011).
export class IzAktarici {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly izIstemci: IzPrismaClient,
  ) {}

  // Bir parti notu taşır ve taşıdığı not sayısını döner. İz yazımı hata verirse hata olduğu gibi
  // atılır ve asıl işlem geri alınır; notlara dokunulmaz.
  async gecis(): Promise<number> {
    return this.uow.run(async (islem) => {
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
      // Tek ifade, kendi başına onaylanır. Aynı kimlik ikinci kez yazılmaz, hata da vermez.
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
      await repo.aktarildiIsaretle(notlar.map((not) => not.id));
      return notlar.length;
    });
  }
}
