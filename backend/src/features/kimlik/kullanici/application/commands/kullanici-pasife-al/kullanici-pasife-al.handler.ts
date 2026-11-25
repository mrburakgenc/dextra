// Kullanıcıyı pasife al işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 43 ve 47; AK-39).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/http/istek-baglami.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import { KisiKilidi } from '../../../../_shared/application/kisi-kilidi.js';
import { KisininSayisi } from '../../../../_shared/application/kisinin-sayisi.js';
import { KokUyelik } from '../../../../_shared/application/kok-uyelik.js';
import {
  type KullaniciPasifeAlmaReddi,
  kullaniciPasifeAlmaKarari,
} from '../../../domain/entities/kullanici.entity.js';
import {
  type IKullaniciYazmaRepo,
  KULLANICI_YAZMA_REPO,
} from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciPasifeAlKomutu } from './kullanici-pasife-al.command.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:kullanici-pasife-al';

// Varlığın reddi bugünkü HTTP cevabına çevrilir: SuperAdmin korumasına takılan istek yetki_yok
// (AK-39), öbürleri cakisma; sistem aktörü ve pasif kişi aynı cevabı alır.
const PASIFE_ALINMAZ = {
  kod: 'cakisma',
  ileti: 'Sistem aktörü ya da pasif kişi pasife alınmaz',
} as const;
const RET_CEVABI: Record<
  KullaniciPasifeAlmaReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  superadmin_korumasi: { kod: 'yetki_yok', ileti: 'Bu işlem için yetki yok' },
  sistem_aktoru: PASIFE_ALINMAZ,
  pasif: PASIFE_ALINMAZ,
  son_girebilen_superadmin: {
    kod: 'cakisma',
    ileti: 'Girebilen son SuperAdmin pasife alınamaz',
  },
};

// Tek işlemde: genel sayaç satırı kilitlenir ama artırılmaz; sonra kişinin satırı niyet eylemiyle
// yetki kapısından (Kullanici:pasife_al yeteneğiyle) yazmadan kilitlenir: satırı tutan yetenek yoksa
// ya da kişi yoksa bulunamadi. Olgular bu kilit altında bütünlük sorusuyla sorulur; pasif zamanı
// yazılınca kişi pasif ve girebilen değil göründüğü için yazmadan önce sorulurlar. Karar varlıktandır.
// Kişinin bütün canlı üyelikleri "kök üyelik" parçasıyla, kapatılmamış bütün oturumları "kişi kilidi"
// parçasıyla pasife_alma nedeniyle kapatılır; pasif zamanı aynı niyetle kapıdan yazılır; kişinin
// sayısı artar. Olay yazılmaz (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class KullaniciPasifeAlHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KULLANICI_YAZMA_REPO) private readonly repo: IKullaniciYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kokUyelik: KokUyelik,
    private readonly kisiKilidi: KisiKilidi,
    private readonly kisininSayisi: KisininSayisi,
  ) {}

  calistir({ id }: KullaniciPasifeAlKomutu): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: false });
      await this.repo.pasifeAlNiyeti(islem, IS_ADI, id);
      const karar = kullaniciPasifeAlmaKarari({
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
        sonGirebilenKokSuperAdminMi:
          await this.butunluk.sonGirebilenKokSuperAdminMi(islem, id),
      });
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_CEVABI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      await this.kokUyelik.kapat(islem, id, iz);
      await this.kisiKilidi.kilitle(islem, id, { neden: 'pasife_alma', iz });
      await this.repo.pasifeAlNiyeti(islem, IS_ADI, id, new Date());
      await this.kisininSayisi.artir(islem, id, iz);
    });
  }
}
