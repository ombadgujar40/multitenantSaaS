/*
  Warnings:

  - You are about to drop the `Deliverable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Deliverable" DROP CONSTRAINT "Deliverable_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Deliverable" DROP CONSTRAINT "Deliverable_projectId_fkey";

-- DropTable
DROP TABLE "public"."Deliverable";

-- DropEnum
DROP TYPE "public"."DeliverableStatus";
