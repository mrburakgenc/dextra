import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../../shared/database/domain/islem.js';
import {
  BUTUNLUK_CEKIRDEK_REPO,
  type IzinKunyesi,
  type UyelikKunyesi,
} from '../domain/repositories/i-butunluk-cekirdek.repository.js';

// Yönetim alt özellikleri çekirdek repository dosyalarını içe aktaramaz (lint sınırı); künyelerin
// türleri onlara buradan verilir.
export type { IzinKunyesi, UyelikKunyesi };

// Çekirdek parça "bütünlük sorusu" (TS-002 "Yapı"): korumalı işlerin ve yönetim komutlarının
// denetimleri. Her soru yalnız evet ya da hayır döner, satır vermez; isteyenin okuma yeteneğinden
// bağımsızdır (yetki kapısından geçmez, çekirdek repository'yle okur). Böylece yeteneği dar bir
// yönetici, göremediği satırlar yüzünden dolu bir grubu "boş" görmez. Kendi işlemini açmaz;
// çağıranın işleminde çalışır.
@Injectable()
export class ButunlukSorusu {
  // Kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  kokSuperAdminUyesiMi(islem: Islem, kullaniciId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).kokSuperAdminUyesiMi(kullaniciId);
  }

  // Kişi girebilen son (Kök, SuperAdmin) üyesi mi: kendisi girebilir ve ondan başka girebilen yok.
  // Girebilen: pasif, unutulmuş ve sistem aktörü değil; kullanıcı adı ve parola sırrı var.
  sonGirebilenKokSuperAdminMi(
    islem: Islem,
    kullaniciId: string,
  ): Promise<boolean> {
    return islem
      .repo(BUTUNLUK_CEKIRDEK_REPO)
      .sonGirebilenKokSuperAdminMi(kullaniciId);
  }

  grupCanliMi(islem: Islem, grupId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).grupCanliMi(grupId);
  }

  rolCanliMi(islem: Islem, rolId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).rolCanliMi(rolId);
  }

  // (grup, rol) kümesi (Kök, SuperAdmin) mi.
  kokSuperAdminKumesiMi(
    islem: Islem,
    grupId: string,
    rolId: string,
  ): Promise<boolean> {
    return islem
      .repo(BUTUNLUK_CEKIRDEK_REPO)
      .kokSuperAdminKumesiMi(grupId, rolId);
  }

  // Grubun canlı alt grubu, canlı üyeliği ve canlı yeteneği yok mu.
  grupBosMu(islem: Islem, grupId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).grupBosMu(grupId);
  }

  // Rolün canlı üyeliği ve canlı yeteneği yok mu.
  rolBosMu(islem: Islem, rolId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).rolBosMu(rolId);
  }

  // Grubu yeni üstün altına taşımak döngü yapar mı: yeni üst, grubun kendisi ya da altındakilerden
  // biri mi.
  tasimaDonguYaparMi(
    islem: Islem,
    grupId: string,
    yeniUstGrupId: string,
  ): Promise<boolean> {
    return islem
      .repo(BUTUNLUK_CEKIRDEK_REPO)
      .tasimaDonguYaparMi(grupId, yeniUstGrupId);
  }

  // TS-002 AK-43 ekleri. Kayıt yoksa hayır döner.

  // Rol sistem rolü mü: kodu dolu mu.
  rolSistemRoluMu(islem: Islem, rolId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).rolSistemRoluMu(rolId);
  }

  // Grup kök grup mu: üst grubu yok mu.
  grupKokMu(islem: Islem, grupId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).grupKokMu(grupId);
  }

  kisiPasifMi(islem: Islem, kullaniciId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).kisiPasifMi(kullaniciId);
  }

  kisiUnutulmusMu(islem: Islem, kullaniciId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).kisiUnutulmusMu(kullaniciId);
  }

  kisiSistemAktoruMu(islem: Islem, kullaniciId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).kisiSistemAktoruMu(kullaniciId);
  }

  kullaniciAdiDoluMu(islem: Islem, kullaniciId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).kullaniciAdiDoluMu(kullaniciId);
  }

  izinKatalogdaMi(islem: Islem, izinId: string): Promise<boolean> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).izinKatalogdaMi(izinId);
  }

  // Künyeler "yalnız evet ya da hayır" ilkesinin adıyla istisnasıdır (TS-002 AK-43): satırın yalnız
  // sayılan alanlarını verir; kayıt yoksa undefined döner. Üyelik künyesi yalnız üyelik kaldırma,
  // izin künyesi yalnız yetenek yazma ve yenileme işinde kullanılır.
  uyelikKunyesi(
    islem: Islem,
    uyelikId: string,
  ): Promise<UyelikKunyesi | undefined> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).uyelikKunyesi(uyelikId);
  }

  izinKunyesi(islem: Islem, izinId: string): Promise<IzinKunyesi | undefined> {
    return islem.repo(BUTUNLUK_CEKIRDEK_REPO).izinKunyesi(izinId);
  }
}
