-- CreateTable
CREATE TABLE "ret_kaydi" (
    "id" UUID NOT NULL,
    "istek_id" UUID NOT NULL,
    "kullanici_id" UUID NOT NULL,
    "eylem" TEXT NOT NULL,
    "kaynak" TEXT NOT NULL,
    "kayit_id" UUID,
    "karar_veren_yasak_id" UUID NOT NULL,
    "olusma_zamani" TIMESTAMPTZ NOT NULL,
    "yazilma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "ret_kaydi_ba" PRIMARY KEY ("id")
);
