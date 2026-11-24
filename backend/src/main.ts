import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // SIGTERM ya da SIGINT gelince kapanış kancaları koşar: aktarıcı döngüleri, kuyruk dinleyicileri
  // ve veritabanı havuzları düzenli kapanır (TS-003 Onarım). useProcessExit: kapanış bitince süreç
  // 0 ile çıkar; seçenek verilmezse Nest sinyali sürece yeniden gönderir ve süreç sinyalle ölür.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true });
  await app.listen(process.env['PORT'] ?? 3000);
}
await bootstrap();
