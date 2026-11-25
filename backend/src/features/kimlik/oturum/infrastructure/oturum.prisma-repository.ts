import type { RepoIstemcisi } from '../../../../shared/database/registrar.js';
import { kimlikSistemAktoru } from '../../_shared/cekirdek/sistem-aktoru.js';
import { HAREKETSIZLIK_SINIRI_MS } from '../domain/oturum-denetimi.js';
import type { OturumRepo } from '../domain/oturum.repository.js';

export function oturumPrismaRepository(istemci: RepoIstemcisi): OturumRepo {
  return {
    kisininDurumu: async (kullaniciId) => {
      const satir = await istemci.kullanici.findUniqueOrThrow({
        where: { id: kullaniciId },
        select: { pasifZamani: true, unutulmaZamani: true, sistemAktoru: true },
      });
      return {
        pasif: satir.pasifZamani !== null,
        unutulmus: satir.unutulmaZamani !== null,
        sistemAktoru: satir.sistemAktoru,
      };
    },
    // Oturum denetimiyle aynı sınırlar: süresi "şimdi"ye eşit olan oturum açık sayılmaz.
    acikOturumlar: async (kullaniciId, simdi) => {
      const satirlar = await istemci.oturum.findMany({
        where: {
          kullaniciId,
          kapatilmaZamani: null,
          mutlakBitisZamani: { gt: simdi },
          sonDondurmeZamani: {
            gt: new Date(simdi.getTime() - HAREKETSIZLIK_SINIRI_MS),
          },
        },
        orderBy: [{ baslangicZamani: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      return satirlar.map(({ id }) => id);
    },
    // Tek oturuma dokunan yollar gibi "kapatılmamışsa kapat" diye koşullu günceller (TS-002 değişmez
    // 11). Zamanı uygulama saati verir (AK-21).
    kapat: async (idler, neden, kapatilmaZamani) => {
      const kapananlar = await istemci.oturum.updateManyAndReturn({
        where: { id: { in: [...idler] }, kapatilmaZamani: null },
        data: { kapatilmaZamani, kapatilmaNedeni: neden },
        select: { id: true },
      });
      return kapananlar.map(({ id }) => id);
    },
    ekle: async (oturum, sir) => {
      await istemci.oturum.create({ data: oturum, select: { id: true } });
      await istemci.oturumSirri.create({
        data: { oturumId: oturum.id, ...sir },
        select: { oturumId: true },
      });
    },
    // Kilit kişi kilidindeki yolla alınır: değer değiştirmeyen bir güncelleme (TS-002 "İşlem
    // sınırları", kilit kipi). Giriş yöntemi yazıldıktan sonra değişmediği için okunan değer aynen
    // geri yazılır. Satır kilitten sonra okunduğu için güncellemenin döndürdüğü değerler sondur.
    kilitleVeOku: async (oturumId, kullaniciId) => {
      const oturum = await istemci.oturum.findFirst({
        where: { id: oturumId, kullaniciId },
        select: { girisYontemi: true },
      });
      if (oturum === null) {
        return null;
      }
      const satir = await istemci.oturum.update({
        where: { id: oturumId },
        data: { girisYontemi: oturum.girisYontemi },
        select: {
          mutlakBitisZamani: true,
          sonDondurmeZamani: true,
          ipAdresi: true,
          tarayiciBilgisi: true,
          kapatilmaZamani: true,
          sirri: {
            select: {
              nesil: true,
              gecerliYenilemeOzeti: true,
              oncekiYenilemeOzeti: true,
              cihazSirriOzeti: true,
            },
          },
        },
      });
      const { kapatilmaZamani, sirri, ...oturumAlanlari } = satir;
      return {
        ...oturumAlanlari,
        kapali: kapatilmaZamani !== null,
        sir: sirri,
      };
    },
    kapatilmamislar: async (kullaniciId) => {
      const satirlar = await istemci.oturum.findMany({
        where: { kullaniciId, kapatilmaZamani: null },
        select: { id: true },
      });
      return satirlar.map(({ id }) => id);
    },
    dondur: async (oturumId, { sonDondurmeZamani, ...sir }) => {
      await istemci.oturum.update({
        where: { id: oturumId },
        data: { sonDondurmeZamani },
        select: { id: true },
      });
      await istemci.oturumSirri.update({
        where: { oturumId },
        data: sir,
        select: { oturumId: true },
      });
    },
    kimlikSistemAktoru: () => kimlikSistemAktoru(istemci),
  };
}
