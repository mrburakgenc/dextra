import { ParolaDegistirFormu } from '../../../features/kimlik/parola-degistir-formu';

// Parolamı değiştir (TS-004 "Parola değiştirme ve oturumlar ekranları"): oturumu olan herkesin
// işidir; yetenek aranmaz.
export default function ParolaSayfasi() {
  return (
    <main id="ana-icerik" className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <h1 className="text-3xl font-bold">Parolamı değiştir</h1>
      <ParolaDegistirFormu />
    </main>
  );
}
