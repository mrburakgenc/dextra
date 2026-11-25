import { tarihSaat } from '../../shared/bicim/bicim';

// Kayıt sayfasının başlığı. Silinme zamanı dolu kayıtta başlığın yanında 'Silinmiş' işareti ve
// silinme zamanı görünür (TS-004 "Yönetim formlarının sertleştirilmesi"); kolon gelmediyse ya da
// boşsa yalnız başlık vardır. Sunucu bileşenidir.
export function KayitBasligi({
  baslik,
  silinmeZamani,
}: Readonly<{ baslik: string; silinmeZamani: string | null | undefined }>) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      <h1 className="text-3xl font-bold">{baslik}</h1>
      {typeof silinmeZamani === 'string' && (
        <p>
          <span className="rounded bg-red-100 px-2 font-medium text-red-800">Silinmiş</span>{' '}
          {tarihSaat(silinmeZamani)}
        </p>
      )}
    </div>
  );
}

// Alan kayıtta var mı (TS-004 "Yönetim ekranları"): kişinin göremediği kolon kayıtta gelmez
// (undefined); gelmiş ama boş kolon null'dır. Birden çok alandan türeyen satır, alanlarından biri
// gelmişse vardır.
export function alanGeldi<T extends object>(kayit: T, alanlar: readonly (keyof T)[]): boolean {
  return alanlar.some((alan) => kayit[alan] !== undefined);
}

// Kayıt sayfasındaki kolonlar (TS-004 "Yönetim ekranları"): alanları kayıtta gelmeyen satır
// (etiketi ve değeri) çizilmez; gelmiş boş alanın boş işaretini çağıran taraf verir. Sunucu
// bileşenidir.
export function KayitSatirlari<T extends object>({
  kayit,
  satirlar,
}: Readonly<{
  kayit: T;
  satirlar: readonly { etiket: string; alanlar: readonly (keyof T)[]; deger: string }[];
}>) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      {satirlar.filter((satir) => alanGeldi(kayit, satir.alanlar)).map((satir) => (
        <div key={satir.etiket} className="contents">
          <dt className="font-medium">{satir.etiket}</dt>
          <dd>{satir.deger}</dd>
        </div>
      ))}
    </dl>
  );
}
