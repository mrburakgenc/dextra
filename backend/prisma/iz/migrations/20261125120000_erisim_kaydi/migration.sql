-- CreateTable
CREATE TABLE "erisim_kaydi" (
    "id" UUID NOT NULL,
    "istek_id" UUID,
    "kullanici_id" UUID NOT NULL,
    "is_adi" TEXT NOT NULL,
    "erisilen_yer" TEXT NOT NULL,
    "kayit_sayisi" INTEGER NOT NULL,
    "olusma_zamani" TIMESTAMPTZ NOT NULL,
    "yazilma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "erisim_kaydi_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erisim_kaydi_yetenek" (
    "erisim_kaydi_id" UUID NOT NULL,
    "yetenek_id" UUID NOT NULL,

    CONSTRAINT "erisim_kaydi_yetenek_ba" PRIMARY KEY ("erisim_kaydi_id","yetenek_id")
);

-- CreateTable
CREATE TABLE "erisim_kaydi_uyelik" (
    "erisim_kaydi_id" UUID NOT NULL,
    "uyelik_id" UUID NOT NULL,

    CONSTRAINT "erisim_kaydi_uyelik_ba" PRIMARY KEY ("erisim_kaydi_id","uyelik_id")
);

-- AddForeignKey
ALTER TABLE "erisim_kaydi_yetenek" ADD CONSTRAINT "erisim_kaydi_yetenek_erisim_kaydi_id_ya" FOREIGN KEY ("erisim_kaydi_id") REFERENCES "erisim_kaydi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erisim_kaydi_uyelik" ADD CONSTRAINT "erisim_kaydi_uyelik_erisim_kaydi_id_ya" FOREIGN KEY ("erisim_kaydi_id") REFERENCES "erisim_kaydi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
