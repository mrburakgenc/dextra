// Çekirdek repository: bütünlük sorularının okumalarını yetki kapısından geçmeden yapar (KR-010
// Seçim 48'in adıyla istisnası; TS-002 "Yapı", "bütünlük sorusu"). Her metot yalnız evet ya da hayır
// döner, satır vermez; istisnası iki künyedir (TS-002 AK-43), onlar satırın yalnız sayılan alanlarını
// verir. Yalnız kimlik/_shared içindeki bütünlük sorusu parçası kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

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

export interface ButunlukCekirdekRepo {
  kokSuperAdminUyesiMi(kullaniciId: string): Promise<boolean>;
  // Girebilen canlı (Kök, SuperAdmin) üyelerinin kümesi tam olarak bu kişi mi.
  sonGirebilenKokSuperAdminMi(kullaniciId: string): Promise<boolean>;
  grupCanliMi(grupId: string): Promise<boolean>;
  rolCanliMi(rolId: string): Promise<boolean>;
  kokSuperAdminKumesiMi(grupId: string, rolId: string): Promise<boolean>;
  // Canlı alt grubu, canlı üyeliği ve canlı yeteneği yok mu.
  grupBosMu(grupId: string): Promise<boolean>;
  // Canlı üyeliği ve canlı yeteneği yok mu.
  rolBosMu(rolId: string): Promise<boolean>;
  // Yeni üst, taşınan grubun kendisi ya da altındakilerden biri mi: yeni üstten köke doğru yürünür.
  tasimaDonguYaparMi(grupId: string, yeniUstGrupId: string): Promise<boolean>;
  // TS-002 AK-43 ekleri. Kayıt yoksa hayır döner.
  rolSistemRoluMu(rolId: string): Promise<boolean>;
  grupKokMu(grupId: string): Promise<boolean>;
  kisiPasifMi(kullaniciId: string): Promise<boolean>;
  kisiUnutulmusMu(kullaniciId: string): Promise<boolean>;
  kisiSistemAktoruMu(kullaniciId: string): Promise<boolean>;
  kullaniciAdiDoluMu(kullaniciId: string): Promise<boolean>;
  izinKatalogdaMi(izinId: string): Promise<boolean>;
  // Künyeler (TS-002 AK-43); kayıt yoksa undefined.
  uyelikKunyesi(uyelikId: string): Promise<UyelikKunyesi | undefined>;
  izinKunyesi(izinId: string): Promise<IzinKunyesi | undefined>;
}

export interface UyelikKunyesi {
  kullaniciId: string;
  grupId: string;
  rolId: string;
  // Silinme zamanı boş mu.
  canli: boolean;
}

export interface IzinKunyesi {
  kaynak: string;
  eylem: string;
}

// Okuma görünümü boştur: sorular çağıranın işleminde sorulur.
export const BUTUNLUK_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  ButunlukCekirdekRepo
>('ButunlukCekirdekRepo');

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
