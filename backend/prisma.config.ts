import { defineConfig } from 'prisma/config';

// env('DATABASE_URL') değişken yoksa ayar yüklenirken hata atar; generate adres istemez,
// bu yüzden adres yalnız tanımlıysa verilir.
const url = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(url === undefined ? {} : { datasource: { url } }),
});
