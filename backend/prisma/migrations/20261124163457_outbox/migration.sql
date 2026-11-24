-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "outbox_iz" (
    "id" UUID NOT NULL,
    "surum" INTEGER NOT NULL,
    "govde" JSONB NOT NULL,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "aktarim_zamani" TIMESTAMPTZ,
    "deneme_sayisi" INTEGER NOT NULL DEFAULT 0,
    "sonraki_deneme_zamani" TIMESTAMPTZ,
    "son_hata" TEXT,

    CONSTRAINT "outbox_iz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_olay" (
    "id" UUID NOT NULL,
    "ad" TEXT NOT NULL,
    "surum" INTEGER NOT NULL,
    "govde" JSONB NOT NULL,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "aktarim_zamani" TIMESTAMPTZ,

    CONSTRAINT "outbox_olay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_iz_olusturma_zamani_idx" ON "outbox_iz"("olusturma_zamani") WHERE (aktarim_zamani IS NULL);

