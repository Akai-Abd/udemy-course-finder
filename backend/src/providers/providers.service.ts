import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { ProvidersRepository } from './providers.repository';
import { UpdateProviderDto } from './dto';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly providersRepository: ProvidersRepository,
    private readonly jobsService: JobsService,
  ) {}

  async findAll(): Promise<Provider[]> {
    return this.providersRepository.findAll();
  }

  async findById(id: string): Promise<Provider> {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }
    return provider;
  }

  async update(id: string, dto: UpdateProviderDto): Promise<Provider> {
    await this.findById(id); // throws if not found
    this.logger.log(`Updating provider ${id}: ${JSON.stringify(dto)}`);
    return this.providersRepository.update(id, dto);
  }

  async getLogs(providerId: string, page = 1, limit = 20) {
    await this.findById(providerId);
    return this.providersRepository.findLogs(providerId, page, limit);
  }

  async getStats(providerId: string) {
    await this.findById(providerId);
    return this.providersRepository.getStats(providerId);
  }

  async triggerScrape(
    providerId?: string,
  ): Promise<{ message: string; jobId: string }> {
    if (providerId) {
      await this.findById(providerId); // throws if not found
    }

    const jobId = await this.jobsService.enqueueScrapeJob(providerId);
    const target = providerId ? `provider ${providerId}` : 'all providers';

    this.logger.log(`Scrape triggered for ${target}, job: ${jobId}`);

    return {
      message: `Scrape job enqueued for ${target}`,
      jobId,
    };
  }

  async testProvider(
    providerId: string,
  ): Promise<{ message: string; jobId: string }> {
    await this.findById(providerId);

    const jobId = await this.jobsService.enqueueTestJob(providerId);

    this.logger.log(`Test enqueued for provider ${providerId}, job: ${jobId}`);

    return {
      message: `Test job enqueued for provider ${providerId}`,
      jobId,
    };
  }

  async retryProvider(providerId: string): Promise<{ message: string }> {
    await this.findById(providerId);

    // Find the most recent failed log for this provider to get the job ID
    const logs = await this.providersRepository.findLogs(providerId, 1, 1);
    const lastLog = logs.data[0];

    if (!lastLog || !lastLog.jobId) {
      return {
        message: 'No recent job found to retry. Triggering new scrape instead.',
      };
    }

    if (lastLog.status !== 'FAILED') {
      return {
        message: `Last job status is '${lastLog.status}', not FAILED. No retry needed.`,
      };
    }

    // Retry the failed job via BullMQ, or enqueue a new one
    const result = await this.jobsService.retryJob(lastLog.jobId);

    if (!result.success) {
      // Fallback: enqueue a new scrape job
      const jobId = await this.jobsService.enqueueScrapeJob(providerId);
      return {
        message: `Could not retry original job: ${result.message}. New scrape enqueued (${jobId}).`,
      };
    }

    return { message: result.message };
  }

  async countEnabled(): Promise<number> {
    return this.providersRepository.countEnabled();
  }
}
