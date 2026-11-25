// ButunlukCekirdekRepo'nun gerçeklemesi: bütünlük sorularının okumalarını işlemin istemcisiyle, yetki
// kapısından geçmeden yapar (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { ButunlukCekirdekRepo } from '../../domain/repositories/i-butunluk-cekirdek.repository.js';

// SuperAdmin rolünün saklanan kodu (TS-002 AK-3).
const SUPERADMIN_ROL_KODU = 'superadmin';

// Canlı (Kök, SuperAdmin) üyeliği: kök grup üstü olmayan canlı tek gruptur (değişmez 1).
const KOK_SUPERADMIN_UYELIGI = {
  silinmeZamani: null,
  grup: { ustGrupId: null, silinmeZamani: null },
  rol: { kod: SUPERADMIN_ROL_KODU },
};

// Girebilen kişi: pasif, unutulmuş ve sistem aktörü değil; açık giriş yöntemi parola olduğu için
// kullanıcı adı ve parola sırrı olan (değişmez 4 ve 18).
const GIREBILEN_KISI = {
  sistemAktoru: false,
  pasifZamani: null,
  unutulmaZamani: null,
  kullaniciAdi: { not: null },
  sirri: { isNot: null },
};

export function butunlukCekirdekRepo(
  istemci: RepoIstemcisi,
): ButunlukCekirdekRepo {
  return {
    kokSuperAdminUyesiMi: async (kullaniciId) =>
      (await istemci.uyelik.findFirst({
        where: { kullaniciId, ...KOK_SUPERADMIN_UYELIGI },
        select: { id: true },
      })) !== null,
    // Kişide canlı (Kök, SuperAdmin) üyeliği en çok birdir (canlı üçlünün tekil kısıtı); iki satır
    // okumak "başka girebilen var mı"yı cevaplamaya yeter.
    sonGirebilenKokSuperAdminMi: async (kullaniciId) => {
      const girebilenler = await istemci.uyelik.findMany({
        where: { ...KOK_SUPERADMIN_UYELIGI, kullanici: GIREBILEN_KISI },
        select: { kullaniciId: true },
        take: 2,
      });
      return (
        girebilenler.length === 1 &&
        girebilenler[0]?.kullaniciId === kullaniciId
      );
    },
    grupCanliMi: async (grupId) =>
      (await istemci.grup.findFirst({
        where: { id: grupId, silinmeZamani: null },
        select: { id: true },
      })) !== null,
    rolCanliMi: async (rolId) =>
      (await istemci.rol.findFirst({
        where: { id: rolId, silinmeZamani: null },
        select: { id: true },
      })) !== null,
    kokSuperAdminKumesiMi: async (grupId, rolId) =>
      (await istemci.grup.findFirst({
        where: { id: grupId, ...KOK_SUPERADMIN_UYELIGI.grup },
        select: { id: true },
      })) !== null &&
      (await istemci.rol.findFirst({
        where: { id: rolId, ...KOK_SUPERADMIN_UYELIGI.rol },
        select: { id: true },
      })) !== null,
    grupBosMu: async (grupId) =>
      (await istemci.grup.findFirst({
        where: { ustGrupId: grupId, silinmeZamani: null },
        select: { id: true },
      })) === null &&
      (await istemci.uyelik.findFirst({
        where: { grupId, silinmeZamani: null },
        select: { id: true },
      })) === null &&
      (await istemci.yetenek.findFirst({
        where: { grupId, silinmeZamani: null },
        select: { id: true },
      })) === null,
    rolBosMu: async (rolId) =>
      (await istemci.uyelik.findFirst({
        where: { rolId, silinmeZamani: null },
        select: { id: true },
      })) === null &&
      (await istemci.yetenek.findFirst({
        where: { rolId, silinmeZamani: null },
        select: { id: true },
      })) === null,
    tasimaDonguYaparMi: async (grupId, yeniUstGrupId) => {
      let sonraki: string | null = yeniUstGrupId;
      while (sonraki !== null) {
        if (sonraki === grupId) {
          return true;
        }
        const satir: { ustGrupId: string | null } | null =
          await istemci.grup.findUnique({
            where: { id: sonraki },
            select: { ustGrupId: true },
          });
        sonraki = satir?.ustGrupId ?? null;
      }
      return false;
    },
    rolSistemRoluMu: async (rolId) =>
      (await istemci.rol.findFirst({
        where: { id: rolId, kod: { not: null } },
        select: { id: true },
      })) !== null,
    grupKokMu: async (grupId) =>
      (await istemci.grup.findFirst({
        where: { id: grupId, ustGrupId: null },
        select: { id: true },
      })) !== null,
    kisiPasifMi: async (kullaniciId) =>
      (await istemci.kullanici.findFirst({
        where: { id: kullaniciId, pasifZamani: { not: null } },
        select: { id: true },
      })) !== null,
    kisiUnutulmusMu: async (kullaniciId) =>
      (await istemci.kullanici.findFirst({
        where: { id: kullaniciId, unutulmaZamani: { not: null } },
        select: { id: true },
      })) !== null,
    kisiSistemAktoruMu: async (kullaniciId) =>
      (await istemci.kullanici.findFirst({
        where: { id: kullaniciId, sistemAktoru: true },
        select: { id: true },
      })) !== null,
    kullaniciAdiDoluMu: async (kullaniciId) =>
      (await istemci.kullanici.findFirst({
        where: { id: kullaniciId, kullaniciAdi: { not: null } },
        select: { id: true },
      })) !== null,
    izinKatalogdaMi: async (izinId) =>
      (await istemci.izin.findUnique({
        where: { id: izinId },
        select: { id: true },
      })) !== null,
    uyelikKunyesi: async (uyelikId) => {
      const satir = await istemci.uyelik.findUnique({
        where: { id: uyelikId },
        select: {
          kullaniciId: true,
          grupId: true,
          rolId: true,
          silinmeZamani: true,
        },
      });
      if (satir === null) {
        return undefined;
      }
      const { silinmeZamani, ...kimlikler } = satir;
      return { ...kimlikler, canli: silinmeZamani === null };
    },
    izinKunyesi: async (izinId) =>
      (await istemci.izin.findUnique({
        where: { id: izinId },
        select: { kaynak: true, eylem: true },
      })) ?? undefined,
  };
}
