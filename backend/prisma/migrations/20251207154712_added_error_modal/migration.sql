-- CreateTable
CREATE TABLE "error_logs" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tenantId" INTEGER,
    "userId" INTEGER,
    "payload" JSONB,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_eventType_idx" ON "error_logs"("eventType");

-- CreateIndex
CREATE INDEX "error_logs_severity_idx" ON "error_logs"("severity");

-- CreateIndex
CREATE INDEX "error_logs_tenantId_idx" ON "error_logs"("tenantId");

-- CreateIndex
CREATE INDEX "error_logs_userId_idx" ON "error_logs"("userId");
