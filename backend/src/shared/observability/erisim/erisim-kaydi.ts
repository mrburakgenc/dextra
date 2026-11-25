import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { concatMap, type Observable } from 'rxjs';
import { IZ_PRISMA_CLIENT } from '../../database/domain/istemci-belirtecleri.js';
import type { PrismaClient as IzPrismaClient } from '../../database/iz/generated/client.js';
import { yeniKimlik } from '../../database/domain/kimlik.js';
import { istekBaglami } from '../../http/istek-baglami.js';
import { okumaBirikimi } from '../../yetki/infrastructure/okuma-kapisi.js';

// Erişim kaydının yazımı (KR-013 Seçim 2 ve 6; KR-011 Seçim 9; TS-003 Seçenek 1: A). Bütün uçlara
// bağlanır. İstek oturumluysa, yetki kapısından okuma yapmışsa ve yazma işareti yoksa (TS-002 AK-40),
// cevap gönderilmeden önce iz veritabanına kendi istemcisiyle bir erişim kaydı yazar: kim, hangi
// istekte, hangi uçta, hangi rota deseninde, kaç kayıt okudu ve okumada hangi yetenek ve üyelikler
// kullanıldı. Yazma yapan istekte yazılmaz; o isteğin izi değişiklik kaydıdır. Dönen kayıtların
// kimlikleri yazılmaz. Kayıt yazılamazsa hata uca döner ve okuma
// reddedilir; veri cevaba çıkmaz.
@Injectable()
export class ErisimKaydiYazici implements NestInterceptor {
  constructor(@Inject(IZ_PRISMA_CLIENT) private readonly iz: IzPrismaClient) {}

  intercept(baglam: ExecutionContext, sonraki: CallHandler): Observable<unknown> {
    // Kayıt yalnız uç başarıyla döndüğünde yazılır: erişim kaydı verinin cevaba çıktığını anlatır, hata
    // ile biten istekte veri çıkmamıştır.
    return sonraki.handle().pipe(
      concatMap(async (cevap: unknown) => {
        const { istekKimligi, oturum, yazmaAcildi } = istekBaglami();
        const birikim = okumaBirikimi();
        // Kapı okumaya katılan her kuralın yeteneğini biriktirir. Yetenek yoksa ya kapıdan okuma
        // yapılmamıştır ya da okumaya hiçbir kural katılmadığı için hiçbir kayıt dönmemiştir.
        if (
          oturum !== undefined &&
          birikim.yetenekIdleri.length > 0 &&
          !yazmaAcildi
        ) {
          await this.iz.erisimKaydi.create({
            data: {
              id: yeniKimlik(),
              istekId: istekKimligi,
              kullaniciId: oturum.kullaniciId,
              isAdi: `${baglam.getClass().name}.${baglam.getHandler().name}`,
              // Rota deseni; adresin kendisi ve sorgu dizgesi yazılmaz.
              erisilenYer: baglam
                .switchToHttp()
                .getRequest<{ route: { path: string } }>().route.path,
              kayitSayisi: birikim.kayitSayisi,
              olusmaZamani: new Date(),
              yetenekler: {
                create: birikim.yetenekIdleri.map((yetenekId) => ({
                  yetenekId,
                })),
              },
              uyelikler: {
                create: birikim.uyelikIdleri.map((uyelikId) => ({
                  uyelikId,
                })),
              },
            },
          });
        }
        return cevap;
      }),
    );
  }
}
