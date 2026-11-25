// Yazılacak yetenek satırının kurulması; yetenek yaz ve yetenek yenile (yeni satır için) paylaşır
// (TS-002 AK-39; KR-008 Seçim 5, 7, 11, 17, 21, 34). Kararı yetenek varlığı verir; burada yalnız
// olgular toplanır ve ret bugünkü HTTP cevabına çevrilir.
import { Inject, Injectable } from '@nestjs/common';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import { istekBaglami } from '../../../../../shared/observability/istek-baglami/istek-baglami.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../../../../../shared/yetki/domain/kaynak-katalogu.js';
import { yetenekleriDerle } from '../../../../../shared/yetki/application/yetenek-derleyici.js';
import { ButunlukSorusu } from '../../../_shared/application/butunluk-sorusu.js';
import {
  type IzinOlgulari,
  type YeniYetenek,
  type YetenekBaglantisi,
  type YetenekYazmaReddi,
  yetenekOlustur,
} from '../../domain/entities/yetenek.entity.js';
import { YETENEK_REPO } from '../../domain/repositories/i-yetenek.repository.js';
import type { YetenekIcerigi } from '../../domain/value-objects/yetenek-icerigi.js';

// Varlığın reddi bugünkü HTTP cevabına çevrilir; her ret kodu adıyla karşılanır, karşılanmayan kod
// derlenmez.
function hata(neden: YetenekYazmaReddi): KodluHata {
  switch (neden.kod) {
    case 'grup_ya_da_rol_yok':
      return new KodluHata('cakisma', 'Grup ya da rol yok ya da silinmiş');
    case 'izin_yok':
      return new KodluHata('cakisma', 'İzin katalogda yok');
    case 'bilinmeyen_kolon':
      return new KodluHata('dogrulama_hatasi', 'Yetenek doğrulanamadı', [
        { alan: 'kolonlar', neden: `bilinmeyen kolon: ${neden.kolon}` },
      ]);
    case 'derlenemedi':
      return new KodluHata('dogrulama_hatasi', 'Yetenek doğrulanamadı', [
        { alan: 'sart', neden: neden.derlemeHatasi },
      ]);
    case 'korunan_kaynak':
      return new KodluHata(
        'cakisma',
        'Bu izin yalnız (Kök, SuperAdmin) kümesine yazılabilir',
      );
  }
}

// Genel sayaç satırını kilitlemiş bir run içinden çağrılır (yetenek, grup ve rol yazan bütün işler aynı
// satırı kilitlediği için olgularla yazma arasında grup, rol ya da yetenek değişemez). Grubun ve rolün
// canlılığı ile (grup, rol) kümesi bütünlük sorusuyla sorulur; izin yetki kapısından okunur, görülemeyen
// izin yok sayılır.
@Injectable()
export class YetenekYazimi {
  constructor(
    private readonly butunluk: ButunlukSorusu,
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  async kur(
    islem: Islem,
    baglanti: YetenekBaglantisi,
    icerik: YetenekIcerigi,
  ): Promise<YeniYetenek> {
    const yetenek = yetenekOlustur(baglanti, icerik, {
      grupCanliMi: await this.butunluk.grupCanliMi(islem, baglanti.grupId),
      rolCanliMi: await this.butunluk.rolCanliMi(islem, baglanti.rolId),
      izin: await this.izinOlgulari(islem, baglanti, icerik),
      kokSuperAdminKumesiMi: await this.butunluk.kokSuperAdminKumesiMi(
        islem,
        baglanti.grupId,
        baglanti.rolId,
      ),
    });
    if (yetenek.tur === 'ret') {
      throw hata(yetenek.neden);
    }
    return yetenek.deger;
  }

  // İzin görülemiyorsa ya da kaynağı ve eylemi okunamıyorsa undefined. Satır ortak koddaki derleyiciye
  // verilir: derleme yalnız satırı sorgu koşuluna çevirir, hiçbir kayıt üzerinde karar verilmez. Yer
  // tutucular derlenebilirlik için yazanın kimliği ve yalnız yeteneğin grubundan oluşan alt grup
  // listesiyle çözülür; okumada kişinin gerçek verisiyle çözülürler.
  private async izinOlgulari(
    islem: Islem,
    baglanti: YetenekBaglantisi,
    icerik: YetenekIcerigi,
  ): Promise<IzinOlgulari | undefined> {
    const izin = await islem.repo(YETENEK_REPO).izin(baglanti.izinId);
    const kaynak = izin?.kaynak;
    const eylem = izin?.eylem;
    if (typeof kaynak !== 'string' || typeof eylem !== 'string') {
      return undefined;
    }
    const { oturum } = istekBaglami();
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const { derlenmeyenler } = yetenekleriDerle(
      {
        yetenekler: [
          {
            ...baglanti,
            ...icerik,
            yetenekId: 'yazilacak',
            kaynak,
            eylem,
            sart: icerik.sart ?? [],
            kolonlar: icerik.kolonlar ?? [],
            giremez: false,
            oncelik: 0,
            yasaktanMuaf: false,
          },
        ],
        altGruplar: { [baglanti.grupId]: [baglanti.grupId] },
      },
      oturum.kullaniciId,
      this.katalog,
    );
    return {
      kaynak,
      eylem,
      kaynakAlanlari: this.katalog.alanlar(kaynak) ?? [],
      derlemeHatasi: derlenmeyenler[0]?.neden,
    };
  }
}
