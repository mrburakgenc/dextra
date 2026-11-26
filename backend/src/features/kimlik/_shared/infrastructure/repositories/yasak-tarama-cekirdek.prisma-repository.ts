// YasakTaramaCekirdekRepo'nun gerçeklemesi: canlı yasak satırlarını işlemsiz istemciyle, yetki
// kapısından geçmeden okur (KR-010 Seçim 48 eki). Yasaklar (izniyle) model arayüzüyle tek sorguda
// okunur; hiçbir şey yazılmaz.
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { YasakTaramaCekirdekRepo } from '../../domain/repositories/i-yasak-tarama-cekirdek.repository.js';

// Birinci aşamanın göçünden önceki veritabanında sorgu "kolon yok" (P2022) hatası verir; sürücü
// kolonu tablo adıyla bildirir (meta.driverAdapterError.cause.column). Yalnız bu iki kolon için
// gelen hata yakalanır. Hiç göç uygulanmamış veritabanında "tablo yok" (P2021) hatası gelir; sürücü
// tabloyu şemasıyla bildirir (meta.driverAdapterError.cause.table). Yalnız yetenek tablosu için gelen
// hata yakalanır (TS-008 AU-38). Başka her hata yükselir. Feature ham istemciye ulaşamadığı için hata
// sınıfıyla değil biçimiyle tanınır.
const IKI_KOLON: readonly unknown[] = ['yetenek.giremez', 'yetenek.oncelik'];

function tabloYaDaIkiKolonYok(hata: unknown): boolean {
  const { code, meta } = (hata ?? {}) as {
    code?: unknown;
    meta?: {
      driverAdapterError?: { cause?: { column?: unknown; table?: unknown } };
    };
  };
  return (
    (code === 'P2022' &&
      IKI_KOLON.includes(meta?.driverAdapterError?.cause?.column)) ||
    (code === 'P2021' &&
      meta?.driverAdapterError?.cause?.table === 'public.yetenek')
  );
}

export function yasakTaramaCekirdekRepo(
  istemci: RepoIstemcisi,
): YasakTaramaCekirdekRepo {
  return {
    canliYasaklar: async () => {
      let satirlar;
      try {
        satirlar = await istemci.yetenek.findMany({
          where: { silinmeZamani: null, giremez: true },
          select: {
            id: true,
            grupId: true,
            rolId: true,
            sart: true,
            butunKayitlar: true,
            butunBirimler: true,
            kolonlar: true,
            butunKolonlar: true,
            giremez: true,
            oncelik: true,
            izin: { select: { kaynak: true, eylem: true } },
          },
          orderBy: { id: 'asc' },
        });
      } catch (hata) {
        if (tabloYaDaIkiKolonYok(hata)) {
          return undefined;
        }
        throw hata;
      }
      return satirlar.map((satir) => ({
        yetenekId: satir.id,
        grupId: satir.grupId,
        rolId: satir.rolId,
        kaynak: satir.izin.kaynak,
        eylem: satir.izin.eylem,
        sart: satir.sart,
        butunKayitlar: satir.butunKayitlar,
        butunBirimler: satir.butunBirimler,
        kolonlar: satir.kolonlar,
        butunKolonlar: satir.butunKolonlar,
        giremez: satir.giremez,
        oncelik: satir.oncelik,
      }));
    },
  };
}
