-- citext for case-insensitive slug (handle-derived public URL, §A.2/§H.2)
CREATE EXTENSION IF NOT EXISTS "citext";

-- new columns added NULLABLE so existing 正身 rows can be backfilled before NOT NULL
ALTER TABLE "User" ADD COLUMN "slug" CITEXT;
ALTER TABLE "User" ADD COLUMN "shortRef" TEXT;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- backfill: every 正身 needs a shortRef + updatedAt before the NOT NULL constraint
UPDATE "User" SET "shortRef" = substr(md5(random()::text || "id"), 1, 10) WHERE "shortRef" IS NULL;
UPDATE "User" SET "updatedAt" = COALESCE("createdAt", now()) WHERE "updatedAt" IS NULL;

-- enforce NOT NULL now that every row has a value
ALTER TABLE "User" ALTER COLUMN "shortRef" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- unique indexes (slug is CI via citext; shortRef is the /r/ lookup key)
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");
CREATE UNIQUE INDEX "User_shortRef_key" ON "User"("shortRef");
