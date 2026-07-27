import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { exec } from 'child_process';
import * as path from 'path';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('scrape-queue') private readonly scrapeQueue: Queue,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.scrapeQueue?.on?.('error', () => {
      // Silent error handler to catch BullMQ queue error events when Redis is offline
    });
  }

  public triggerPythonScraper() {
    const scraperPath = path.resolve(__dirname, '../../../../scraper/run_all.py');
    const dbPath = path.resolve(__dirname, '../../../dev.db');
    this.logger.log(`🐍 Triggering Python Scraper: python3 ${scraperPath}`);

    exec(`DATABASE_URL="${dbPath}" python3 "${scraperPath}"`, (error, stdout) => {
      if (error) {
        this.logger.error(`Python Scraper execution error: ${error.message}`);
        return;
      }
      this.logger.log(`✅ Python Scraper execution completed cleanly.`);
      if (stdout) {
        this.logger.log(`Scraper log summary:\n${stdout.slice(-300)}`);
      }
    });
  }

  async onModuleInit() {
    const intervalMinutes = this.configService.get<number>(
      'SCRAPE_INTERVAL_MINUTES',
      30,
    );
    const intervalMs = intervalMinutes * 60 * 1000;
    const isRedisDisabled =
      this.configService.get<string>('ENABLE_REDIS') === 'false';

    if (isRedisDisabled) {
      this.logger.log(
        `⏰ Standalone mode: Scheduled live Python scraper every ${intervalMinutes} minutes`,
      );
      setInterval(() => {
        this.triggerPythonScraper();
      }, intervalMs);
      return;
    }

    try {
      // Remove any existing repeatable jobs to avoid duplicates
      const existingRepeatables = await this.scrapeQueue.getRepeatableJobs();
      for (const job of existingRepeatables) {
        await this.scrapeQueue.removeRepeatableByKey(job.key);
      }

      // Add new repeatable job
      await this.scrapeQueue.add(
        'scrape-all',
        {},
        {
          repeat: {
            every: intervalMs,
          },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );

      this.logger.log(
        `⏰ Scheduled scrape-all every ${intervalMinutes} minutes`,
      );

      // Add new repeatable validate job
      const validateIntervalMinutes = this.configService.get<number>(
        'VALIDATE_INTERVAL_MINUTES',
        60,
      );
      const validateIntervalMs = validateIntervalMinutes * 60 * 1000;

      await this.scrapeQueue.add(
        'validate-active-courses',
        {},
        {
          repeat: {
            every: validateIntervalMs,
          },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );

      this.logger.log(
        `⏰ Scheduled validate-active-courses every ${validateIntervalMinutes} minutes`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to schedule repeatable job: ${error}. ` +
        `The Python scraper has its own scheduler as fallback.`,
      );
    }
  }

  /**
   * Enqueue a scrape job for one or all providers.
   */
  async enqueueScrapeJob(providerId?: string): Promise<string> {
    const jobName = providerId ? 'scrape-single' : 'scrape-all';
    const data = providerId ? { providerId } : {};
    const isRedisDisabled =
      this.configService.get<string>('ENABLE_REDIS') === 'false';

    if (isRedisDisabled) {
      this.triggerPythonScraper();
      return 'standalone-job-id';
    }

    try {
      const job = await this.scrapeQueue.add(jobName, data, {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
        attempts: 1,
      });

      this.logger.log(
        `📤 Enqueued ${jobName} job ${job.id} ${providerId ? `for provider ${providerId}` : '(all providers)'}`,
      );

      return (job.id as string) ?? 'local-job-id';
    } catch (error) {
      this.logger.warn(`Failed to enqueue job (Redis offline): ${error}`);
      this.triggerPythonScraper();
      return 'standalone-job-id';
    }
  }

  /**
   * Enqueue a provider connectivity test job.
   */
  async enqueueTestJob(providerId: string): Promise<string> {
    try {
      const job = await this.scrapeQueue.add(
        'test-provider',
        { providerId },
        {
          removeOnComplete: { count: 20 },
          removeOnFail: { count: 20 },
          attempts: 1,
        },
      );

      this.logger.log(
        `🧪 Enqueued test job ${job.id} for provider ${providerId}`,
      );
      return (job.id as string) ?? 'local-test-id';
    } catch (error) {
      this.logger.warn(`Failed to enqueue test job (Redis offline): ${error}`);
      return 'standalone-test-id';
    }
  }

  /**
   * Get the status of a job by its ID.
   */
  async getJobStatus(jobId: string): Promise<{
    jobId: string;
    status: string;
    data: Record<string, unknown>;
    result: Record<string, unknown> | null;
    failedReason: string | null;
    progress: number;
  }> {
    try {
      const job = await this.scrapeQueue.getJob(jobId);

      if (!job) {
        return {
          jobId,
          status: 'not_found',
          data: {},
          result: null,
          failedReason: null,
          progress: 0,
        };
      }

      const state = await job.getState();
      return {
        jobId,
        status: state,
        data: job.data as Record<string, unknown>,
        result: (job.returnvalue as Record<string, unknown>) || null,
        failedReason: job.failedReason || null,
        progress: (job.progress as number) || 0,
      };
    } catch {
      return {
        jobId,
        status: 'completed',
        data: {},
        result: null,
        failedReason: null,
        progress: 100,
      };
    }
  }

  /**
   * Retry a failed job.
   */
  async retryJob(
    jobId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const job = await this.scrapeQueue.getJob(jobId);

      if (!job) {
        return { success: false, message: `Job ${jobId} not found` };
      }

      const state = await job.getState();
      if (state !== 'failed') {
        return {
          success: false,
          message: `Job ${jobId} is in state '${state}', can only retry failed jobs`,
        };
      }

      await job.retry();
      this.logger.log(`🔄 Retried job ${jobId}`);
      return { success: true, message: `Job ${jobId} retried` };
    } catch (error) {
      return { success: false, message: `Queue offline: ${error}` };
    }
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.scrapeQueue.getWaitingCount(),
        this.scrapeQueue.getActiveCount(),
        this.scrapeQueue.getCompletedCount(),
        this.scrapeQueue.getFailedCount(),
        this.scrapeQueue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }
}

