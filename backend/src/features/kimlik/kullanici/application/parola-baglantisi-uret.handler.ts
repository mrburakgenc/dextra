import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ParolaBaglantisi } from '../../_shared/baglanti/parola-baglantisi.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import type { IzBilgisi } from '../../_shared/iz.js';
import { KullaniciYazmaRepo } from '../domain/kullanici.repository.js';

// İşin adı; kapının ve bağlantı parçasının notlarına yazılır.
const IS_ADI = 'kimlik:parola-baglantisi-uret';

// Parola bağlantısı üret (TS-002 "İşlem sınırları"; KR-008 Seçim 47; KR-009 Seçim 9). Tek işlemde:
// hedef kişinin satırı niyet eylemiyle yetki kapısından (Kullanici:parola_baglantisi_uret
// yeteneğiyle) kilitlenir; denetimler bu kilit altında bütünlük sorusuyla yapılır. Soru kilitten önce
// sorulsaydı araya giren bir SuperAdmin üyeliği verme işi, yeni SuperAdmin'in bağlantısını isteyene
// çıkarırdı. Genel sayaç kilitlenmez; bağlantı kilit sırasında kişiden sonra gelir. Kişinin
// kullanılmamış eski bağlantısını "bağlantı" parçası siler ve yenisini yazar. Olay yazılmaz (AK-39).
// Kod yalnız cevapta döner.
@Injectable()
export class ParolaBaglantisiUretHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: KullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
    private readonly baglanti: ParolaBaglantisi,
  ) {}

  calistir(id: string): Promise<string> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    return this.uow.run(async (islem) => {
      await this.repo.parolaBaglantisiNiyeti(islem, IS_ADI, id);
      // SuperAdmin koruması (KR-008 Seçim 47): korumaya takılan istek yetki_yok (AK-39).
      if (
        (await this.butunluk.kokSuperAdminUyesiMi(islem, id)) &&
        !(await this.butunluk.kokSuperAdminUyesiMi(islem, oturum.kullaniciId))
      ) {
        throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
      }
      if (
        (await this.butunluk.kisiSistemAktoruMu(islem, id)) ||
        (await this.butunluk.kisiPasifMi(islem, id)) ||
        (await this.butunluk.kisiUnutulmusMu(islem, id))
      ) {
        throw new KodluHata(
          'cakisma',
          'Sistem aktörü, pasif ya da unutulmuş kişi için bağlantı üretilmez',
        );
      }
      if (!(await this.butunluk.kullaniciAdiDoluMu(islem, id))) {
        throw new KodluHata(
          'cakisma',
          'Kullanıcı adı olmayan kişi için bağlantı üretilmez',
        );
      }
      return this.baglanti.uret(
        islem,
        { kullaniciId: id, olusturanId: oturum.kullaniciId },
        iz,
      );
    });
  }
}
