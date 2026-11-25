import { RepoBelirteci } from '../../../database/domain/repo-belirteci.js';

// Aktarılmayı bekleyen olay notu.
export interface OutboxOlayNotu {
  id: string;
  ad: string;
  surum: number;
  govde: Record<string, unknown>;
}

export interface OutboxOlayOlculeri {
  // Hiç denenmemiş (deneme_sayisi 0) ve aktarılmamış en eski notun yaşı; böyle not yoksa null.
  enEskiDenenmemisYasSn: number | null;
  // Denenmiş ama aktarılamamış not sayısı.
  denenmisBekleyenSayisi: number;
}

// İşlem dışı okuma yüzü: yalnız ölçüler; kilit almaz.
export interface OutboxOlayOkuma {
  olculer(): Promise<OutboxOlayOlculeri>;
}

export interface OutboxOlayRepo extends OutboxOlayOkuma {
  // Aktarılmamış ve ertelenmemiş en çok `enCok` notu, başka işlemin kilitlediklerini atlayarak
  // kilitler. Sıra güvencesi yoktur.
  aktarilacaklariKilitle(enCok: number): Promise<OutboxOlayNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
  // Kuyruklarından birine iş konamayan notun deneme sayısını bir artırır, sonraki denemeyi ileri
  // atar ve konamayan kuyrukla hatanın sınıfını yazar. Not silinmez.
  konamadiIsaretle(kimlik: string, sonHata: string): Promise<void>;
  // Aktarımının üzerinden saklama süresi geçmiş en çok `enCok` notu siler, silinen sayıyı döner.
  // Aktarılmamış not yaşına bakılmadan kalır.
  eskileriSil(enCok: number): Promise<number>;
}

// Notlar işlem içinde, kilitlenerek alınır; işlem dışı okuma yalnız ölçüleri verir.
export const OUTBOX_OLAY_REPO = new RepoBelirteci<
  OutboxOlayOkuma,
  OutboxOlayRepo
>('OutboxOlayRepo');
