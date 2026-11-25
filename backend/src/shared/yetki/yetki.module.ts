import { type DynamicModule, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import {
  KAYNAK_KATALOGU,
  type YazmaKatalogu,
} from './domain/kaynak-katalogu.js';
import { OkumaKapisi } from './infrastructure/okuma-kapisi.js';
import { YazmaKapisi } from './infrastructure/yazma-kapisi.js';

// Yetki kapılarının tek modülü (TS-002 AK-42): okuma ve yazma kapısını ve kaynak kataloğunu sağlar
// ve dışa verir. Katalog kök modülde bir kez kurulur ve forRoot ile buraya verilir; modül yalnız kök
// modülde içe aktarılır ve geneldir, çünkü kök modülün sağlayıcıları alt modüllere görünmez. Alt
// modüller kapıları buradan alır, kendileri kurmaz: uygulamada tek katalog ve her kapıdan tek örnek
// olur (yazma kapısı istemci belirtecini bir kez kaydedebilir).
@Module({})
export class YetkiModule {
  static forRoot(katalog: YazmaKatalogu): DynamicModule {
    return {
      module: YetkiModule,
      global: true,
      imports: [DatabaseModule, MessagingModule],
      providers: [
        { provide: KAYNAK_KATALOGU, useValue: katalog },
        OkumaKapisi,
        YazmaKapisi,
      ],
      exports: [KAYNAK_KATALOGU, OkumaKapisi, YazmaKapisi],
    };
  }
}
