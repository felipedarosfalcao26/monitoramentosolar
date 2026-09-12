-- AlterTable
ALTER TABLE "Occurrence" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
