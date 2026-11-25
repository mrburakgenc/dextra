// Seçim isteyen formun yerine çıkan ileti (TS-004 "Yönetim formlarının sertleştirilmesi"): verilen
// listelerden alınamayan (null) her biri için adını söyleyen bir satır ('Grup listesi alınamadı').
export function AlinamayanListeler({
  listeler,
}: Readonly<{ listeler: Readonly<Record<string, unknown>> }>) {
  return Object.entries(listeler)
    .filter(([, liste]) => liste === null)
    .map(([ad]) => (
      <p key={ad} role="alert">
        {ad} listesi alınamadı
      </p>
    ));
}
