import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import {
  YETENEK_REPO,
  type YeniYetenek,
  YetenekYazmaRepo,
} from '../domain/yetenek.repository.js';
import { YetenekOlusturHandler } from './yetenek-olustur.handler.js';

// İşin adı; kapının iki notuna da yazılır.
const IS_ADI = 'kimlik:yetenek-yenile';

// Kararın baktığı kolonlar. Biri görülemiyorsa satırın korunan olup olmadığı bilinemez (TS-002 AK-46
// eki).
const KARAR_KOLONLARI = [
  'sistemSatiri',
  'tohumAnahtari',
  'grupId',
  'rolId',
  'izinId',
  'silinmeZamani',
];

// Yenilemenin değiştirdiği içerik; grup, rol ve izin eski satırdan alınır.
export type YetenekIcerigi = Omit<
  YeniYetenek,
  'grupId' | 'rolId' | 'izinId' | 'yerineGectigiId'
>;

// Yetenek yenile (TS-002 "İşlem sınırları", "Durum geçişleri", AK-39, AK-46 ve eki; değişmez 6). Tek
// işlemde: genel sayaç satırı kilitlenir ve artırılır (yetenek yazan bütün işler aynı satırı kilitlediği
// için okuma ile yazma arasında satır değişmez); eski satır yetki kapısından okunur (görülemeyen ya da
// var olmayan kayıt bulunamadi); karar kolonlarından birini göremeyen kişi yenileyemez (yetki_yok);
// silinmiş satır bulunamadi; sistem satırı ve tohum satırı yenilenmez, onları tohum göçü değiştirir
// (cakisma). Eski satır kapının niyet yoluyla Yetenek:yenile yeteneğiyle kapatılır; yeni içerik yetenek
// yaz'ın denetimlerinden geçer; yeni satır kapının oluşturma yoluyla Yetenek:olustur yeteneğiyle,
// yerineGectigiId ve köken 'yonetici' ile yazılır. Yenileme iki yeteneği de ister. Olay yazılmaz (AK-39).
@Injectable()
export class YetenekYenileHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: YetenekYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly olustur: YetenekOlusturHandler,
  ) {}

  calistir(id: string, icerik: YetenekIcerigi): Promise<string> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const eski = await islem.repo(YETENEK_REPO).tek(id);
      if (KARAR_KOLONLARI.some((kolon) => !(kolon in eski))) {
        throw new KodluHata('yetki_yok', 'Bu işlem için yetki yok');
      }
      if (eski['silinmeZamani'] !== null) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      if (eski['sistemSatiri'] !== false || eski['tohumAnahtari'] !== null) {
        throw new KodluHata(
          'cakisma',
          'Sistem satırı ve tohum satırı yenilenemez',
        );
      }
      await this.repo.kapat(islem, IS_ADI, id);
      const { grupId, rolId, izinId } = eski as Record<
        'grupId' | 'rolId' | 'izinId',
        string
      >;
      const yeni: YeniYetenek = { ...icerik, grupId, rolId, izinId };
      await this.olustur.dogrula(islem, yeni);
      return this.repo.olustur(islem, IS_ADI, {
        ...yeni,
        yerineGectigiId: id,
      });
    });
  }
}
