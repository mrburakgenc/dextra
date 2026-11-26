import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { UnitOfWork } from '../../../../shared/database/infrastructure/unit-of-work.js';
import type {
  Islec,
  KisininSatirlari,
  SartOgesi,
  YerTutucu,
  YetenekSatiri,
  YetkiSurumleri,
  YetkiVerisi,
} from '../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';
import type { SistemAlanlari } from '../../../../shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import {
  type GrupDugumu,
  type SaklananYetenek,
  YETKI_VERISI_REPO,
} from '../domain/repositories/i-yetki-verisi.repository.js';

// Kimlik'in kaynak olan modelleri (TS-002 "Veri modeli"); kaynak kataloğu kök modülde bunlardan
// kurulur. Sırları taşıyan ve altyapı tabloları kaynak değildir.
export const KIMLIK_KAYNAKLARI = [
  'Kullanici',
  'Oturum',
  'Grup',
  'Rol',
  'Izin',
  'Uyelik',
  'Yetenek',
] as const;

// Kimlik kaynaklarına özgü, yalnız sistemin yazdığı alanlar (TS-002 "Veri modeli", çürütme 17; KR-008
// Seçim 34); kaynak kataloğu kök modülde bunlarla kurulur ve istek verisinden kabul edilmezler. Onları
// yalnız niyet eylemleri ve çekirdek parçalar yazar. Oturumun ortak sistem alanları dışındaki bütün
// alanları sistemindir. Düz güncellemeye kapalı öbür kolonlar (kullanıcı adı, telefon, üst grup)
// oluşturmada yazıldığı için burada değildir; onları uçların şemaları korur.
export const KIMLIK_SISTEM_ALANLARI: SistemAlanlari = {
  Kullanici: ['sistemAktoru', 'yetkiSurumu', 'pasifZamani', 'unutulmaZamani'],
  Rol: ['kod'],
  Yetenek: ['sistemSatiri', 'tohumAnahtari'],
  Oturum: [
    'kullaniciId',
    'girisYontemi',
    'baslangicZamani',
    'mutlakBitisZamani',
    'sonDondurmeZamani',
    'ipAdresi',
    'tarayiciBilgisi',
    'kapatilmaZamani',
    'kapatilmaNedeni',
  ],
};

// Kök yönetici rolünün saklanan kodu (TS-002 AK-3).
const KOK_YONETICI_ROL_KODU = 'superadmin';

// Saklanan şartın biçimi (TS-002 "Veri modeli"): öğelerin düz dizisi; her öğe tam olarak alan,
// işleç ve değer taşır. Göçten önceki yasak taraması da bunu kullanır (yasak-taramasi.ts).
const sabitDeger = z.union([z.string(), z.number(), z.boolean()]);
export const sartSemasi = z.array(
  z.strictObject({
    alan: z.string(),
    islec: z.enum([
      'esit',
      'esit_degil',
      'listede',
      'listede_degil',
      'kucuk',
      'kucuk_esit',
      'buyuk',
      'buyuk_esit',
    ] satisfies Islec[]),
    deger: z.union([
      sabitDeger,
      z.array(sabitDeger),
      z.strictObject({
        yerTutucu: z.enum([
          'isteyen',
          'yetenek_grubu',
          'yetenek_grubu_ve_alti',
        ] satisfies YerTutucu[]),
      }),
    ]),
  }),
) satisfies z.ZodType<SartOgesi[]>;

// YetkiVerisi sözleşmesinin uygulaması (TS-002 AK-16, AK-37): bir çekirdek yoldur. Önce sürümler,
// sonra canlı üyelikler, onların (grup, rol) çiftlerine bağlı canlı yetenekler ve silinmişler dahil
// grupların tamamı okunur. Şartının biçimi bozuk izin derlemeye verilmez ve günlüğe bildirilir; şartının
// biçimi bozuk yasak atılmaz, şartı boş ve bozuk işaretiyle verilir, derleyici onu bozuk yasak olarak
// derler (TS-008 "Derleme"; KU-017). Öbür yetenekler verilir (KR-010 yükümlülük 4). Okuma tek anlık görüntü değildir: sürümler önce
// okunduğu için arada yazılan yetki eski damgayla saklanır ve sonraki istekte yenilenir.
@Injectable()
export class KimlikYetkiVerisi implements YetkiVerisi {
  private readonly gunluk = new Logger(KimlikYetkiVerisi.name);

  constructor(private readonly uow: UnitOfWork) {}

  surumler(kullaniciId: string): Promise<YetkiSurumleri> {
    return this.uow.read(YETKI_VERISI_REPO).surumler(kullaniciId);
  }

  async kisininSatirlari(kullaniciId: string): Promise<KisininSatirlari> {
    const repo = this.uow.read(YETKI_VERISI_REPO);
    const surumler = await repo.surumler(kullaniciId);
    const uyelikler = await repo.uyelikler(kullaniciId);
    if (uyelikler.length === 0) {
      return { ...surumler, uyelikler, yetenekler: [], altGruplar: {} };
    }
    const saklananlar = await repo.yetenekler(uyelikler);
    const gruplar = await repo.gruplar();
    // Rol kodları yalnız satırlar arasında yasak varken okunur: yasağı olmayan kişi bugünkü sorguları
    // atar (TS-008 Değişmez 1) ve onda muafiyetin kapatacağı yasak yoktur.
    const kokYoneticiRolleri = new Set(
      saklananlar.some((satir) => satir.giremez)
        ? (await repo.rolKodlari(saklananlar.map((satir) => satir.rolId)))
            .filter((rol) => rol.kod === KOK_YONETICI_ROL_KODU)
            .map((rol) => rol.id)
        : [],
    );
    const yetenekler = this.biciminiDogrula(
      saklananlar,
      gruplar,
      kokYoneticiRolleri,
    );
    const altGruplar: Record<string, string[]> = {};
    for (const { grupId } of uyelikler) {
      altGruplar[grupId] ??= grupVeAltindakiler(grupId, gruplar);
    }
    return { ...surumler, uyelikler, yetenekler, altGruplar };
  }

  // Boş şart null saklanır. Yasaktan muaf olan yalnız kök yönetici rolünün sistem satırlarıdır
  // (TS-008 "Muafiyetler"; kapanan AU-27): kök grupta (üst grubu olmayan grup), kök yönetici rolünde
  // ve sistem satırı. Temel rolün ve öbür rollerin sistem satırları muaf değildir.
  private biciminiDogrula(
    satirlar: readonly SaklananYetenek[],
    gruplar: readonly GrupDugumu[],
    kokYoneticiRolleri: ReadonlySet<string>,
  ): YetenekSatiri[] {
    const kokGruplar = new Set(
      gruplar.filter((grup) => grup.ustGrupId === null).map((grup) => grup.id),
    );
    const gecerliler: YetenekSatiri[] = [];
    for (const { sistemSatiri, ...satir } of satirlar) {
      const sart = sartSemasi.safeParse(satir.sart ?? []);
      const yasaktanMuaf =
        sistemSatiri &&
        kokYoneticiRolleri.has(satir.rolId) &&
        kokGruplar.has(satir.grupId);
      if (sart.success) {
        gecerliler.push({ ...satir, sart: sart.data, yasaktanMuaf });
      } else if (satir.giremez) {
        // Bozuk yasak atılmaz (TS-008 "Derleme"; KU-017): derleyici onu bozuk yasak olarak derler ve
        // günlüğe kendisi yazar.
        gecerliler.push({
          ...satir,
          sart: [],
          yasaktanMuaf,
          sartBicimiBozuk: true,
        });
      } else {
        this.gunluk.warn(
          `Yetenek derlenmedi: yetenek=${satir.yetenekId} neden=şartın biçimi bozuk`,
        );
      }
    }
    return gecerliler;
  }
}

// Grubun kendisi ve altındaki bütün gruplar (silinmişler dahil), ağaçta genişlik öncelikli sırayla.
function grupVeAltindakiler(
  grupId: string,
  gruplar: readonly GrupDugumu[],
): string[] {
  const liste = [grupId];
  // Dizinin yineleyicisi döngüde eklenen öğelere de uğrar.
  for (const ust of liste) {
    for (const grup of gruplar) {
      if (grup.ustGrupId === ust) {
        liste.push(grup.id);
      }
    }
  }
  return liste;
}
