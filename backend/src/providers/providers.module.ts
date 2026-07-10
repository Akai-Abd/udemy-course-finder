import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ProvidersRepository } from './providers.repository';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, ProvidersRepository],
  exports: [ProvidersService],
})
export class ProvidersModule {}
