import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { Registrar } from '../database/infrastructure/registrar.js';
import {
  OUTBOX_REPO,
  outboxRepo,
} from './infrastructure/outbox/outbox-repo.js';
import { OutboxYazici } from './infrastructure/outbox/outbox-yazici.js';

// Dışa yalnız yazma yüzeyi verilir; outbox repository'si ortak kodun kaydıyla Unit of Work'e
// tanıtılır (KR-011 Yazım biçimi).
@Module({
  imports: [DatabaseModule],
  providers: [OutboxYazici],
  exports: [OutboxYazici],
})
export class MessagingModule {
  constructor(registrar: Registrar) {
    registrar.register(OUTBOX_REPO, outboxRepo);
  }
}
