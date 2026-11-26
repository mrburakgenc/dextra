// Yetenek teşhisinin sonucu: kişinin o eylem ve kaynakta kaydı tutan kuralları, kolon başına ve kaydın
// bütünü için karar ve kişinin son ret kayıtları (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-32).
// Kaydın kolon değerleri yoktur.
import type { RetKaydi } from '../../../../../../shared/observability/erisim/ret-kaydi.js';
import type { Teshis } from '../../../../../../shared/yetki/domain/okuma-tipleri.js';

export type YetenekTeshisSonucu = Teshis & {
  readonly retKayitlari: readonly RetKaydi[];
};
