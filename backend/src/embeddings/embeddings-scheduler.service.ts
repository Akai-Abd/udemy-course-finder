import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

@Injectable()
export class EmbeddingsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingsScheduler.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting missing embeddings processor loop...');
    // Run initial scan after 10 seconds to allow application startup
    setTimeout(() => this.processMissingEmbeddings(), 10000);
    
    // Check every 2 minutes for new/un-embedded courses
    this.intervalId = setInterval(() => this.processMissingEmbeddings(), 120000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async processMissingEmbeddings() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find courses that don't have an embedding in the course_embeddings table
      const courses = await this.prisma.course.findMany({
        where: {
          embedding: {
            is: null,
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
        },
        take: 50, // Process in batches of 50
      });

      if (courses.length === 0) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(`Found ${courses.length} courses missing embeddings. Processing...`);

      for (const course of courses) {
        try {
          const text = `${course.title} ${course.description || ''}`;
          const vector = await this.embeddingsService.generate(text);

          const vectorSql = `[${vector.join(',')}]`;
          
          // Use raw query since Prisma Unsupported type doesn't support direct object mapping
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO course_embeddings (course_id, embedding)
             VALUES ($1, $2::vector)
             ON CONFLICT (course_id) 
             DO UPDATE SET embedding = $2::vector`,
            course.id,
            vectorSql,
          );
        } catch (err) {
          this.logger.error(`Failed to process embedding for course ${course.id}:`, err);
        }
      }

      this.logger.log(`Successfully processed embeddings for ${courses.length} courses`);
    } catch (error) {
      this.logger.error('Error during missing embeddings scan:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
