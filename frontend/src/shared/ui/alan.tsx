// Etiketi girdiye bağlı, hatası girdinin yanında ve ekran okuyucuya duyurulan form alanı
// (kanon A11Y-02, A11Y-07; TS-004 form kuralları).
export function Alan({
  ad,
  etiket,
  tur,
  otomatikTamamlama,
  hata,
}: Readonly<{
  ad: string;
  etiket: string;
  tur: 'text' | 'password';
  otomatikTamamlama: string;
  hata: string | undefined;
}>) {
  const hataKimligi = `${ad}-hata`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={ad} className="font-medium">
        {etiket}
      </label>
      <input
        id={ad}
        name={ad}
        type={tur}
        autoComplete={otomatikTamamlama}
        aria-invalid={hata !== undefined}
        aria-describedby={hata === undefined ? undefined : hataKimligi}
        className="rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      />
      {hata !== undefined && (
        <p id={hataKimligi} role="alert" className="text-sm text-red-700">
          {hata}
        </p>
      )}
    </div>
  );
}
