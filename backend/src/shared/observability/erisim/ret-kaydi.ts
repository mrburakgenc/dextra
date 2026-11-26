import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, type Observable } from 'rxjs';
import { IZ_PRISMA_CLIENT } from '../../database/domain/istemci-belirtecleri.js';
import type { PrismaClient as IzPrismaClient } from '../../database/iz/generated/client.js';
import { yeniKimlik } from '../../database/domain/kimlik.js';
import { istekBaglami } from '../istek-baglami/istek-baglami.js';
import { YasakReddi } from '../../yetki/infrastructure/yazma-kapisi.js';

// Ret kaydının yazımı (TS-008 "Yazma" ve AK-5; kapanan AU-23 ve AU-31). Bütün uçlara bağlanır. Uçtan
// yasağın reddi (YasakReddi) çıkarsa iz veritabanına erişim kaydının istemcisiyle bir satır yazar: kim,
// hangi istekte, hangi eylem, kaynak ve kayıtta, hangi yasak yüzünden. Ret run'dan çıkmış ve iş geri
// alınmıştır; ret kaydı o işlemin dışındadır ve kalır. Yasak yüzünden olmayan ret ve okuma yazılmaz.
// Her ret ayrı satırdır. Kayıt yazılamazsa günlüğe hata düşer ve cevap yine aynı rettir.
@Injectable()
export class RetKaydiYazici implements NestInterceptor {
  private readonly gunluk = new Logger(RetKaydiYazici.name);

  constructor(@Inject(IZ_PRISMA_CLIENT) private readonly iz: IzPrismaClient) {}

  intercept(
    _baglam: ExecutionContext,
    sonraki: CallHandler,
  ): Observable<unknown> {
    return sonraki.handle().pipe(
      catchError(async (hata: unknown) => {
        const { istekKimligi, oturum } = istekBaglami();
        if (hata instanceof YasakReddi && oturum !== undefined) {
          try {
            await this.iz.retKaydi.create({
              data: {
                id: yeniKimlik(),
                istekId: istekKimligi,
                kullaniciId: oturum.kullaniciId,
                eylem: hata.eylem,
                kaynak: hata.kaynak,
                kayitId: hata.kayitId,
                kararVerenYasakId: hata.kararVerenYasakId,
                olusmaZamani: new Date(),
              },
            });
          } catch (yazimHatasi) {
            this.gunluk.error(
              `istek ${istekKimligi}: ret kaydı yazılamadı: ${String(yazimHatasi instanceof Error ? yazimHatasi.stack : yazimHatasi)}`,
            );
          }
        }
        throw hata;
      }),
    );
  }
}

// Okunan ret kaydı: zaman, retin oluştuğu andır.
export interface RetKaydi {
  readonly zaman: Date;
  readonly eylem: string;
  readonly kaynak: string;
  readonly kayitId: string | null;
  readonly kararVerenYasakId: string;
}

// Ret kaydının okuması (TS-008 "Yönetim, izinler ve teşhis"): bir kişinin en yeni ret kayıtları, yeniden
// eskiye, en çok adet kadar. Yazıcıyla aynı istemciyi kullanır.
@Injectable()
export class RetKaydiOkuyucu {
  constructor(@Inject(IZ_PRISMA_CLIENT) private readonly iz: IzPrismaClient) {}

  async sonRetler(kullaniciId: string, adet: number): Promise<RetKaydi[]> {
    return (
      await this.iz.retKaydi.findMany({
        where: { kullaniciId },
        orderBy: [{ olusmaZamani: 'desc' }, { id: 'desc' }],
        take: adet,
        select: {
          olusmaZamani: true,
          eylem: true,
          kaynak: true,
          kayitId: true,
          kararVerenYasakId: true,
        },
      })
    ).map(({ olusmaZamani, ...ret }) => ({ zaman: olusmaZamani, ...ret }));
  }
}
