import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import type { IzBilgisi } from '../../_shared/iz.js';
import { KisininSayisi } from '../../_shared/kisinin-sayisi.js';
import { KokUyelik } from '../../_shared/kok-uyelik.js';
import { KullaniciYazmaRepo } from '../domain/kullanici.repository.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:kullanici-yeniden-ac';

// Yeniden aç (TS-002 "İşlem sınırları"; KR-008 Seçim 43; AK-39, AK-47 eki). Tek işlemde: kişinin
// satırı niyet eylemiyle yetki kapısından (Kullanici:yeniden_ac yeteneğiyle) yazmadan kilitlenir:
// satırı tutan yetenek yoksa ya da kişi yoksa bulunamadi. Unutulmuş kişi, sistem aktörü ve pasif
// olmayan kişi bu kilit altında bütünlük sorusuyla reddedilir (cakisma); pasif işareti kalkınca kişi
// pasif görünmeyeceği için sorular yazmadan önce sorulur. Sonra pasif zamanı aynı niyetle kapıdan
// boşaltılır, "kök üyelik" parçası yeni bir (Kök, Temel) üyeliği yazar (eski üyelikler geri gelmez)
// ve kişinin sayısı artar. Genel sayaç kilitlenmez: kişiden sonra kilitlenseydi kilit sırası ters
// dönerdi. Olay yazılmaz (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class KullaniciYenidenAcHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: KullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
    private readonly kokUyelik: KokUyelik,
    private readonly kisininSayisi: KisininSayisi,
  ) {}

  calistir(id: string): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    return this.uow.run(async (islem) => {
      await this.repo.yenidenAcNiyeti(islem, IS_ADI, id, false);
      if (
        (await this.butunluk.kisiUnutulmusMu(islem, id)) ||
        (await this.butunluk.kisiSistemAktoruMu(islem, id)) ||
        !(await this.butunluk.kisiPasifMi(islem, id))
      ) {
        throw new KodluHata(
          'cakisma',
          'Unutulmuş kişi, sistem aktörü ya da pasif olmayan kişi yeniden açılmaz',
        );
      }
      await this.repo.yenidenAcNiyeti(islem, IS_ADI, id, true);
      await this.kokUyelik.yaz(islem, id, iz);
      await this.kisininSayisi.artir(islem, id, iz);
    });
  }
}
