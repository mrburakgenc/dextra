import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ParolaBaglantisi } from '../../_shared/baglanti/parola-baglantisi.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import type { IzBilgisi } from '../../_shared/iz.js';
import { KisiKilidi } from '../../_shared/kisi-kilidi.js';
import { KisininSayisi } from '../../_shared/kisinin-sayisi.js';
import { ParolaSirri } from '../../_shared/parola-sirri.js';
import {
  UyelikYazmaRepo,
  type YeniUyelik,
} from '../domain/uyelik.repository.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:uyelik-ver';

// Kod yalnız SuperAdmin üyeliği verilen ve kullanıcı adı dolu kişide döner.
export interface VerilenUyelik {
  readonly id: string;
  readonly parolaBaglantisiKodu?: string;
}

// Üyelik ver (TS-002 "İşlem sınırları"; KR-008 Seçim 47 ve eki; AK-39). Tek işlemde: genel sayaç
// satırı kilitlenir ama artırılmaz; denetimler bütünlük sorusuyla sorulur (isteyenin okuma
// yeteneğinden bağımsız); satır yetki kapısından (Uyelik:olustur yeteneğiyle) yazılır; kişinin
// sayısı artar. Aynı canlı üçlü varsa veritabanının kısmi tekil kısıtı cakisma verir.
// (Kök, SuperAdmin) üyeliğinde: yalnız (Kök, SuperAdmin) üyesi verebilir (yetki_yok); hedef zaten
// üyeyse hiçbir şey sıfırlanmadan cakisma. Değilse kişi de kilitlenir (kilit sırası: genel sayaç,
// kişi, bağlantı, oturumlar); parola sırrı ve kullanılmamış bağlantı silinir, kullanıcı adı doluysa
// yeni bağlantı üretilir ve kod cevapta bir kez döner; kişinin bütün oturumları yetki_yukseltme
// nedeniyle kapanır. Olay yazılmaz (AK-39).
@Injectable()
export class UyelikVerHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: UyelikYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kisininSayisi: KisininSayisi,
    private readonly kisiKilidi: KisiKilidi,
    private readonly parolaSirri: ParolaSirri,
    private readonly baglanti: ParolaBaglantisi,
  ) {}

  calistir(uyelik: YeniUyelik): Promise<VerilenUyelik> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    const { kullaniciId, grupId, rolId } = uyelik;
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: false });
      const superAdmin = await this.butunluk.kokSuperAdminKumesiMi(
        islem,
        grupId,
        rolId,
      );
      if (superAdmin) {
        if (
          !(await this.butunluk.kokSuperAdminUyesiMi(islem, oturum.kullaniciId))
        ) {
          throw new KodluHata(
            'yetki_yok',
            'SuperAdmin üyeliğini yalnız SuperAdmin verebilir',
          );
        }
        if (await this.butunluk.kokSuperAdminUyesiMi(islem, kullaniciId)) {
          throw new KodluHata('cakisma', 'Kişi zaten SuperAdmin');
        }
      }
      if (
        !(await this.butunluk.grupCanliMi(islem, grupId)) ||
        !(await this.butunluk.rolCanliMi(islem, rolId))
      ) {
        throw new KodluHata('cakisma', 'Grup ya da rol yok ya da silinmiş');
      }
      if (
        (await this.butunluk.kisiPasifMi(islem, kullaniciId)) ||
        (await this.butunluk.kisiUnutulmusMu(islem, kullaniciId)) ||
        (await this.butunluk.kisiSistemAktoruMu(islem, kullaniciId))
      ) {
        throw new KodluHata(
          'cakisma',
          'Kişi pasif, unutulmuş ya da sistem aktörü',
        );
      }
      if (superAdmin) {
        await this.kisiKilidi.kilitle(islem, kullaniciId);
      }
      const id = await this.repo.olustur(islem, IS_ADI, uyelik);
      await this.kisininSayisi.artir(islem, kullaniciId, iz);
      if (!superAdmin) {
        return { id };
      }
      await this.parolaSirri.sil(islem, kullaniciId, iz);
      let parolaBaglantisiKodu: string | undefined;
      if (await this.butunluk.kullaniciAdiDoluMu(islem, kullaniciId)) {
        // Üretim kişinin kullanılmamış eski bağlantısını önce siler.
        parolaBaglantisiKodu = await this.baglanti.uret(
          islem,
          { kullaniciId, olusturanId: oturum.kullaniciId },
          iz,
        );
      } else {
        await this.baglanti.sil(islem, kullaniciId, iz);
      }
      await this.kisiKilidi.kilitle(islem, kullaniciId, {
        neden: 'yetki_yukseltme',
        iz,
      });
      return parolaBaglantisiKodu === undefined
        ? { id }
        : { id, parolaBaglantisiKodu };
    });
  }
}
