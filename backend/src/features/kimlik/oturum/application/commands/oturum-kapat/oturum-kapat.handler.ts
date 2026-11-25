// Oturum kapat işinin işleyicisi (TS-002 "İşlem sınırları", AK-51).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/observability/istek-baglami/istek-baglami.js';
import { KodluHata } from '../../../../../../shared/http/domain/kodlu-hata.js';
import {
  type OturumKapatmaReddi,
  oturumKapatmaKarari,
} from '../../../domain/entities/oturum.entity.js';
import {
  type IOturumYonetimYazmaRepo,
  OTURUM_YONETIM_OKUMA_REPO,
  OTURUM_YONETIM_YAZMA_REPO,
} from '../../../domain/repositories/i-oturum-yonetim.repository.js';
import type { OturumKapatKomutu } from './oturum-kapat.command.js';

// İşin adı; kapının notlarına yazılır.
const IS_ADI = 'kimlik:oturum-kapat';

// Varlığın retleri bugünkü HTTP cevaplarına çevrilir.
const RET_HATASI: Record<OturumKapatmaReddi, () => KodluHata> = {
  gorulemiyor: () => new KodluHata('yetki_yok', 'Bu işlem için yetki yok'),
  zaten_kapali: () => new KodluHata('cakisma', 'Oturum zaten kapalı'),
};

// Oturum kapat (TS-002 "İşlem sınırları", AK-51). Tek işlemde: oturumun satırı niyet eylemiyle yetki
// kapısından (Oturum:kapat yeteneğiyle) yazmadan kilitlenir: satırı tutan yetenek yoksa ya da oturum
// yoksa bulunamadi. Kilit altında kayıt yetki kapısından okunur (görülemeyen kayıt bulunamadi); kararın
// olguları kaydın iki kolonundan toplanır (kolon görülemiyorsa olgu bilinemez), karar varlıktandır:
// olgusu bilinemeyen yetki_yok, zaten kapalı oturum cakisma alır. Kilit çıkış, yenileme ve oturum
// denetiminin koşullu kapatmasını bekletir; böylece "kapatılmamışsa kapat" okuma ile yazma arasında
// bayatlamaz. Kapatılma zamanı ve varlığın verdiği neden aynı niyetle kapıdan yazılır. Notları kapı
// yazar; olay yazılmaz (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class OturumKapatHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(OTURUM_YONETIM_YAZMA_REPO)
    private readonly repo: IOturumYonetimYazmaRepo,
  ) {}

  calistir({ id }: OturumKapatKomutu): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.uow.run(async (islem) => {
      await this.repo.kapatNiyeti(islem, IS_ADI, id);
      const kayit = await islem.repo(OTURUM_YONETIM_OKUMA_REPO).tek(id);
      const karar = oturumKapatmaKarari({
        kapaliMi:
          'kapatilmaZamani' in kayit ? kayit.kapatilmaZamani !== null : null,
        sahibiMi:
          'kullaniciId' in kayit
            ? kayit.kullaniciId === oturum.kullaniciId
            : null,
      });
      if (karar.tur === 'ret') {
        throw RET_HATASI[karar.neden]();
      }
      await this.repo.kapatNiyeti(islem, IS_ADI, id, {
        kapatilmaZamani: new Date(),
        kapatilmaNedeni: karar.deger,
      });
    });
  }
}
