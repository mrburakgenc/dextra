import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Izin } from '../../../../shared/guvenlik/isaretler.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { KullaniciListeleHandler } from '../application/kullanici-listele.handler.js';
import type { KullaniciListesi } from '../application/kullanici-listele.query.js';
import { KullaniciOkuHandler } from '../application/kullanici-oku.handler.js';
import {
  type KullaniciListeleParametreleri,
  kullaniciListeleSemasi,
} from './kullanici-listele.schema.js';

// Kullanıcı yönetiminin okuma uçları (TS-002 AK-39; izin Kullanici:oku). Sistem aktörleri ve
// unutulmuş kişiler de kayıttır; neyin görüneceğini yalnız isteyenin yeteneği belirler.
@Controller('kimlik/kullanici')
export class KullaniciController {
  constructor(
    private readonly listeleHandler: KullaniciListeleHandler,
    private readonly okuHandler: KullaniciOkuHandler,
  ) {}

  @Get()
  @Izin('Kullanici', 'oku')
  listele(
    @Query({ schema: kullaniciListeleSemasi })
    { sayfa, boyut, sirala, pasif }: KullaniciListeleParametreleri,
  ): Promise<KullaniciListesi> {
    return this.listeleHandler.calistir({
      sayfa,
      boyut,
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(pasif === undefined ? {} : { pasif }),
    });
  }

  @Get(':id')
  @Izin('Kullanici', 'oku')
  oku(@Param('id', { schema: z.uuid() }) id: string): Promise<Kayit> {
    return this.okuHandler.calistir(id);
  }
}
