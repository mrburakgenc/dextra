-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "degisiklik_kaydi" (
    "id" UUID NOT NULL,
    "istek_id" UUID,
    "kullanici_id" UUID NOT NULL,
    "uyelik_id" UUID,
    "yetenek_id" UUID,
    "is_adi" TEXT NOT NULL,
    "baslatan_kullanici_id" UUID,
    "veri_sahibi_kullanici_id" UUID,
    "kaynak" TEXT NOT NULL,
    "kayit_id" UUID NOT NULL,
    "eylem" TEXT NOT NULL,
    "degisen" JSONB NOT NULL,
    "olusma_zamani" TIMESTAMPTZ NOT NULL,
    "yazilma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "degisiklik_kaydi_ba" PRIMARY KEY ("id")
);

