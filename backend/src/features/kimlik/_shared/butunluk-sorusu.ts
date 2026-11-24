import { Injectable } from '@nestjs/common';
import type { Islem } from '../../../shared/database/unit-of-work.js';
import { BUTUNLUK_CEKIRDEK_REPO } from './cekirdek/butunluk.repository.js';

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
}
