-- CreateTable
CREATE TABLE "kullanici" (
    "id" UUID NOT NULL,
    "kullanici_adi" TEXT,
    "telefon" TEXT,
    "gorunen_ad" TEXT NOT NULL,
    "sistem_aktoru" BOOLEAN NOT NULL DEFAULT false,
    "yetki_surumu" INTEGER NOT NULL DEFAULT 0,
    "pasif_zamani" TIMESTAMPTZ,
    "unutulma_zamani" TIMESTAMPTZ,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "kullanici_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanici_sirri" (
    "kullanici_id" UUID NOT NULL,
    "parola_ozeti" TEXT NOT NULL,
    "guncelleme_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "kullanici_sirri_ba" PRIMARY KEY ("kullanici_id")
);

-- CreateTable
CREATE TABLE "oturum" (
    "id" UUID NOT NULL,
    "kullanici_id" UUID NOT NULL,
    "giris_yontemi" TEXT NOT NULL,
    "baslangic_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "mutlak_bitis_zamani" TIMESTAMPTZ NOT NULL,
    "son_dondurme_zamani" TIMESTAMPTZ NOT NULL,
    "ip_adresi" TEXT NOT NULL,
    "tarayici_bilgisi" TEXT NOT NULL,
    "kapatilma_zamani" TIMESTAMPTZ,
    "kapatilma_nedeni" TEXT,

    CONSTRAINT "oturum_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oturum_sirri" (
    "oturum_id" UUID NOT NULL,
    "nesil" INTEGER NOT NULL,
    "gecerli_yenileme_ozeti" TEXT NOT NULL,
    "onceki_yenileme_ozeti" TEXT,
    "cihaz_sirri_ozeti" TEXT NOT NULL,

    CONSTRAINT "oturum_sirri_ba" PRIMARY KEY ("oturum_id")
);

-- CreateTable
CREATE TABLE "parola_baglantisi" (
    "id" UUID NOT NULL,
    "kullanici_id" UUID NOT NULL,
    "kod_ozeti" TEXT NOT NULL,
    "son_gecerlilik_zamani" TIMESTAMPTZ NOT NULL,
    "kullanilma_zamani" TIMESTAMPTZ,
    "olusturan_id" UUID,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "parola_baglantisi_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grup" (
    "id" UUID NOT NULL,
    "ust_grup_id" UUID,
    "ad" TEXT NOT NULL,
    "silinme_zamani" TIMESTAMPTZ,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "grup_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "kod" TEXT,
    "ad" TEXT NOT NULL,
    "silinme_zamani" TIMESTAMPTZ,

    CONSTRAINT "rol_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin" (
    "id" UUID NOT NULL,
    "kaynak" TEXT NOT NULL,
    "eylem" TEXT NOT NULL,

    CONSTRAINT "izin_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uyelik" (
    "id" UUID NOT NULL,
    "kullanici_id" UUID NOT NULL,
    "grup_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "silinme_zamani" TIMESTAMPTZ,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "uyelik_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yetenek" (
    "id" UUID NOT NULL,
    "grup_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "izin_id" UUID NOT NULL,
    "sart" JSONB,
    "butun_kayitlar" BOOLEAN NOT NULL DEFAULT false,
    "butun_birimler" BOOLEAN NOT NULL DEFAULT false,
    "kolonlar" TEXT[],
    "butun_kolonlar" BOOLEAN NOT NULL DEFAULT false,
    "sistem_satiri" BOOLEAN NOT NULL DEFAULT false,
    "silinme_zamani" TIMESTAMPTZ,
    "tohum_anahtari" TEXT,
    "yerine_gectigi_id" UUID,
    "koken" TEXT NOT NULL,
    "olusturma_zamani" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "yetenek_ba" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yetki_surumu" (
    "id" INTEGER NOT NULL,
    "sayac" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "yetki_surumu_ba" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_kullanici_adi_tekil" ON "kullanici"("kullanici_adi");

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_telefon_tekil" ON "kullanici"("telefon");

-- CreateIndex
CREATE INDEX "oturum_kullanici_id_dizin" ON "oturum"("kullanici_id") WHERE (kapatilma_zamani IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "parola_baglantisi_kod_ozeti_tekil" ON "parola_baglantisi"("kod_ozeti");

-- CreateIndex
CREATE UNIQUE INDEX "parola_baglantisi_kullanici_id_tekil" ON "parola_baglantisi"("kullanici_id") WHERE (kullanilma_zamani IS NULL);

-- CreateIndex
CREATE INDEX "grup_ust_grup_id_dizin" ON "grup"("ust_grup_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_kod_tekil" ON "rol"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "izin_kaynak_eylem_tekil" ON "izin"("kaynak", "eylem");

-- CreateIndex
CREATE INDEX "uyelik_kullanici_id_dizin" ON "uyelik"("kullanici_id") WHERE (silinme_zamani IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uyelik_kullanici_id_grup_id_rol_id_tekil" ON "uyelik"("kullanici_id", "grup_id", "rol_id") WHERE (silinme_zamani IS NULL);

-- CreateIndex
CREATE INDEX "yetenek_grup_id_rol_id_dizin" ON "yetenek"("grup_id", "rol_id") WHERE (silinme_zamani IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "yetenek_tohum_anahtari_tekil" ON "yetenek"("tohum_anahtari") WHERE (silinme_zamani IS NULL);

-- AddForeignKey
ALTER TABLE "kullanici_sirri" ADD CONSTRAINT "kullanici_sirri_kullanici_id_ya" FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oturum" ADD CONSTRAINT "oturum_kullanici_id_ya" FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oturum_sirri" ADD CONSTRAINT "oturum_sirri_oturum_id_ya" FOREIGN KEY ("oturum_id") REFERENCES "oturum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parola_baglantisi" ADD CONSTRAINT "parola_baglantisi_kullanici_id_ya" FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parola_baglantisi" ADD CONSTRAINT "parola_baglantisi_olusturan_id_ya" FOREIGN KEY ("olusturan_id") REFERENCES "kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grup" ADD CONSTRAINT "grup_ust_grup_id_ya" FOREIGN KEY ("ust_grup_id") REFERENCES "grup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uyelik" ADD CONSTRAINT "uyelik_kullanici_id_ya" FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uyelik" ADD CONSTRAINT "uyelik_grup_id_ya" FOREIGN KEY ("grup_id") REFERENCES "grup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uyelik" ADD CONSTRAINT "uyelik_rol_id_ya" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_grup_id_ya" FOREIGN KEY ("grup_id") REFERENCES "grup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_rol_id_ya" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_izin_id_ya" FOREIGN KEY ("izin_id") REFERENCES "izin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_yerine_gectigi_id_ya" FOREIGN KEY ("yerine_gectigi_id") REFERENCES "yetenek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ELLE YAZILDI (başlangıç): bu satırdan sonrası Prisma'nın ürettiği SQL değildir; şema dilinde
-- ifade edilemeyen nesnelerdir.

-- ELLE YAZILDI: üstü olmayan ve silinmemiş en çok bir grup (kök) olabilir. Sabit ifade üzerinde kısmi
-- tekil dizin: koşulu sağlayan bütün satırlarda dizin değeri aynıdır (true), ikinci satır reddedilir.
CREATE UNIQUE INDEX "grup_kok_tekil" ON "grup" ((true)) WHERE (ust_grup_id IS NULL AND silinme_zamani IS NULL);

-- ELLE YAZILDI: butun_kayitlar doğruyken sart dolu olamaz.
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_kayit_siniri_denetim" CHECK (NOT (butun_kayitlar AND sart IS NOT NULL));

-- ELLE YAZILDI: butun_kolonlar doğruyken kolonlar dolu olamaz.
ALTER TABLE "yetenek" ADD CONSTRAINT "yetenek_kolon_siniri_denetim" CHECK (NOT (butun_kolonlar AND kolonlar IS NOT NULL));

-- ELLE YAZILDI: tabloda en çok bir satır bulunur; id yalnız 1 olabilir (birincil anahtarla birlikte).
ALTER TABLE "yetki_surumu" ADD CONSTRAINT "yetki_surumu_tek_satir_denetim" CHECK (id = 1);

-- ELLE YAZILDI (bitiş)
