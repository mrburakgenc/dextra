-- AlterTable
-- Tablo hiçbir kalıcı veritabanında satır taşımaz; varsayılansız NOT NULL kolon doğrudan eklenir.
ALTER TABLE "islenen_olay" ADD COLUMN "sahip_id" UUID NOT NULL;
