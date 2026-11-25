// YetkiVerisiOkumaRepo'nun gerçeklemesi: yetki verisini ve sürümleri işlemsiz istemciyle, yetki
// kapısından geçmeden okur (KR-010 Seçim 48'in adıyla istisnası). Sürümler iki sorguyla (kişi, genel
// sayaç), öbür metotlar birer sorguyla okunur; sorgular arasında ortak anlık görüntü yoktur.
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import type { YetkiVerisiOkumaRepo } from '../../domain/repositories/i-yetki-verisi.repository.js';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export function yetkiVerisiRepo(istemci: RepoIstemcisi): YetkiVerisiOkumaRepo {
  return {
    surumler: async (kullaniciId) => {
      const kisi = await istemci.kullanici.findUniqueOrThrow({
        where: { id: kullaniciId },
        select: { yetkiSurumu: true },
      });
      const genel = await istemci.yetkiSurumu.findUniqueOrThrow({
        where: { id: GENEL_SAYAC_ID },
        select: { sayac: true },
      });
      return { kisiSurumu: kisi.yetkiSurumu, genelSurum: genel.sayac };
    },
    uyelikler: async (kullaniciId) =>
      (
        await istemci.uyelik.findMany({
          where: { kullaniciId, silinmeZamani: null },
          select: { id: true, grupId: true, rolId: true },
          orderBy: { id: 'asc' },
        })
      ).map(({ id, grupId, rolId }) => ({ uyelikId: id, grupId, rolId })),
    yetenekler: async (ciftler) =>
      (
        await istemci.yetenek.findMany({
          where: {
            silinmeZamani: null,
            OR: ciftler.map(({ grupId, rolId }) => ({ grupId, rolId })),
          },
          select: {
            id: true,
            grupId: true,
            rolId: true,
            sart: true,
            butunKayitlar: true,
            butunBirimler: true,
            kolonlar: true,
            butunKolonlar: true,
            izin: { select: { kaynak: true, eylem: true } },
          },
          orderBy: { id: 'asc' },
        })
      ).map((satir) => ({
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
      })),
    gruplar: () =>
      istemci.grup.findMany({ select: { id: true, ustGrupId: true } }),
  };
}
