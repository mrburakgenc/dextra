// Tüketici tabanı (KR-012 Kural 3 eki): olayı "işledim" kaydıyla korunarak işler. Kayıt işin
// işlemiyle aynı işlemde yazılmaz; ayrı tabloda süreli sahiplenmeyle tutulur. Sıra: sahiplen →
// işleyiciyi çağır → tamamlandı yaz; işleyici hata atarsa sahiplenme bırakılır.
// Kabul edilen sınır: işleyici başarıyla bitip "tamamlandı" yazılamadan süreç ölürse süre dolunca
// olay yeniden işlenir. Bu yüzden işleyicinin çağırdığı komut tekrar güvenli yazılır.
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { yeniKimlik } from '../../../database/domain/kimlik.js';
import type { UnitOfWork } from '../../../database/infrastructure/unit-of-work.js';
import type { IsKuyrugu, KuyrukIsi } from '../../domain/kuyruk/is-kuyrugu.js';
import { ISLENEN_OLAY_REPO } from '../../domain/tuketici/i-islenen-olay.repository.js';

// Sahiplenmenin süresi; dolunca başka işçi devralabilir. Kuyruğun yeniden deneme penceresi bundan
// uzun tutulur (testle): işçisi ölen olay, sahiplenme dolduktan sonraki bir denemede işlenir.
export const SAHIPLENME_SURESI_SN = 60;

const gunluk = new Logger('TuketiciTabani');

// İşleyiciye verilen zarf. Kuyruk işinin kimliği olayın kimliği, adı olayın adıdır; sürüm ve
// gövde işin verisindedir.
export interface Zarf {
  readonly id: string;
  readonly ad: string;
  readonly surum: number;
  readonly govde: Readonly<Record<string, unknown>>;
}

// İşleyici kendi işlemini kendisi açar; taban ona işlem nesnesi vermez. Hata atarsa olay yeniden denenir.
export type OlayIsleyici = (zarf: Zarf) => Promise<void>;

export interface Tuketici {
  // Dinleyiciyi kapatır.
  durdur(): Promise<void>;
}

const isVerisi = z.object({
  surum: z.number().int(),
  govde: z.record(z.string(), z.unknown()),
});

// Tüketici adıyla aynı adlı kuyruğu dinler.
export async function tuketiciBaslat(
  uow: UnitOfWork,
  kuyruk: IsKuyrugu,
  tuketici: string,
  isleyici: OlayIsleyici,
): Promise<Tuketici> {
  const dinleyici = await kuyruk.dinle(tuketici, (is) =>
    olayiIsle(uow, tuketici, isleyici, is),
  );
  return { durdur: () => dinleyici.kapat() };
}

async function olayiIsle(
  uow: UnitOfWork,
  tuketici: string,
  isleyici: OlayIsleyici,
  is: KuyrukIsi,
): Promise<void> {
  const { surum, govde } = isVerisi.parse(is.veri);
  const zarf: Zarf = { id: is.kimlik, ad: is.ad, surum, govde };
  // Her sahiplenme denemesi yeni sahip kimliğiyle yapılır; devralma da yeni kimlik yazar.
  const sahipId = yeniKimlik();

  const sonuc = await uow.run((islem) =>
    islem
      .repo(ISLENEN_OLAY_REPO)
      .sahiplen(tuketici, zarf.id, sahipId, SAHIPLENME_SURESI_SN),
  );
  if (sonuc === 'tamamlandi') {
    return;
  }
  if (sonuc === 'isleniyor') {
    // İş hatayla bırakılır; kuyruk yeniden dener.
    throw new Error(
      `${tuketici} için ${zarf.id} olayını başka bir işçi işliyor`,
    );
  }

  try {
    await isleyici(zarf);
  } catch (error) {
    // Bırakma da hata verirse çağırana işleyicinin özgün hatası gider; bırakma hatası yalnız
    // günlüğe yazılır (olayın gövdesi yazılmaz). Satır kalırsa sahiplenme dolunca devralınır.
    await uow
      .run((islem) =>
        islem.repo(ISLENEN_OLAY_REPO).birak(tuketici, zarf.id, sahipId),
      )
      .catch((birakmaHatasi: unknown) => {
        gunluk.error(
          `${tuketici} tüketicisi ${zarf.id} olayının sahiplenmesini bırakamadı: ${hataSinifi(birakmaHatasi)}`,
        );
      });
    throw error;
  }
  await uow.run((islem) =>
    islem.repo(ISLENEN_OLAY_REPO).tamamla(tuketici, zarf.id, sahipId),
  );
}

function hataSinifi(hata: unknown): string {
  return hata instanceof Error ? hata.constructor.name : typeof hata;
}
