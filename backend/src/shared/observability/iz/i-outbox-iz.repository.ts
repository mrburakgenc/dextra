import { RepoBelirteci } from '../../database/domain/repo-belirteci.js';

// Aktarılmayı bekleyen değişiklik kaydı notu. Zaman metin olarak okunur: JavaScript Date
// milisaniyede keser, veritabanı mikrosaniye tutar.
export interface OutboxIzNotu {
  id: string;
  govde: Record<string, unknown>;
  olusturmaZamani: string;
}

export interface OutboxIzOlculeri {
  // Hiç denenmemiş (deneme_sayisi 0) ve aktarılmamış en eski notun yaşı; böyle not yoksa null.
  enEskiDenenmemisYasSn: number | null;
  // Denenmiş ama aktarılamamış not sayısı.
  denenmisBekleyenSayisi: number;
}

// İşlem dışı okuma yüzü: yalnız ölçüler; kilit almaz.
export interface OutboxIzOkuma {
  olculer(): Promise<OutboxIzOlculeri>;
}

export interface OutboxIzRepo extends OutboxIzOkuma {
  // Aktarılmamış, sürümü bilinen ve ertelenmemiş en çok `enCok` notu, başka işlemin kilitlediklerini
  // atlayarak kilitler. Sıra güvencesi yoktur.
  aktarilacaklariKilitle(
    enCok: number,
    bilinenSurum: number,
  ): Promise<OutboxIzNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
  // Satır hatası veren notun deneme sayısını bir artırır, sonraki denemeyi ileri atar ve hatanın
  // sınıfını yazar. Not silinmez.
  satirHatasiIsaretle(kimlik: string, sonHata: string): Promise<void>;
  // Aktarımının üzerinden saklama süresi geçmiş en çok `enCok` notu siler, silinen sayıyı döner.
  // Aktarılmamış not yaşına bakılmadan kalır.
  eskileriSil(enCok: number): Promise<number>;
}

// Notlar işlem içinde, kilitlenerek alınır; işlem dışı okuma yalnız ölçüleri verir.
export const OUTBOX_IZ_REPO = new RepoBelirteci<OutboxIzOkuma, OutboxIzRepo>(
  'OutboxIzRepo',
);
