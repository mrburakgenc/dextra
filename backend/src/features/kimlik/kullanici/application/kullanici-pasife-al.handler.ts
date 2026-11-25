import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../shared/http/istek-baglami.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import type { IzBilgisi } from '../../_shared/iz.js';
import { KisiKilidi } from '../../_shared/kisi-kilidi.js';
import { KisininSayisi } from '../../_shared/kisinin-sayisi.js';
import { KokUyelik } from '../../_shared/kok-uyelik.js';
import { KullaniciYazmaRepo } from '../domain/kullanici.repository.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:kullanici-pasife-al';

// Pasife al (TS-002 "İşlem sınırları"; KR-008 Seçim 43 ve 47; AK-39). Tek işlemde: genel sayaç satırı
// kilitlenir ama artırılmaz; sonra kişinin satırı niyet eylemiyle yetki kapısından
// (Kullanici:pasife_al yeteneğiyle) yazmadan kilitlenir: satırı tutan yetenek yoksa ya da kişi yoksa
// bulunamadi. Denetimler bu kilit altında bütünlük sorusuyla sorulur; pasif zamanı yazılınca kişi
// pasif ve girebilen değil göründüğü için yazmadan önce sorulurlar. Kişinin bütün canlı üyelikleri
// "kök üyelik" parçasıyla, kapatılmamış bütün oturumları "kişi kilidi" parçasıyla pasife_alma
// nedeniyle kapatılır; pasif zamanı aynı niyetle kapıdan yazılır; kişinin sayısı artar. Olay
// yazılmaz (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class KullaniciPasifeAlHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: KullaniciYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kokUyelik: KokUyelik,
    private readonly kisiKilidi: KisiKilidi,
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
      await this.genelSayac.kilitle(islem, { artir: false });
      await this.repo.pasifeAlNiyeti(islem, IS_ADI, id);
      // SuperAdmin koruması (KR-008 Seçim 47): korumaya takılan istek yetki_yok (AK-39).
      if (
        (await this.butunluk.kokSuperAdminUyesiMi(islem, id)) &&
        !(await this.butunluk.kokSuperAdminUyesiMi(islem, oturum.kullaniciId))
      ) {
        throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
      }
      if (
        (await this.butunluk.kisiSistemAktoruMu(islem, id)) ||
        (await this.butunluk.kisiPasifMi(islem, id))
      ) {
        throw new KodluHata(
          'cakisma',
          'Sistem aktörü ya da pasif kişi pasife alınmaz',
        );
      }
      if (await this.butunluk.sonGirebilenKokSuperAdminMi(islem, id)) {
        throw new KodluHata(
          'cakisma',
          'Girebilen son SuperAdmin pasife alınamaz',
        );
      }
      await this.kokUyelik.kapat(islem, id, iz);
      await this.kisiKilidi.kilitle(islem, id, { neden: 'pasife_alma', iz });
      await this.repo.pasifeAlNiyeti(islem, IS_ADI, id, new Date());
      await this.kisininSayisi.artir(islem, id, iz);
    });
  }
}
