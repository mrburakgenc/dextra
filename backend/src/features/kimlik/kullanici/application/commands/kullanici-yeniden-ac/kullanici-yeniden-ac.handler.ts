// Kullanıcıyı yeniden aç işinin işleyicisi (TS-002 "İşlem sınırları"; KR-008 Seçim 43; AK-39, AK-47
// eki).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/observability/istek-baglami/istek-baglami.js';
import { KodluHata } from '../../../../../../shared/http/domain/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import type { IzBilgisi } from '../../../../_shared/application/iz.js';
import { KisininSayisi } from '../../../../_shared/application/kisinin-sayisi.js';
import { KokUyelik } from '../../../../_shared/application/kok-uyelik.js';
import {
  type KullaniciYenidenAcmaReddi,
  kullaniciYenidenAcmaKarari,
} from '../../../domain/entities/kullanici.entity.js';
import {
  type IKullaniciYazmaRepo,
  KULLANICI_YAZMA_REPO,
} from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciYenidenAcKomutu } from './kullanici-yeniden-ac.command.js';

// İşin adı; kapının ve çekirdek parçaların notlarına yazılır.
const IS_ADI = 'kimlik:kullanici-yeniden-ac';

// Varlığın reddi bugünkü HTTP cevabına çevrilir; üç ret de aynı cevabı alır.
const ACILAMAZ =
  'Unutulmuş kişi, sistem aktörü ya da pasif olmayan kişi yeniden açılmaz';
const RET_ILETISI: Record<KullaniciYenidenAcmaReddi, string> = {
  unutulmus: ACILAMAZ,
  sistem_aktoru: ACILAMAZ,
  pasif_degil: ACILAMAZ,
};

// Tek işlemde: kişinin satırı niyet eylemiyle yetki kapısından (Kullanici:yeniden_ac yeteneğiyle)
// yazmadan kilitlenir: satırı tutan yetenek yoksa ya da kişi yoksa bulunamadi. Olgular bu kilit
// altında bütünlük sorusuyla sorulur ve karar varlıktandır (cakisma); pasif işareti kalkınca kişi
// pasif görünmeyeceği için sorular yazmadan önce sorulur. Sonra pasif zamanı aynı niyetle kapıdan
// boşaltılır, "kök üyelik" parçası yeni bir (Kök, Temel) üyeliği yazar (eski üyelikler geri gelmez)
// ve kişinin sayısı artar. Genel sayaç kilitlenmez: kişiden sonra kilitlenseydi kilit sırası ters
// dönerdi. Olay yazılmaz (AK-39). Ret hata olarak atılır ve run bütün işi geri alır.
@Injectable()
export class KullaniciYenidenAcHandler {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(KULLANICI_YAZMA_REPO) private readonly repo: IKullaniciYazmaRepo,
    private readonly butunluk: ButunlukSorusu,
    private readonly kokUyelik: KokUyelik,
    private readonly kisininSayisi: KisininSayisi,
  ) {}

  calistir({ id }: KullaniciYenidenAcKomutu): Promise<void> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const iz: IzBilgisi = { yazanId: oturum.kullaniciId, isAdi: IS_ADI };
    return this.uow.run(async (islem) => {
      await this.repo.yenidenAcNiyeti(islem, IS_ADI, id, false);
      const karar = kullaniciYenidenAcmaKarari({
        unutulmusMu: await this.butunluk.kisiUnutulmusMu(islem, id),
        sistemAktoruMu: await this.butunluk.kisiSistemAktoruMu(islem, id),
        pasifMi: await this.butunluk.kisiPasifMi(islem, id),
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[karar.neden]);
      }
      await this.repo.yenidenAcNiyeti(islem, IS_ADI, id, true);
      await this.kokUyelik.yaz(islem, id, iz);
      await this.kisininSayisi.artir(islem, id, iz);
    });
  }
}
