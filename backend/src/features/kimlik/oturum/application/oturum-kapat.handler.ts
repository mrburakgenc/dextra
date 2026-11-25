import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import {
  OTURUM_YONETIM_REPO,
  OturumYonetimYazmaRepo,
} from '../domain/oturum-yonetim.repository.js';

// İşin adı; kapının notlarına yazılır.
const IS_ADI = 'kimlik:oturum-kapat';

// Kararın baktığı kolonlar. Biri görülemiyorsa oturumun kapalı olup olmadığı ya da kimin olduğu
// bilinemez (yetenek yenilemedeki gibi; TS-002 AK-46 eki).
const KARAR_KOLONLARI = ['kullaniciId', 'kapatilmaZamani'];

// Oturum kapat (TS-002 "İşlem sınırları", AK-51). Tek işlemde: oturumun satırı niyet eylemiyle yetki
// kapısından (Oturum:kapat yeteneğiyle) yazmadan kilitlenir: satırı tutan yetenek yoksa ya da oturum
// yoksa bulunamadi. Kilit altında kayıt yetki kapısından okunur (görülemeyen kayıt bulunamadi); karar
// kolonlarından birini göremeyen kişi kapatamaz (yetki_yok); zaten kapalı oturum cakisma. Kilit
// çıkış, yenileme ve oturum denetiminin koşullu kapatmasını bekletir; böylece "kapatılmamışsa kapat"
// okuma ile yazma arasında bayatlamaz. Kapatılma zamanı ve nedeni aynı niyetle kapıdan yazılır:
// oturumun sahibi isteği yapansa sahibi_kapatti, değilse yonetici. Notları kapı yazar; olay yazılmaz
// (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class OturumKapatHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: OturumYonetimYazmaRepo,
  ) {}

  calistir(id: string): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    return this.uow.run(async (islem) => {
      await this.repo.kapatNiyeti(islem, IS_ADI, id);
      const kayit = await islem.repo(OTURUM_YONETIM_REPO).tek(id);
      if (KARAR_KOLONLARI.some((kolon) => !(kolon in kayit))) {
        throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
      }
      if (kayit['kapatilmaZamani'] !== null) {
        throw new KodluHata('cakisma', 'Oturum zaten kapalı');
      }
      await this.repo.kapatNiyeti(islem, IS_ADI, id, {
        kapatilmaZamani: new Date(),
        kapatilmaNedeni:
          kayit['kullaniciId'] === oturum.kullaniciId
            ? 'sahibi_kapatti'
            : 'yonetici',
      });
    });
  }
}
