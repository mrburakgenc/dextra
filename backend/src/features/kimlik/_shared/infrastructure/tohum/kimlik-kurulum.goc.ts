import { Injectable } from '@nestjs/common';
import { yeniKimlik } from '../../../../../shared/database/domain/kimlik.js';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import type { SartOgesi } from '../../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';
import {
  type DegisiklikKaydiNotu,
  OutboxYazici,
} from '../../../../../shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { type IzBilgisi, notunOrtakAlanlari } from '../../application/iz.js';
import { TohumYardimcisi } from '../../application/tohum-yardimcisi.js';
import {
  KURULUM_REPO,
  type YeniYetenek,
} from '../../domain/repositories/i-kurulum.repository.js';
import { KIMLIK_SISTEM_AKTORU_ADI } from '../repositories/sistem-aktoru-cekirdek.prisma-repository.js';

export const KIMLIK_KURULUM_GOCU = '202611240000-kimlik-kurulum';

// İzin kataloğu: TS-002 "Uçlar ve izinler"deki yönetim listesi. Kaynak model adıdır.
const IZIN_KATALOGU: Readonly<Record<string, readonly string[]>> = {
  Kullanici: [
    'oku',
    'olustur',
    'guncelle',
    'giris_bilgisini_degistir',
    'pasife_al',
    'yeniden_ac',
    'parola_baglantisi_uret',
    'unut',
  ],
  Oturum: ['oku', 'kapat'],
  Grup: ['oku', 'olustur', 'guncelle', 'tasi', 'sil'],
  Rol: ['oku', 'olustur', 'guncelle', 'sil'],
  Izin: ['oku'],
  Uyelik: ['oku', 'olustur', 'sil'],
  Yetenek: ['oku', 'olustur', 'yenile', 'sil'],
};

// (Kök, Temel) kümesinin kişinin kendi oturumları için taşıdığı eylemler (KR-008 Seçim 46).
const KENDI_OTURUM_EYLEMLERI = ['oku', 'kapat'];

// "Oturumun sahibi isteği yapandır": alan Oturum modelinin alanı, değer derleyicinin çözdüğü
// "isteyen" yer tutucusudur.
const OTURUMUN_SAHIBI_ISTEYEN = [
  { alan: 'kullaniciId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
] satisfies SartOgesi[];

// Göçün yazdığı yetenek: şartı varsa yalnız yukarıdaki şarttır (not onu olduğu gibi taşır).
type GocunYetenegi = Omit<YeniYetenek, 'sart'> & {
  sart: typeof OTURUMUN_SAHIBI_ISTEYEN | null;
};

type OlusturmaDegisenleri = Extract<
  DegisiklikKaydiNotu,
  { eylem: 'olusturma' }
>['degisen'];

// İlk kurulum göçü (TS-002 AK-2, AK-3). Yazdığı her satır, kimliğin sistem aktörünü yazan olarak
// gösteren bir değişiklik kaydı notu bırakır; genel sayaç satırı not bırakmaz (AK-20). Kullanıcıları
// ve üyelikleri tohum yardımcısı yazar. Parola yazılmaz.
@Injectable()
export class KimlikKurulumGocu {
  constructor(
    private readonly yazici: OutboxYazici,
    private readonly tohum: TohumYardimcisi,
  ) {}

  async uygula(ad: string, islem: Islem): Promise<void> {
    const repo = islem.repo(KURULUM_REPO);
    // Tohum yardımcısı genel sayacı kilitlediği için satır ondan önce yazılır.
    await repo.genelSayacEkle();

    const sistemAktoru = yeniKimlik();
    const iz: IzBilgisi = { yazanId: sistemAktoru, isAdi: `tohum:${ad}` };
    await this.tohum.yaz(
      islem,
      {
        id: sistemAktoru,
        kullaniciAdi: null,
        telefon: null,
        gorunenAd: KIMLIK_SISTEM_AKTORU_ADI,
        sistemAktoru: true,
        uyelikler: [],
      },
      iz,
    );

    const kokGrup = yeniKimlik();
    const { olusturmaZamani } = await repo.grupEkle({ id: kokGrup, ad: 'Kök' });
    await this.not(islem, iz, 'Grup', kokGrup, {
      ust_grup_id: { yeni: null },
      ad: { yeni: 'Kök' },
      olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
    });

    const temelRol = await this.rolYaz(islem, iz, 'temel', 'Temel');
    const superadminRol = await this.rolYaz(
      islem,
      iz,
      'superadmin',
      'SuperAdmin',
    );

    for (const [kaynak, eylemler] of Object.entries(IZIN_KATALOGU)) {
      for (const eylem of eylemler) {
        const izinId = yeniKimlik();
        await repo.izinEkle({ id: izinId, kaynak, eylem });
        await this.not(islem, iz, 'Izin', izinId, {
          kaynak: { yeni: kaynak },
          eylem: { yeni: eylem },
        });
        await this.yetenekYaz(islem, iz, {
          id: yeniKimlik(),
          grupId: kokGrup,
          rolId: superadminRol,
          izinId,
          sart: null,
          butunKayitlar: true,
          butunBirimler: true,
          butunKolonlar: true,
          sistemSatiri: true,
          tohumAnahtari: `kimlik:${kaynak}:${eylem}:superadmin`,
          koken: 'goc',
        });
        if (kaynak === 'Oturum' && KENDI_OTURUM_EYLEMLERI.includes(eylem)) {
          await this.yetenekYaz(islem, iz, {
            id: yeniKimlik(),
            grupId: kokGrup,
            rolId: temelRol,
            izinId,
            sart: OTURUMUN_SAHIBI_ISTEYEN,
            butunKayitlar: false,
            butunBirimler: false,
            butunKolonlar: true,
            sistemSatiri: true,
            tohumAnahtari: `kimlik:${kaynak}:${eylem}:temel`,
            koken: 'goc',
          });
        }
      }
    }

    // (Kök, Temel) üyeliğini yardımcı kendisi yazar; (Kök, SuperAdmin) verilen üyeliktir.
    await this.tohum.yaz(
      islem,
      {
        id: yeniKimlik(),
        kullaniciAdi: 'superadmin',
        telefon: null,
        gorunenAd: 'Sistem Yöneticisi',
        sistemAktoru: false,
        uyelikler: [{ grupId: kokGrup, rolId: superadminRol }],
      },
      iz,
    );
  }

  private async rolYaz(
    islem: Islem,
    iz: IzBilgisi,
    kod: string,
    ad: string,
  ): Promise<string> {
    const id = yeniKimlik();
    await islem.repo(KURULUM_REPO).rolEkle({ id, kod, ad });
    await this.not(islem, iz, 'Rol', id, {
      kod: { yeni: kod },
      ad: { yeni: ad },
    });
    return id;
  }

  private async yetenekYaz(
    islem: Islem,
    iz: IzBilgisi,
    yetenek: GocunYetenegi,
  ): Promise<void> {
    const { olusturmaZamani } = await islem
      .repo(KURULUM_REPO)
      .yetenekEkle(yetenek);
    await this.not(islem, iz, 'Yetenek', yetenek.id, {
      grup_id: { yeni: yetenek.grupId },
      rol_id: { yeni: yetenek.rolId },
      izin_id: { yeni: yetenek.izinId },
      sart: { yeni: yetenek.sart },
      butun_kayitlar: { yeni: yetenek.butunKayitlar },
      butun_birimler: { yeni: yetenek.butunBirimler },
      kolonlar: { yeni: null },
      butun_kolonlar: { yeni: yetenek.butunKolonlar },
      sistem_satiri: { yeni: yetenek.sistemSatiri },
      tohum_anahtari: { yeni: yetenek.tohumAnahtari },
      koken: { yeni: yetenek.koken },
      olusturma_zamani: { yeni: olusturmaZamani.toISOString() },
    });
  }

  // Grup, rol, izin ve yetenek bir kişiye ait değildir: veri sahibi boştur.
  private async not(
    islem: Islem,
    iz: IzBilgisi,
    kaynak: string,
    kayitId: string,
    degisen: OlusturmaDegisenleri,
  ): Promise<void> {
    await this.yazici.degisiklikKaydi(islem, {
      ...notunOrtakAlanlari(iz, kaynak, kayitId, iz.yazanId),
      veri_sahibi_kullanici_id: null,
      eylem: 'olusturma',
      degisen,
    });
  }
}
