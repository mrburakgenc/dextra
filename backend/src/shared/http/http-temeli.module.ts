import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { DogrulamaBorusu } from './infrastructure/dogrulama-borusu.js';
import { HataSuzgeci } from '../filters/hata-suzgeci.js';
import { istekBaglamiAraKatmani } from '../observability/istek-baglami/istek-baglami.js';

// HTTP temelini bütün uçlara bağlar (TS-002 AK-11): doğrulama borusu, hata süzgeci ve istek
// bağlamı. Ara katman koruyuculardan önce koştuğu için bağlam onlara da ulaşır.
@Module({
  providers: [
    { provide: APP_PIPE, useClass: DogrulamaBorusu },
    { provide: APP_FILTER, useClass: HataSuzgeci },
  ],
})
export class HttpTemeliModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // '{*splat}' kök yol dahil bütün yolları eşler (Express 5 yol sözdizimi).
    consumer.apply(istekBaglamiAraKatmani).forRoutes('{*splat}');
  }
}
