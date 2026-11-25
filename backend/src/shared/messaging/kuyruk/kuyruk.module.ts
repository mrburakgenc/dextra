import { Module } from '@nestjs/common';
import { KOMUT_BAGLAMI } from '../komut-baglami.js';
import { BullmqIsKuyrugu } from './bullmq-is-kuyrugu.js';
import { IS_KUYRUGU } from './is-kuyrugu.js';

@Module({
  providers: [
    {
      provide: IS_KUYRUGU,
      // Kuyruk asıl veritabanında durur; bağlantı ilk kullanımda açılır. Bağdaştırıcı
      // uygulama kapanırken (onApplicationShutdown) açtığı kuyruk ve dinleyicileri kapatır.
      // Komut bağlamında dinleyici açılmaz (komut-baglami.ts).
      useFactory: (komutBaglami: true | undefined): BullmqIsKuyrugu => {
        const connectionString = process.env['DATABASE_URL'];
        if (connectionString === undefined) {
          throw new Error('DATABASE_URL ortam değişkeni tanımlı değil');
        }
        return new BullmqIsKuyrugu(connectionString, komutBaglami === true);
      },
      inject: [{ token: KOMUT_BAGLAMI, optional: true }],
    },
  ],
  exports: [IS_KUYRUGU],
})
export class KuyrukModule {}
