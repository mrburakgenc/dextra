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

// Kayıt sayfasındaki kolonlar (TS-004 "Yönetim ekranları"); değer, gelmeyen kolon için boş
// işareti çağıran tarafça verilir. Sunucu bileşenidir.
export function KayitSatirlari({
  satirlar,
}: Readonly<{ satirlar: readonly { etiket: string; deger: string }[] }>) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      {satirlar.map((satir) => (
        <div key={satir.etiket} className="contents">
          <dt className="font-medium">{satir.etiket}</dt>
          <dd>{satir.deger}</dd>
        </div>
      ))}
    </dl>
  );
}
