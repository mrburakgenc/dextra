-- AlterTable
-- Var olan satırlar varsayılanları alır: giremez hayır, öncelik 0 (TS-008 "Veri modeli").
ALTER TABLE "yetenek" ADD COLUMN     "giremez" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oncelik" INTEGER NOT NULL DEFAULT 0;

-- ELLE YAZILDI (başlangıç): bu satırdan sonrası Prisma'nın ürettiği SQL değildir; şema dilinde
-- ifade edilemeyen nesnelerdir.

-- ELLE YAZILDI: öncelik 0 ile 100 arasındadır (kalıcı).
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_oncelik_araligi_denetim" CHECK (oncelik >= 0 AND oncelik <= 100);

-- ELLE YAZILDI: GEÇİCİ. Yasak ve sıfırdan farklı öncelik yazımı açılana kadar giremez hayır ve öncelik 0
-- olmalıdır (TS-008 kapanan AU-30); yazımı açan aşamanın göçü yalnız bu kısıtı kaldırır.
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_yasak_yazimi_kapali_denetim" CHECK (NOT giremez AND oncelik = 0);

-- ELLE YAZILDI (bitiş)
