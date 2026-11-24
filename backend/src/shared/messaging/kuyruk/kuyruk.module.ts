import { Module } from '@nestjs/common';
import { BullmqIsKuyrugu } from './bullmq-is-kuyrugu.js';
import { IS_KUYRUGU } from './is-kuyrugu.js';

@Module({
  providers: [
    {
      provide: IS_KUYRUGU,
      // Kuyruk asıl veritabanında durur; bağlantı ilk kullanımda açılır. Bağdaştırıcı
      // uygulama kapanırken (onApplicationShutdown) açtığı kuyruk ve dinleyicileri kapatır.
      useFactory: (): BullmqIsKuyrugu => {
        const connectionString = process.env['DATABASE_URL'];
        if (connectionString === undefined) {
          throw new Error('DATABASE_URL ortam değişkeni tanımlı değil');
        }
        return new BullmqIsKuyrugu(connectionString);
      },
    },
  ],
  exports: [IS_KUYRUGU],
})
export class KuyrukModule {}
