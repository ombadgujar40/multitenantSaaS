-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "Domain" TEXT;

-- CreateTable
CREATE TABLE "ChoosedPlan" (
    "id" SERIAL NOT NULL,
    "orgId" INTEGER NOT NULL,
    "Domain" TEXT NOT NULL,
    "Plan" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoosedPlan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ChoosedPlan" ADD CONSTRAINT "ChoosedPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
