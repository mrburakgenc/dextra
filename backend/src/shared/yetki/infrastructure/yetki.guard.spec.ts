import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ExecutionContext } from '@nestjs/common';
import {
  HerkeseAcik,
  Izin,
  YalnizKendisi,
} from '../../guvenlik/application/isaretler.js';
import type {
  YetenekSatiri,
  YetkiVerisi,
} from '../../kimlik/domain/i-yetki-verisi.contract.js';
import {
  type IstekOturumu,
  istekBaglamiAraKatmani,
  istekOturumunuYaz,
} from '../../observability/istek-baglami/istek-baglami.js';
import { prismaKaynakKatalogu } from './prisma-kaynak-katalogu.js';
import { YetkiBellegi } from './yetki-bellegi.js';
import { YetkiGuard } from './yetki.guard.js';

// Yetki guard'ı kapalı düşer (AK-37): işareti olmayan uçta oturum olsa da olmasa da yetki_yok döner.
// Sahte olan yalnız veritabanı sınırıdır (yetki verisi); bellek ve derleyici gerçektir.
describe("yetki guard'ı", () => {
  class Uclar {
    isaretsiz(): void {
      return undefined;
    }

    @HerkeseAcik()
    acik(): void {
      return undefined;
    }

    @YalnizKendisi()
    kendisi(): void {
      return undefined;
    }

    @Izin('Kullanici', 'oku')
    kullaniciOku(): void {
      return undefined;
    }
  }

  const oturum: IstekOturumu = {
    kullaniciId: 'k1',
    oturumId: 'o1',
    kisiSurumu: 1,
    genelSurum: 1,
  };

  const okumaYetenegi: YetenekSatiri = {
    yetenekId: 'y1',
    grupId: 'g1',
    rolId: 'r1',
    kaynak: 'Kullanici',
    eylem: 'oku',
    sart: [],
    butunKayitlar: true,
    butunBirimler: true,
    kolonlar: [],
    butunKolonlar: true,
    giremez: false,
    oncelik: 0,
    yasaktanMuaf: false,
  };

  function guard(yetenekler: readonly YetenekSatiri[]): YetkiGuard {
    const veri: YetkiVerisi = {
      surumler: () => Promise.resolve({ kisiSurumu: 1, genelSurum: 1 }),
      kisininSatirlari: () =>
        Promise.resolve({
          kisiSurumu: 1,
          genelSurum: 1,
          uyelikler: [{ uyelikId: 'u1', grupId: 'g1', rolId: 'r1' }],
          yetenekler,
          altGruplar: { g1: ['g1'] },
        }),
    };
    return new YetkiGuard(
      new YetkiBellegi(veri, prismaKaynakKatalogu(['Kullanici'])),
    );
  }

  // Guard'ı, istenirse oturumu yazılmış bir istek bağlamında verilen işleyici için koşturur.
  function kostur(
    g: YetkiGuard,
    isleyici: keyof Uclar,
    istekOturumu?: IstekOturumu,
  ): Promise<boolean> {
    const baglam = {
      // Ucun metodu; guard'ın çalışma anında aldığı işleyici de bu fonksiyondur.
      getHandler: () => Reflect.get(Uclar.prototype, isleyici) as object,
    } as unknown as ExecutionContext;
    return new Promise<boolean>((coz, reddet) => {
      istekBaglamiAraKatmani(
        {} as unknown as IncomingMessage,
        { setHeader: () => undefined } as unknown as ServerResponse,
        () => {
          if (istekOturumu !== undefined) {
            istekOturumunuYaz(istekOturumu);
          }
          g.canActivate(baglam).then(coz, reddet);
        },
      );
    });
  }

  const yetkiYok = { kod: 'yetki_yok' };

  it('işaretsiz işleyicide oturum varken yetki_yok döner', async () => {
    await expect(
      kostur(guard([okumaYetenegi]), 'isaretsiz', oturum),
    ).rejects.toMatchObject(yetkiYok);
  });

  it('işaretsiz işleyicide oturum yokken yetki_yok döner', async () => {
    await expect(kostur(guard([]), 'isaretsiz')).rejects.toMatchObject(
      yetkiYok,
    );
  });

  it('herkese açık işleyicide oturumsuz istek geçer', async () => {
    await expect(kostur(guard([]), 'acik')).resolves.toBe(true);
  });

  it('yalnız kendisi işaretli işleyicide oturumlu istek yeteneksiz de geçer', async () => {
    await expect(kostur(guard([]), 'kendisi', oturum)).resolves.toBe(true);
  });

  it('izin işaretli işleyicide o kaynak ve eylem için yeteneği olan kişi geçer', async () => {
    await expect(
      kostur(guard([okumaYetenegi]), 'kullaniciOku', oturum),
    ).resolves.toBe(true);
  });

  it('izin işaretli işleyicide yeteneği olmayan kişiye yetki_yok döner', async () => {
    await expect(
      kostur(guard([]), 'kullaniciOku', oturum),
    ).rejects.toMatchObject(yetkiYok);
  });

  it('izin işaretli işleyicide oturum yoksa yetki_yok döner', async () => {
    await expect(kostur(guard([]), 'kullaniciOku')).rejects.toMatchObject(
      yetkiYok,
    );
  });
});
