import type { RepoIstemcisi } from '../../database/infrastructure/registrar.js';
import { KodluHata } from '../../http/domain/kodlu-hata.js';
import { OkumaKapisi } from './okuma-kapisi.js';
import { prismaKaynakKatalogu } from './prisma-kaynak-katalogu.js';

// TS-002 AK-44: çağıranın koşulunda alanın tipine uymayan değer (uç şemasından kaçmış) veritabanına
// gitmez ve doğrulama hatası olur; kodun yazdığı işleç hatası öyle kalır (500'e düşen düz hata).
describe('okuma kapısı: koşulun tip uyumu', () => {
  const findMany = vi.fn();
  const istemci = { kullanici: { findMany } } as unknown as RepoIstemcisi;
  const kapi = new OkumaKapisi(prismaKaynakKatalogu(['Kullanici']));

  it('kimlik alanına kimlik biçiminde olmayan değer dogrulama_hatasi olur ve sorgu atılmaz', async () => {
    const hata: unknown = await kapi
      .liste(istemci, 'Kullanici', {
        kosul: [{ alan: 'id', islec: 'esit', deger: 'kimlik-degil' }],
      })
      .catch((e: unknown) => e);

    expect(hata).toBeInstanceOf(KodluHata);
    expect(hata).toMatchObject({
      kod: 'dogrulama_hatasi',
      ayrinti: [{ alan: 'kosul', neden: 'değer alanın tipine uymuyor: id' }],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('mantıksal alanına metin dogrulama_hatasi olur', async () => {
    await expect(
      kapi.liste(istemci, 'Kullanici', {
        kosul: [{ alan: 'sistemAktoru', islec: 'esit', deger: 'evet' }],
      }),
    ).rejects.toMatchObject({ kod: 'dogrulama_hatasi' });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('integer aralığının dışındaki sayı ve tekil işlece liste dogrulama_hatasi olur', async () => {
    await expect(
      kapi.liste(istemci, 'Kullanici', {
        kosul: [{ alan: 'yetkiSurumu', islec: 'buyuk', deger: 3000000000 }],
      }),
    ).rejects.toMatchObject({ kod: 'dogrulama_hatasi' });
    await expect(
      kapi.liste(istemci, 'Kullanici', {
        kosul: [{ alan: 'gorunenAd', islec: 'esit', deger: ['a', 'b'] }],
      }),
    ).rejects.toMatchObject({ kod: 'dogrulama_hatasi' });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('tipe uymayan işleç doğrulama hatası değildir', async () => {
    const hata: unknown = await kapi
      .liste(istemci, 'Kullanici', {
        kosul: [{ alan: 'gorunenAd', islec: 'buyuk', deger: 'a' }],
      })
      .catch((e: unknown) => e);

    expect(hata).not.toBeInstanceOf(KodluHata);
    expect(hata).toEqual(
      new Error(
        'Okuma koşulu çevrilemedi: işleç alanın tipine uymuyor: gorunenAd',
      ),
    );
  });
});
