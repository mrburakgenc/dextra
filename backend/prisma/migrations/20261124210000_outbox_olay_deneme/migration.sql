-- AlterTable
ALTER TABLE "outbox_olay" ADD COLUMN     "deneme_sayisi" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sonraki_deneme_zamani" TIMESTAMPTZ,
ADD COLUMN     "son_hata" TEXT;

-- CreateIndex
CREATE INDEX "outbox_olay_olusturma_zamani_dizin" ON "outbox_olay"("olusturma_zamani") WHERE (aktarim_zamani IS NULL);
