import { GirisFormu } from '../../../features/kimlik/giris-formu';

export default function GirisSayfasi() {
  return (
    <main
      id="ana-icerik"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8"
    >
      <h1 className="text-3xl font-bold">Giriş</h1>
      <GirisFormu />
    </main>
  );
}
