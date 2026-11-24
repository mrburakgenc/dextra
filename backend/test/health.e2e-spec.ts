import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

describe('GET /health', () => {
  let app: INestApplication<App>;
  let databases: AppDatabases;

  beforeAll(async () => {
    // Uygulama göçleri uygulanmış geçici veritabanlarıyla açılır.
    databases = await createAppDatabases({ migrations: true });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await databases.drop();
  });

  it('200 ve durum "ok" döner', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
