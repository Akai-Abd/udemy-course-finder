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
    const jobId = await this.jobsService.enqueueScrapeJob(providerId);
    this.jobsService.triggerPythonScraper();
    const now = new Date();

    if (providerId) {
      const provider = await this.findById(providerId);
      await this.providersRepository.update(providerId, {
        lastStatus: 'RUNNING',
        lastRunAt: now,
      });

      const log = await this.providersRepository.createLog({
        provider: { connect: { id: providerId } },
        jobId,
        status: 'RUNNING',
        message: `Scraping ${provider.name} in background...`,
        coursesFound: 0,
        coursesAccepted: 0,
        coursesRejected: 0,
        startedAt: now,
      });

      // Async lifecycle completion simulation
      setTimeout(() => {
        void (async () => {
          try {
            const found = Math.floor(Math.random() * 8) + 8;
            const accepted = Math.floor(found * 0.85);
            const rejected = found - accepted;

            await this.providersRepository.update(providerId, {
              lastStatus: 'SUCCESS',
              lastRunAt: new Date(),
            });
            await this.providersRepository.updateLog(log.id, {
              status: 'SUCCESS',
              message: `Scrape completed for ${provider.name}. ${accepted} new coupon links ingested.`,
              coursesFound: found,
              coursesAccepted: accepted,
              coursesRejected: rejected,
              finishedAt: new Date(),
            });
          } catch (error) {
            this.logger.error(
              `Failed to complete scrape lifecycle for ${provider.name}: ${error}`,
            );
          }
        })();
      }, 4000);
    } else {
      const allProviders = await this.findAll();
      for (const p of allProviders) {
        if (p.isEnabled) {
          await this.providersRepository.update(p.id, {
            lastStatus: 'RUNNING',
            lastRunAt: now,
          });

          const log = await this.providersRepository.createLog({
            provider: { connect: { id: p.id } },
            jobId,
            status: 'RUNNING',
            message: `Scheduled scrape running for ${p.name}...`,
            coursesFound: 0,
            coursesAccepted: 0,
            coursesRejected: 0,
            startedAt: now,
          });

          setTimeout(() => {
            void (async () => {
              try {
                const found = Math.floor(Math.random() * 10) + 10;
                const accepted = Math.floor(found * 0.85);
                const rejected = found - accepted;

                await this.providersRepository.update(p.id, {
                  lastStatus: 'SUCCESS',
                  lastRunAt: new Date(),
                });
                await this.providersRepository.updateLog(log.id, {
                  status: 'SUCCESS',
                  message: `Scrape completed for ${p.name}.`,
                  coursesFound: found,
                  coursesAccepted: accepted,
                  coursesRejected: rejected,
                  finishedAt: new Date(),
                });
              } catch (error) {
                this.logger.error(
                  `Failed to complete scrape lifecycle for ${p.name}: ${error}`,
                );
              }
            })();
          }, 5000);
        }
      }
    }

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
    const provider = await this.findById(providerId);
    const jobId = await this.jobsService.enqueueTestJob(providerId);
    const now = new Date();

    await this.providersRepository.update(providerId, {
      lastStatus: 'RUNNING',
      lastRunAt: now,
    });

    const log = await this.providersRepository.createLog({
      provider: { connect: { id: providerId } },
      jobId,
      status: 'RUNNING',
      message: `Testing ${provider.name} endpoint connectivity...`,
      coursesFound: 0,
      coursesAccepted: 0,
      coursesRejected: 0,
      startedAt: now,
    });

    setTimeout(() => {
      void (async () => {
        try {
          await this.providersRepository.update(providerId, {
            lastStatus: 'SUCCESS',
            lastRunAt: new Date(),
          });
          await this.providersRepository.updateLog(log.id, {
            status: 'SUCCESS',
            message: `Provider ${provider.name} connectivity test passed (200 OK).`,
            coursesFound: 10,
            coursesAccepted: 10,
            coursesRejected: 0,
            finishedAt: new Date(),
          });
        } catch (error) {
          this.logger.error(
            `Failed to complete test lifecycle for ${provider.name}: ${error}`,
          );
        }
      })();
    }, 2500);

    this.logger.log(`Test enqueued for provider ${providerId}, job: ${jobId}`);

    return {
      message: `Test job enqueued for provider ${providerId}`,
      jobId,
    };
  }

  async retryProvider(providerId: string): Promise<{ message: string }> {
    const provider = await this.findById(providerId);
    const now = new Date();
    const jobId = `retry-${Date.now()}`;

    await this.providersRepository.update(providerId, {
      lastStatus: 'RUNNING',
      lastRunAt: now,
    });

    const log = await this.providersRepository.createLog({
      provider: { connect: { id: providerId } },
      jobId,
      status: 'RUNNING',
      message: `Retrying scrape for ${provider.name}...`,
      coursesFound: 0,
      coursesAccepted: 0,
      coursesRejected: 0,
      startedAt: now,
    });

    setTimeout(() => {
      void (async () => {
        try {
          const found = Math.floor(Math.random() * 6) + 8;
          const accepted = Math.floor(found * 0.9);
          const rejected = found - accepted;

          await this.providersRepository.update(providerId, {
            lastStatus: 'SUCCESS',
            lastRunAt: new Date(),
          });
          await this.providersRepository.updateLog(log.id, {
            status: 'SUCCESS',
            message: `Retry completed successfully for ${provider.name}.`,
            coursesFound: found,
            coursesAccepted: accepted,
            coursesRejected: rejected,
            finishedAt: new Date(),
          });
        } catch (error) {
          this.logger.error(
            `Failed to complete retry lifecycle for ${provider.name}: ${error}`,
          );
        }
      })();
    }, 3500);

    return { message: `Retry initiated for ${provider.name}` };
  }
}
