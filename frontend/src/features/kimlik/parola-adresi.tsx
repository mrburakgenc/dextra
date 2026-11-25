// İşin cevabında gelen parola belirleme adresi; yalnız bu çizimde gösterilir, hiçbir yere
// yazılmaz (TS-004 "Yönetim ekranları"). Ekran okuyucuya duyurulur.
export function ParolaAdresi({ adres }: Readonly<{ adres: string }>) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded border border-gray-500 p-4">
      <p className="font-medium">Parola belirleme adresi</p>
      <p className="break-all font-mono">{adres}</p>
      <p className="font-medium text-red-700">
        Bu kod yeniden gösterilmez. Adresi şimdi kişiye ilet.
      </p>
    </div>
  );
}
