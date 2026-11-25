import type { UstGrupSecenekleri } from './grup-listesi';

// Üst grup seçimi (TS-004 "Yönetim ekranları" ve form kuralları): etiketi seçime bağlıdır, hatası
// seçimin yanında ve ekran okuyucuya duyurulur. Seçenekler grup listesinin ilk 100 kaydıdır;
// daha fazlası varsa seçimin altında not gösterilir. Çatı seçimin varsayılanını sonradan
// güncellemediği için seçim varsayılan değişince yeniden kurulur.
export function UstGrupAlani({
  etiket,
  secenekler,
  varsayilan,
  hata,
}: Readonly<{
  etiket: string;
  secenekler: UstGrupSecenekleri;
  varsayilan: string | undefined;
  hata: string | undefined;
}>) {
  const hataKimligi = 'ustGrupId-hata';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="ustGrupId" className="font-medium">
        {etiket}
      </label>
      <select
        key={varsayilan ?? ''}
        id="ustGrupId"
        name="ustGrupId"
        defaultValue={varsayilan ?? ''}
        aria-invalid={hata !== undefined}
        aria-describedby={hata === undefined ? undefined : hataKimligi}
        className="rounded border border-gray-500 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <option value="">Seç</option>
        {secenekler.gruplar.map((grup) => (
          <option key={grup.id} value={grup.id}>
            {grup.etiket}
          </option>
        ))}
      </select>
      {secenekler.dahaFazlasiVar && <p className="text-sm">İlk 100 grup gösteriliyor</p>}
      {hata !== undefined && (
        <p id={hataKimligi} role="alert" className="text-sm text-red-700">
          {hata}
        </p>
      )}
    </div>
  );
}
