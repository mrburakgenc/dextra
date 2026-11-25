import 'server-only';
import { alanHatalari, type BackendHatasi, kimlikGerekliyseGiriseDon } from '../../shared/backend/hata';
import type { FormDurumu } from './form-durumu';

// Rol ve grup işlerinin backend hatası (TS-004 "Yönetim ekranları"): 401 çerezleri silip giriş
// ekranına döner (fırlatır); dogrulama_hatasi alanlara dağılır; 403 ve 404 sabit ileti olur;
// öbürleri (409 cakisma, ulaşılamadı) backend'in iletisidir.

export const YETKI_YOK = 'Bu iş için yetkin yok';
export const KAYIT_BULUNAMADI = 'Kayıt bulunamadı';

export async function isHatasi(hata: BackendHatasi): Promise<FormDurumu> {
  await kimlikGerekliyseGiriseDon(hata);
  const alanlar = alanHatalari(hata);
  if (Object.keys(alanlar).length > 0) {
    return { genelHata: null, alanHatalari: alanlar };
  }
  if (hata.kod === 'yetki_yok') {
    return { genelHata: YETKI_YOK, alanHatalari: {} };
  }
  if (hata.kod === 'bulunamadi') {
    return { genelHata: KAYIT_BULUNAMADI, alanHatalari: {} };
  }
  return { genelHata: hata.ileti, alanHatalari: {} };
}
