import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { Registrar } from '../database/infrastructure/registrar.js';
import { UnitOfWork } from '../database/infrastructure/unit-of-work.js';
import { TohumDefteri } from './application/tohum-defteri.js';
import { tohumGocuRepoKaydet } from './infrastructure/tohum-gocu.prisma-repository.js';
import { TohumKosucusu } from './infrastructure/tohum-kosucusu.js';

// Tohum göçü defteri ve koşucusu. Feature göçlerini dışa verilen defterle bildirir; defterin
// repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır.
@Module({
  imports: [DatabaseModule],
  providers: [
    TohumDefteri,
    {
      provide: TohumKosucusu,
      useFactory: (uow: UnitOfWork, defter: TohumDefteri): TohumKosucusu =>
        new TohumKosucusu(uow, defter),
      inject: [UnitOfWork, TohumDefteri],
    },
  ],
  exports: [TohumDefteri, TohumKosucusu],
})
export class TohumModule {
  constructor(registrar: Registrar) {
    tohumGocuRepoKaydet(registrar);
  }
}
