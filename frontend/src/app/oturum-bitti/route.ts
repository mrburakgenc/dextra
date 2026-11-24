import { redirect } from 'next/navigation';
import { oturumCerezleriniSil } from '../../shared/oturum/cerezler';

// Oturum bitti yolu (TS-004): sunucu bileşeni çerez değiştiremediği için backend'in 401'inde
// buraya yönlendirir. İşleyici yalnız üç oturum çerezini siler ve giriş ekranına döner;
// backend'e istek atmaz.
export async function GET(): Promise<never> {
  await oturumCerezleriniSil();
  redirect('/giris');
}
