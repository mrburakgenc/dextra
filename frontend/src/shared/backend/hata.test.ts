// @vitest-environment node
import { redirect } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { oturumCerezleriniSil } from '../oturum/cerezler';
import {
  alanHatalari,
  hataGovdesiniOku,
  kimlikGerekliyseGiriseDon,
  kimlikGerekliyseOturumuBitir,
} from './hata';

vi.mock('server-only', () => ({}));
vi.mock('../oturum/cerezler', () => ({ oturumCerezleriniSil: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('yonlendirildi');
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('hata eşleme', () => {
  it('backend hata gövdesini koda, iletiye ve ayrıntıya çevirir', () => {
    expect(
      hataGovdesiniOku(
        { kod: 'yetki_yok', ileti: 'Yetkin yok', ayrinti: null },
        403,
      ),
    ).toEqual({ kod: 'yetki_yok', ileti: 'Yetkin yok', ayrinti: null, durum: 403 });
  });

  it('tanınmayan gövde beklenmeyen hatadır', () => {
    expect(hataGovdesiniOku({ mesaj: 'iç ayrıntı' }, 500)).toEqual({
      kod: 'beklenmeyen_hata',
      ileti: 'Beklenmeyen bir hata oluştu',
      ayrinti: null,
      durum: 500,
    });
  });

  it('dogrulama_hatasi ayrıntısını alan adından iletiye eşler; aynı alanın ilk iletisi kalır', () => {
    const hata = hataGovdesiniOku(
      {
        kod: 'dogrulama_hatasi',
        ileti: 'İstek doğrulanamadı',
        ayrinti: [
          { alan: 'kullaniciAdi', neden: 'Boş olamaz' },
          { alan: 'parola', neden: 'Çok kısa' },
          { alan: 'parola', neden: 'Rakam içermeli' },
        ],
      },
      400,
    );
    expect(alanHatalari(hata)).toEqual({
      kullaniciAdi: 'Boş olamaz',
      parola: 'Çok kısa',
    });
  });

  it('başka kodda ya da tanınmayan ayrıntıda alan hatası yoktur', () => {
    expect(
      alanHatalari({ kod: 'cakisma', ileti: 'x', ayrinti: [{ alan: 'a', neden: 'b' }], durum: 409 }),
    ).toEqual({});
    expect(
      alanHatalari({ kod: 'dogrulama_hatasi', ileti: 'x', ayrinti: 'bozuk', durum: 400 }),
    ).toEqual({});
  });

  it('kimlik_gerekli gelince çerezleri silip giriş ekranına yönlendirir', async () => {
    await expect(
      kimlikGerekliyseGiriseDon({
        kod: 'kimlik_gerekli',
        ileti: 'Oturum gerekli',
        ayrinti: null,
        durum: 401,
      }),
    ).rejects.toThrow('yonlendirildi');
    expect(oturumCerezleriniSil).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/giris');
  });

  it('başka kodda çerezlere dokunmaz ve yönlendirmez', async () => {
    await kimlikGerekliyseGiriseDon({
      kod: 'yetki_yok',
      ileti: 'Yetkin yok',
      ayrinti: null,
      durum: 403,
    });
    expect(oturumCerezleriniSil).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sunucu bileşenindeki kimlik_gerekli çerezlere dokunmadan /oturum-bitti adresine yönlendirir', () => {
    expect(() => {
      kimlikGerekliyseOturumuBitir({
        kod: 'kimlik_gerekli',
        ileti: 'Oturum gerekli',
        ayrinti: null,
        durum: 401,
      });
    }).toThrow('yonlendirildi');
    expect(redirect).toHaveBeenCalledWith('/oturum-bitti');
    expect(oturumCerezleriniSil).not.toHaveBeenCalled();
  });

  it('sunucu bileşeninde başka kodda yönlendirmez', () => {
    kimlikGerekliyseOturumuBitir({
      kod: 'yetki_yok',
      ileti: 'Yetkin yok',
      ayrinti: null,
      durum: 403,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
