import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('scrape-queue') private readonly scrapeQueue: Queue,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    // Register the repeatable scrape-all job based on configured interval
    const intervalMinutes = this.configService.get<number>(
      'SCRAPE_INTERVAL_MINUTES',
      30,
    );
    const intervalMs = intervalMinutes * 60 * 1000;

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

    const job = await this.scrapeQueue.add(jobName, data, {
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
      attempts: 1,
    });

    this.logger.log(
      `📤 Enqueued ${jobName} job ${job.id} ${providerId ? `for provider ${providerId}` : '(all providers)'}`,
    );

    return job.id as string;
  }

  /**
   * Enqueue a provider connectivity test job.
   */
  async enqueueTestJob(providerId: string): Promise<string> {
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
    return job.id as string;
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
  }

  /**
   * Retry a failed job.
   */
  async retryJob(
    jobId: string,
  ): Promise<{ success: boolean; message: string }> {
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
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.scrapeQueue.getWaitingCount(),
      this.scrapeQueue.getActiveCount(),
      this.scrapeQueue.getCompletedCount(),
      this.scrapeQueue.getFailedCount(),
      this.scrapeQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
