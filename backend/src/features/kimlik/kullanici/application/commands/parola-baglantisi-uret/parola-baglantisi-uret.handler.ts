// Parola bağlantısı üret işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 47; KR-009 Seçim 9).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/http/istek-baglami.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/kodlu-hata.js';
import { ParolaBaglantisi } from '../../../../_shared/application/parola-baglantisi.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import {
  type ParolaBaglantisiUretmeReddi,
  parolaBaglantisiUretmeKarari,
} from '../../../domain/entities/kullanici.entity.js';
import {
  type IKullaniciYazmaRepo,
  KULLANICI_YAZMA_REPO,
} from '../../../domain/repositories/i-kullanici.repository.js';
import type { ParolaBaglantisiUretKomutu } from './parola-baglantisi-uret.command.js';
import type { ParolaBaglantisiUretSonucu } from './parola-baglantisi-uret.result.js';

// İşin adı; kapının ve bağlantı parçasının notlarına yazılır.
const IS_ADI = 'kimlik:parola-baglantisi-uret';

// Varlığın reddi bugünkü HTTP cevabına çevrilir: SuperAdmin korumasına takılan istek yetki_yok
// (AK-39), öbürleri cakisma; sistem aktörü, pasif ve unutulmuş kişi aynı cevabı alır.
const URETILMEZ = {
  kod: 'cakisma',
  ileti: 'Sistem aktörü, pasif ya da unutulmuş kişi için bağlantı üretilmez',
} as const;
const RET_CEVABI: Record<
  ParolaBaglantisiUretmeReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  superadmin_korumasi: { kod: 'yetki_yok', ileti: 'Bu işlem için yetki yok' },
  sistem_aktoru: URETILMEZ,
  pasif: URETILMEZ,
  unutulmus: URETILMEZ,
  kullanici_adi_yok: {
    kod: 'cakisma',
    ileti: 'Kullanıcı adı olmayan kişi için bağlantı üretilmez',
  },
};

// Tek işlemde: hedef kişinin satırı niyet eylemiyle yetki kapısından (Kullanici:parola_baglantisi_uret
// yeteneğiyle) kilitlenir; olgular bu kilit altında bütünlük sorusuyla sorulur ve karar varlıktandır.
// Soru kilitten önce sorulsaydı araya giren bir SuperAdmin üyeliği verme işi, yeni SuperAdmin'in
// bağlantısını isteyene çıkarırdı. Genel sayaç kilitlenmez; bağlantı kilit sırasında kişiden sonra
// gelir. Kişinin kullanılmamış eski bağlantısını "bağlantı" parçası siler ve yenisini yazar. Olay
// yazılmaz (AK-39). Kod yalnız cevapta döner.
@Injectable()
export class ParolaBaglantisiUretHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KULLANICI_YAZMA_REPO) private readonly repo: IKullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
    private readonly baglanti: ParolaBaglantisi,
  ) {}

  calistir({
    id,
  }: ParolaBaglantisiUretKomutu): Promise<ParolaBaglantisiUretSonucu> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    return this.uow.run(async (islem) => {
      await this.repo.parolaBaglantisiNiyeti(islem, IS_ADI, id);
      const karar = parolaBaglantisiUretmeKarari({
        hedefKokSuperAdminMi: await this.butunluk.kokSuperAdminUyesiMi(
          islem,
          id,
        ),
        isteyenKokSuperAdminMi: await this.butunluk.kokSuperAdminUyesiMi(
          islem,
          oturum.kullaniciId,
        ),
        sistemAktoruMu: await this.butunluk.kisiSistemAktoruMu(islem, id),
        pasifMi: await this.butunluk.kisiPasifMi(islem, id),
        unutulmusMu: await this.butunluk.kisiUnutulmusMu(islem, id),
        kullaniciAdiDoluMu: await this.butunluk.kullaniciAdiDoluMu(islem, id),
      });
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_CEVABI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      return {
        parolaBaglantisiKodu: await this.baglanti.uret(
          islem,
          { kullaniciId: id, olusturanId: oturum.kullaniciId },
          iz,
        ),
      };
    });
  }
}
