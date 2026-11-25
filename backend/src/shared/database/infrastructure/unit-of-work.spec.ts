import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../database.module.js';
import type { Islem } from '../domain/islem.js';
import { RepoBelirteci } from '../domain/repo-belirteci.js';
import { Registrar, RepoKayitlari } from './registrar.js';
import { UnitOfWork } from './unit-of-work.js';

interface OrnekOkuma {
  adlar(): Promise<string[]>;
}
interface OrnekRepo extends OrnekOkuma {
  ekle(ad: string): Promise<void>;
}

const ORNEK = new RepoBelirteci<OrnekOkuma, OrnekRepo>('OrnekRepo');

const fabrika = (): OrnekRepo => ({
  adlar: () => Promise.resolve([]),
  ekle: () => Promise.resolve(),
});

describe('registrar', () => {
  it('aynı belirteç ikinci kez kaydedilince hata verir', () => {
    const registrar = new RepoKayitlari();
    registrar.register(ORNEK, fabrika);

    expect(() => {
      registrar.register(ORNEK, fabrika);
    }).toThrow('OrnekRepo zaten kayıtlı');
  });

  it('kayıtsız belirteç istenince hata verir', () => {
    const registrar = new RepoKayitlari();

    expect(() => registrar.kur(ORNEK, {} as never)).toThrow(
      'OrnekRepo kayıtlı değil',
    );
  });

  it('karşı test: kayıtlı belirteç fabrikanın kurduğu repository ile döner', () => {
    const registrar = new RepoKayitlari();
    registrar.register(ORNEK, fabrika);

    expect(registrar.kur(ORNEK, {} as never)).toHaveProperty('ekle');
  });
});

describe('derleme kapıları', () => {
  // Bu işlev çağrılmaz; yalnız typecheck sınar. Bir @ts-expect-error satırı derlenseydi tsc
  // "kullanılmayan @ts-expect-error" hatası verirdi. Hata atamada beklenir, çağrıda değil:
  // çözülemeyen tipe çağrıyı lint (no-unsafe-call) reddeder ve src altında satır içi kapatma yoktur.
  it('okuma görünümünde yazma ve run dışında tam repository derlenmez', () => {
    const derlenmeyen = async (uow: UnitOfWork): Promise<void> => {
      const okuma = uow.read(ORNEK);
      await okuma.adlar();
      // @ts-expect-error okuma görünümünde yazma metodu yoktur
      const yazan: Pick<OrnekRepo, 'ekle'> = okuma;
      await yazan.ekle('x');
      // @ts-expect-error read tam arayüzü vermez
      const tam: OrnekRepo = uow.read(ORNEK);
      await tam.ekle('x');
      // @ts-expect-error UnitOfWork bir Islem değildir; tam repository yalnız run'ın verdiği örnekten alınır
      const islemDisi: Islem = uow;
      await islemDisi.repo(ORNEK).ekle('x');
      await uow.run(async (islem) => {
        await islem.repo(ORNEK).ekle('x');
      });
    };
    const kurmaGirisimi = (registrar: Registrar): void => {
      registrar.register(ORNEK, fabrika);
      // @ts-expect-error modüllere verilen Registrar yüzü repository kurmaz; kur yalnız UnitOfWork'tedir
      const kuran: Pick<RepoKayitlari, 'kur'> = registrar;
      kuran.kur(ORNEK, {} as never);
    };

    expect(derlenmeyen).toBeTypeOf('function');
    expect(kurmaGirisimi).toBeTypeOf('function');
  });
});

describe('DatabaseModule sınırı', () => {
  // İstemci ilk sorguda bağlanır; modülü derlemek veritabanına gitmez, adresin tanımlı olması yeter.
  const modulAl = (belirtec: unknown) =>
    Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        {
          provide: 'TUKETICI',
          useFactory: (x: unknown) => x,
          inject: [belirtec as symbol],
        },
      ],
    }).compile();

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://kullanilmaz@localhost:1/yok');
    vi.stubEnv('IZ_DATABASE_URL', 'postgresql://kullanilmaz@localhost:1/yok');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('dışarıdaki modül kuran yüzü (RepoKayitlari) enjekte edemez', async () => {
    await expect(modulAl(RepoKayitlari)).rejects.toThrow(/RepoKayitlari/);
  });

  it('karşı test: dışarıdaki modül Registrar ve UnitOfWork enjekte edebilir', async () => {
    await expect(modulAl(Registrar)).resolves.toBeDefined();
    await expect(modulAl(UnitOfWork)).resolves.toBeDefined();
  });
});
