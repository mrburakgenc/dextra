import { defineConfig } from 'prisma/config';

// GV-003 denemesinin ayarı: yalnız istemci üretir; generate adres istemez, tablolar testte açılır.
export default defineConfig({
  // Yol bu dosyanın bulunduğu klasöre göredir.
  schema: 'schema.prisma',
});
