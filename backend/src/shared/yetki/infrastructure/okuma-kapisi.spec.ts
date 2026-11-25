import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  istekBaglamiAraKatmani,
  istekYetkisiniYaz,
} from '../../observability/istek-baglami/istek-baglami.js';
import type { DerlemeSonucu } from '../application/yetenek-derleyici.js';
import { OkumaKapisi, okumaBirikimi } from './okuma-kapisi.js';
import { prismaKaynakKatalogu } from './prisma-kaynak-katalogu.js';

// TS-007 "Yapı": yeni yüz satır süzgecini, kolon seçimini ve okumayı kapatan işlevi verir; sorguyu
// repository atar. Kurallar elle yazılır; derleyici yolu e2e testlerindedir.
describe('okuma kapısı: yeni yüz (yetki)', () => {
  const kapi = new OkumaKapisi(prismaKaynakKatalogu(['Kullanici']));

  interface Satir {
    readonly id: string;
    readonly gorunenAd?: string;
    readonly kullaniciAdi?: string;
  }

  const ad = {
    action: 'oku',
    subject: 'Kullanici',
    fields: ['gorunenAd'],
    conditions: { gorunenAd: { equals: 'A' } },
    yetenekId: 'y1',
  };
  const kullaniciAdi = {
    action: 'oku',
    subject: 'Kullanici',
    fields: ['kullaniciAdi'],
    conditions: { sistemAktoru: { equals: false } },
    yetenekId: 'y2',
  };

  // İşi, yalnız verilen kuralları taşıyan bir istek bağlamının içinde koşturur.
  function istekte<T>(
    kurallar: readonly object[],
    is: () => Promise<T>,
  ): Promise<T> {
    const yetki = {
      kurallar,
      derlenmeyenler: [],
      uyelikler: { y1: 'u1' },
    } as unknown as DerlemeSonucu;
    return new Promise<T>((coz, reddet) => {
      istekBaglamiAraKatmani(
        {} as unknown as IncomingMessage,
        { setHeader: () => undefined } as unknown as ServerResponse,
        () => {
          istekYetkisiniYaz(yetki);
          is().then(coz, reddet);
        },
      );
    });
  }

  it('kuralı olmayan kişide süzgeç hiçbir satıra uymaz, seçim yalnız kimliktir, okuma boş kapanır', async () => {
    const yenidenOku = vi.fn(() => Promise.resolve<Satir[]>([]));
    const sonuc = await istekte([], async () => {
      const yetki = kapi.yetki('Kullanici', { bakilan: [] });
      return {
        satirlar: yetki.satirlar,
        kolonlar: yetki.kolonlar,
        kayitlar: await yetki.kayitlar<Satir>([], yenidenOku),
        birikim: okumaBirikimi(),
      };
    });

    expect(sonuc).toEqual({
      satirlar: { id: { in: [] } },
      kolonlar: { id: true },
      kayitlar: [],
      birikim: { yetenekIdleri: [], uyelikIdleri: [], kayitSayisi: 0 },
    });
    expect(yenidenOku).not.toHaveBeenCalled();
  });

  it('koşulsuz kural süzgeci koşulsuz yapar; kolon kümeleri aynıysa ilk sorgu kolonları seçer ve yeniden okunmaz', async () => {
    const kosulsuz = { ...ad, conditions: undefined };
    const yenidenOku = vi.fn(() => Promise.resolve<Satir[]>([]));
    const sonuc = await istekte([ad, kosulsuz], async () => {
      const yetki = kapi.yetki('Kullanici', { bakilan: [] });
      return {
        satirlar: yetki.satirlar,
        kolonlar: yetki.kolonlar,
        kayitlar: await yetki.kayitlar<Satir>(
          [{ id: 'k1', gorunenAd: 'A' }],
          yenidenOku,
        ),
      };
    });

    expect(sonuc).toEqual({
      satirlar: {},
      kolonlar: { id: true, gorunenAd: true },
      kayitlar: [{ id: 'k1', gorunenAd: 'A' }],
    });
    expect(yenidenOku).not.toHaveBeenCalled();
  });

  it('kolon kümeleri farklıysa kayıtlar kural başına yeniden okunur, kimlikte birleşir ve birikim yazılır', async () => {
    const yenidenOku = vi.fn((where: unknown) =>
      Promise.resolve<Satir[]>(
        JSON.stringify(where).includes('gorunenAd')
          ? [
              { id: 'k1', gorunenAd: 'A' },
              { id: 'k2', gorunenAd: 'A' },
            ]
          : [{ id: 'k2', kullaniciAdi: 'b' }],
      ),
    );
    const sonuc = await istekte([ad, kullaniciAdi], async () => {
      const yetki = kapi.yetki('Kullanici', { bakilan: [] });
      return {
        satirlar: yetki.satirlar,
        kolonlar: yetki.kolonlar,
        kayitlar: await yetki.kayitlar<Satir>(
          [{ id: 'k1' }, { id: 'k2' }],
          yenidenOku,
        ),
        birikim: okumaBirikimi(),
      };
    });

    expect(sonuc).toEqual({
      satirlar: { OR: [ad.conditions, kullaniciAdi.conditions] },
      kolonlar: { id: true },
      kayitlar: [
        { id: 'k1', gorunenAd: 'A' },
        { id: 'k2', gorunenAd: 'A', kullaniciAdi: 'b' },
      ],
      birikim: {
        yetenekIdleri: ['y1', 'y2'],
        uyelikIdleri: ['u1'],
        kayitSayisi: 2,
      },
    });
    expect(yenidenOku.mock.calls).toEqual([
      [
        { AND: [{ id: { in: ['k1', 'k2'] } }, ad.conditions] },
        { id: true, gorunenAd: true },
      ],
      [
        { AND: [{ id: { in: ['k1', 'k2'] } }, kullaniciAdi.conditions] },
        { id: true, kullaniciAdi: true },
      ],
    ]);
  });

  it('bakılan kolonu göremeyen kural okumaya katılmaz', async () => {
    const sonuc = await istekte([ad, kullaniciAdi], () => {
      const yetki = kapi.yetki('Kullanici', { bakilan: ['kullaniciAdi'] });
      return Promise.resolve({
        satirlar: yetki.satirlar,
        kolonlar: yetki.kolonlar,
      });
    });

    expect(sonuc).toEqual({
      satirlar: { OR: [kullaniciAdi.conditions] },
      kolonlar: { id: true, kullaniciAdi: true },
    });
  });
});
