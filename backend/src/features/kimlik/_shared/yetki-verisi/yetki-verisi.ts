import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type {
  KisininSatirlari,
  YetkiSurumleri,
  YetkiVerisi,
} from '../../../../shared/kimlik/yetki-verisi.contract.js';
import {
  type CanliGrup,
  YETKI_VERISI_REPO,
} from './yetki-verisi.repository.js';

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

// YetkiVerisi sözleşmesinin uygulaması (TS-002 AK-16): bir çekirdek yoldur. Önce sürümler, sonra canlı
// üyelikler, onların (grup, rol) çiftlerine bağlı canlı yetenekler ve canlı grupların tamamı okunur.
// Okuma tek anlık görüntü değildir: sürümler önce okunduğu için arada yazılan yetki eski damgayla
// saklanır ve sonraki istekte yenilenir.
@Injectable()
export class KimlikYetkiVerisi implements YetkiVerisi {
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
    const yetenekler = await repo.yetenekler(uyelikler);
    const gruplar = await repo.canliGruplar();
    const altGruplar: Record<string, string[]> = {};
    for (const { grupId } of uyelikler) {
      altGruplar[grupId] ??= grupVeAltindakiler(grupId, gruplar);
    }
    return { ...surumler, uyelikler, yetenekler, altGruplar };
  }
}

// Grubun kendisi ve altındaki bütün canlı gruplar, ağaçta genişlik öncelikli sırayla.
function grupVeAltindakiler(
  grupId: string,
  gruplar: readonly CanliGrup[],
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
