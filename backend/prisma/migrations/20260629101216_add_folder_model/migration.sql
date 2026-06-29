-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folders_projectId_idx" ON "folders"("projectId");

-- CreateIndex
CREATE INDEX "folders_parentId_idx" ON "folders"("parentId");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
