import { defineConfig } from 'prisma/config';

// İz veritabanının (dextra_iz) ayarı; asıl veritabanınınki prisma.config.ts içindedir.
// generate adres istemez, bu yüzden adres yalnız tanımlıysa verilir.
const url = process.env['IZ_DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/iz/schema.prisma',
  ...(url === undefined ? {} : { datasource: { url } }),
});
