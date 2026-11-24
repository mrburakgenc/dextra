import { ParolaBelirleFormu } from '../../../features/kimlik/parola-belirle-formu';

// Kod adresten (?kod=...) okunur; tek ve boş olmayan değer yoksa form gösterilmez.
export default async function ParolaBelirleSayfasi({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { kod } = await searchParams;
  return (
    <main
      id="ana-icerik"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8"
    >
      <h1 className="text-3xl font-bold">Parola belirle</h1>
      {typeof kod === 'string' && kod !== '' ? (
        <ParolaBelirleFormu kod={kod} />
      ) : (
        <p>
          Bu bağlantıda parola belirleme kodu yok. Size gönderilen bağlantıyı
          eksiksiz açın.
        </p>
      )}
    </main>
  );
}
