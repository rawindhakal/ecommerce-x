-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "altText" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt");
