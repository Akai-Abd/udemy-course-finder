-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "course_embeddings" (
    "course_id" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,

    CONSTRAINT "course_embeddings_pkey" PRIMARY KEY ("course_id")
);

-- AddForeignKey
ALTER TABLE "course_embeddings" ADD CONSTRAINT "course_embeddings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
