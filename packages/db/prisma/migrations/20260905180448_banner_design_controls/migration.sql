-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "categorySlug" TEXT,
ADD COLUMN     "ctaText" TEXT,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "textPosition" TEXT NOT NULL DEFAULT 'left',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';
