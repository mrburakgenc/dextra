import 'server-only';
import { z } from 'zod';
import { backendIstegi } from '../../../shared/backend/istek';
import {
  listeyiGetir,
  yardimciListe,
} from '../../../shared/liste/liste-istegi';
import { sorguMetni } from '../../../shared/liste/sorgu';
import { IzinKaydi } from '../izin/izin-listesi';
import type { KayitSonucu } from '../kayit-istegi';
import type { TeshisSemasi } from '../semalar';
import type { Secenekler } from '../uyelik/uyelik-listesi';

// Yetenek teşhisi (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-32 ve AU-35): backend'in GET
// kimlik/yetenek/teshis sözleşmesi ön yüzde ayrı yazılır (KR-014). Cevapta kaydın kolon değerleri
// yoktur. Kararın açık mı alanı, karar değerlendirilemeyen bir kurala bağlıysa boştur (belirsiz);
// kararı veren, o kişide kolonu ya da kaydı veren izin yoksa boştur.

const Karar = z.object({
  acik: z.boolean().nullable(),
  kararVeren: z.string().nullable(),
});

const TeshisCevabi = z.object({
  tutanKurallar: z.array(
    z.object({
      yetenekId: z.string(),
      etki: z.enum(['izin', 'yasak']),
      oncelik: z.number(),
      butunKolonlar: z.boolean(),
      kolonlar: z.array(z.string()),
      muaf: z.boolean(),
      bozuk: z.boolean(),
      degerlendirilemedi: z.boolean(),
    }),
  ),
  kolonKararlari: z.array(Karar.extend({ kolon: z.string() })),
  kayitKarari: Karar,
  retKayitlari: z.array(
    z.object({
      zaman: z.string(),
      eylem: z.string(),
      kaynak: z.string(),
      kayitId: z.string().nullable(),
      kararVerenYasakId: z.string(),
    }),
  ),
});
export type TeshisCevabi = z.infer<typeof TeshisCevabi>;
export type TeshisKarari = z.infer<typeof Karar>;

export async function yetenekTeshisi(
  sorgu: z.output<typeof TeshisSemasi>,
): Promise<KayitSonucu<TeshisCevabi>> {
  const sonuc = await backendIstegi({
    yol: `/kimlik/yetenek/teshis${sorguMetni(sorgu)}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  return { basarili: true, kayit: TeshisCevabi.parse(sonuc.govde) };
}

// İzin seçimi GET kimlik/izin listesinin ilk 100 kaydından kurulur; 100 backend'in sayfa boyutu
// sınırıdır. Seçimin değeri ve yazısı 'Kaynak:eylem'dir; kaynağı ya da eylemi gelmeyen izin seçime
// girmez. Liste alınamazsa null döner, 401 oturum bitti yoluna gider.
export async function teshisIzinleri(): Promise<Secenekler | null> {
  const liste = yardimciListe(
    await listeyiGetir('/kimlik/izin', { sayfa: 1, boyut: 100 }, IzinKaydi),
  );
  if (liste === null) {
    return null;
  }
  return {
    kayitlar: liste.kayitlar.flatMap(({ kaynak, eylem }) =>
      kaynak === undefined || eylem === undefined
        ? []
        : [{ id: `${kaynak}:${eylem}`, etiket: `${kaynak}:${eylem}` }],
    ),
    dahaFazlasiVar: liste.sonrakiVar,
  };
}
