import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsScheduler } from './embeddings-scheduler.service';

@Module({
  imports: [PrismaModule],
  providers: [EmbeddingsService, EmbeddingsScheduler],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
