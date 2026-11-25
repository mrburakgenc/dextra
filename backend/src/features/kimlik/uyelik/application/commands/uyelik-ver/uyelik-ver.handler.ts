// Üyelik ver işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 47 ve eki; AK-39).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/observability/istek-baglami/istek-baglami.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/domain/kodlu-hata.js';
import { ParolaBaglantisi } from '../../../../_shared/application/parola-baglantisi.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import { KisiKilidi } from '../../../../_shared/application/kisi-kilidi.js';
import { KisininSayisi } from '../../../../_shared/application/kisinin-sayisi.js';
import { ParolaSirri } from '../../../../_shared/application/parola-sirri.js';
import {
  sifirlamaBaglantisi,
  type UyelikVermeReddi,
  uyelikVer,
} from '../../../domain/entities/uyelik.entity.js';
import {
  type IUyelikYazmaRepo,
  UYELIK_YAZMA_REPO,
} from '../../../domain/repositories/i-uyelik.repository.js';
import type { UyelikVerKomutu } from './uyelik-ver.command.js';
import type { UyelikVerSonucu } from './uyelik-ver.result.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:uyelik-ver';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_HATASI: Record<
  UyelikVermeReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  superadmin_degil: {
    kod: 'yetki_yok',
    ileti: 'SuperAdmin üyeliğini yalnız SuperAdmin verebilir',
  },
  zaten_superadmin: { kod: 'cakisma', ileti: 'Kişi zaten SuperAdmin' },
  grup_ya_da_rol_yok: {
    kod: 'cakisma',
    ileti: 'Grup ya da rol yok ya da silinmiş',
  },
  kisi_uygun_degil: {
    kod: 'cakisma',
    ileti: 'Kişi pasif, unutulmuş ya da sistem aktörü',
  },
};

// Tek işlemde: genel sayaç satırı kilitlenir ama artırılmaz; olgular bütünlük sorusuyla sorulur
// (isteyenin okuma yeteneğinden bağımsız), karar ve denetimlerin sırası varlıktandır; satır yetki
// kapısından (Uyelik:olustur yeteneğiyle) yazılır; kişinin sayısı artar. Aynı canlı üçlü varsa
// veritabanının kısmi tekil kısıtı cakisma verir. Kimliği sıfırlanacaksa kişi de kilitlenir (kilit
// sırası: genel sayaç, kişi, bağlantı, oturumlar); parola sırrı silinir, bağlantı varlığın dediği gibi
// üretilir ya da silinir ve kişinin bütün oturumları yetki_yukseltme nedeniyle kapanır. Olay yazılmaz
// (AK-39).
@Injectable()
export class UyelikVerHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    private readonly kisininSayisi: KisininSayisi,
    private readonly kisiKilidi: KisiKilidi,
    private readonly parolaSirri: ParolaSirri,
    private readonly baglanti: ParolaBaglantisi,
    @Inject(UYELIK_YAZMA_REPO) private readonly yazma: IUyelikYazmaRepo,
  ) {}

  calistir(komut: UyelikVerKomutu): Promise<UyelikVerSonucu> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    const { kullaniciId, grupId, rolId } = komut;
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: false });
      const karar = uyelikVer(komut, {
        superAdminUyeligiMi: await this.butunluk.kokSuperAdminKumesiMi(
          islem,
          grupId,
          rolId,
        ),
        isteyenSuperAdminMi: await this.butunluk.kokSuperAdminUyesiMi(
          islem,
          oturum.kullaniciId,
        ),
        kisiSuperAdminMi: await this.butunluk.kokSuperAdminUyesiMi(
          islem,
          kullaniciId,
        ),
        grupCanliMi: await this.butunluk.grupCanliMi(islem, grupId),
        rolCanliMi: await this.butunluk.rolCanliMi(islem, rolId),
        kisiPasifMi: await this.butunluk.kisiPasifMi(islem, kullaniciId),
        kisiUnutulmusMu: await this.butunluk.kisiUnutulmusMu(
          islem,
          kullaniciId,
        ),
        kisiSistemAktoruMu: await this.butunluk.kisiSistemAktoruMu(
          islem,
          kullaniciId,
        ),
      });
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_HATASI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      const { uyelik, kimlikSifirlanirMi } = karar.deger;
      if (kimlikSifirlanirMi) {
        await this.kisiKilidi.kilitle(islem, kullaniciId);
      }
      const id = await this.yazma.olustur(islem, IS_ADI, uyelik);
      await this.kisininSayisi.artir(islem, kullaniciId, iz);
      if (!kimlikSifirlanirMi) {
        return { id };
      }
      await this.parolaSirri.sil(islem, kullaniciId, iz);
      let parolaBaglantisiKodu: string | undefined;
      // Kullanıcı adı kişi kilidinin altında sorulur.
      const baglanti = sifirlamaBaglantisi({
        kullaniciAdiDoluMu: await this.butunluk.kullaniciAdiDoluMu(
          islem,
          kullaniciId,
        ),
      });
      if (baglanti === 'uret') {
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
