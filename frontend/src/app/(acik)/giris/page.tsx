import { GirisFormu } from '../../../features/kimlik/giris-formu';

// Parola değişince gelinen adres ?parola=degisti taşır (TS-004 "Parola değiştirme ve oturumlar
// ekranları"); not yalnız bu tam değerle çıkar, sorgudaki hiçbir metin ekrana yazılmaz.
export default async function GirisSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { parola } = await searchParams;
  return (
    <main
      id="ana-icerik"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8"
    >
      <h1 className="text-3xl font-bold">Giriş</h1>
      {parola === 'degisti' && (
        <p role="status" className="font-medium">
          Parolan değişti; yeniden gir
        </p>
      )}
      <GirisFormu />
    </main>
  );
}
