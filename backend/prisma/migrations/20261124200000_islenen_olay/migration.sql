-- CreateTable
CREATE TABLE "islenen_olay" (
    "tuketici" TEXT NOT NULL,
    "olay_id" UUID NOT NULL,
    "durum" TEXT NOT NULL,
    "sahiplenme_bitis_zamani" TIMESTAMPTZ NOT NULL,
    "tamamlanma_zamani" TIMESTAMPTZ,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "islenen_olay_ba" PRIMARY KEY ("tuketici","olay_id")
);
