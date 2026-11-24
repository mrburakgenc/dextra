-- CreateTable
CREATE TABLE "tohum_gocu" (
    "ad" TEXT NOT NULL,
    "uygulanma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "tohum_gocu_ba" PRIMARY KEY ("ad")
);
