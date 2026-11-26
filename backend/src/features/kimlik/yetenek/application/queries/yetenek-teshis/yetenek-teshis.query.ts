// Yetenek teşhisi sorgusu: GET kimlik/yetenek/teshis sorgu dizgesinin şeması ve ondan türeyen sorgu tipi
// (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-32; KR-014). kullaniciId teşhis edilen kişidir,
// isteği yapan değil. Kaynak ve eylemin izin kataloğunda olup olmadığına repository bakar.
import { z } from 'zod';

export const yetenekTeshisSorgusuSemasi = z.strictObject({
  kullaniciId: z.uuid(),
  kaynak: z.string().min(1),
  eylem: z.string().min(1),
  kayitId: z.uuid(),
});

export type YetenekTeshisSorgusu = z.output<typeof yetenekTeshisSorgusuSemasi>;
