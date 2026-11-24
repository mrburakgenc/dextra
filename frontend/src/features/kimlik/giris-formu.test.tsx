import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { girisYap } from './eylemler';
import { GirisFormu } from './giris-formu';

vi.mock('./eylemler', () => ({ girisYap: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GirisFormu', () => {
  it('etiketler girdilere bağlıdır', () => {
    render(<GirisFormu />);

    const kullaniciAdi = screen.getByLabelText('Kullanıcı adı');
    const parola = screen.getByLabelText('Parola');
    expect(kullaniciAdi.getAttribute('name')).toBe('kullaniciAdi');
    expect(parola.getAttribute('name')).toBe('parola');
    expect(parola.getAttribute('type')).toBe('password');
  });

  it('genel hata ve alan hatası ekran okuyucuya duyurulacak biçimde görünür', async () => {
    vi.mocked(girisYap).mockResolvedValue({
      genelHata: 'Kullanıcı adı ya da parola hatalı',
      alanHatalari: { parola: 'Parola boş olamaz' },
    });
    render(<GirisFormu />);

    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));

    const uyarilar = await screen.findAllByRole('alert');
    expect(uyarilar.map((u) => u.textContent)).toEqual([
      'Kullanıcı adı ya da parola hatalı',
      'Parola boş olamaz',
    ]);
    // Alan hatası girdiye bağlıdır ve girdi geçersiz işaretlidir.
    const parola = screen.getByLabelText('Parola');
    expect(parola.getAttribute('aria-invalid')).toBe('true');
    expect(parola.getAttribute('aria-describedby')).toBe(uyarilar[1]?.id);
    expect(
      screen.getByLabelText('Kullanıcı adı').getAttribute('aria-invalid'),
    ).toBe('false');
  });

  it('gönderim sürerken düğme kapalıdır', async () => {
    // Hiç bitmeyen gönderim.
    vi.mocked(girisYap).mockReturnValue(new Promise(() => undefined));
    render(<GirisFormu />);
    const dugme = screen.getByRole('button', { name: 'Giriş yap' });
    expect(dugme).toHaveProperty('disabled', false);

    await userEvent.type(screen.getByLabelText('Kullanıcı adı'), 'ali');
    await userEvent.click(dugme);

    await vi.waitFor(() => {
      expect(dugme).toHaveProperty('disabled', true);
    });
    expect(girisYap).toHaveBeenCalledTimes(1);
  });
});
