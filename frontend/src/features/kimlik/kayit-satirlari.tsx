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
