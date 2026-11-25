import { prismaKaynakKatalogu } from './prisma-kaynak-katalogu.js';

// TS-008 "Veri modeli": katalog her kolonun boş olabilirliğini taşır; tablonun şemaya uyumunu tip
// denetimi sınar.
describe('kaynak kataloğu: boş olabilirlik', () => {
  const katalog = prismaKaynakKatalogu(['Grup', 'Yetenek']);

  it('kaynağın şartta kullanılabilen her kolonu için boş olabilirliği verir; şarta giremeyen kolon yoktur', () => {
    expect(katalog.bosOlabilirlik('Grup')).toEqual({
      id: false,
      ustGrupId: true,
      ad: false,
      silinmeZamani: true,
      olusturmaZamani: false,
    });
    const tipler = katalog.alanTipleri('Yetenek') ?? {};
    expect(Object.keys(katalog.bosOlabilirlik('Yetenek') ?? {})).toEqual(
      katalog.alanlar('Yetenek')?.filter((alan) => tipler[alan] !== 'obur'),
    );
    expect(katalog.bosOlabilirlik('Yetenek')).not.toHaveProperty('sart');
    expect(katalog.bosOlabilirlik('Yetenek')).not.toHaveProperty('kolonlar');
  });

  it('katalogda olmayan kaynak için tanımsızdır', () => {
    expect(katalog.bosOlabilirlik('Kullanici')).toBeUndefined();
  });
});
