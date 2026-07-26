import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';

import { NotificationsService } from '../notifications/notifications.service';

describe('JobsService', () => {
  let service: JobsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      on: jest.fn(),
      getJob: jest.fn(),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(10),
      getFailedCount: jest.fn().mockResolvedValue(2),
      getDelayedCount: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getQueueToken('scrape-queue'), useValue: mockQueue },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(30) },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyNewCourses: jest.fn(),
            notifyExpiringSoon: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  describe('enqueueScrapeJob', () => {
    it('should enqueue a scrape-all job when no providerId', async () => {
      const jobId = await service.enqueueScrapeJob();

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'scrape-all',
        {},
        expect.any(Object),
      );
    });

    it('should enqueue a scrape-single job for specific provider', async () => {
      const jobId = await service.enqueueScrapeJob('prov-1');

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'scrape-single',
        { providerId: 'prov-1' },
        expect.any(Object),
      );
    });
  });

  describe('enqueueTestJob', () => {
    it('should enqueue a test-provider job', async () => {
      const jobId = await service.enqueueTestJob('prov-1');

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'test-provider',
        { providerId: 'prov-1' },
        expect.any(Object),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return status for an existing job', async () => {
      mockQueue.getJob.mockResolvedValue({
        data: { providerId: 'prov-1' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: { coursesFound: 10 },
        failedReason: null,
        progress: 100,
      });

      const result = await service.getJobStatus('job-1');

      expect(result.status).toBe('completed');
      expect(result.jobId).toBe('job-1');
    });

    it('should return not_found for missing job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('nonexistent');

      expect(result.status).toBe('not_found');
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      mockQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('failed'),
        retry: jest.fn(),
      });

      const result = await service.retryJob('job-1');

      expect(result.success).toBe(true);
    });

    it('should return failure for non-failed job', async () => {
      mockQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('completed'),
      });

      const result = await service.retryJob('job-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('completed');
    });

    it('should return failure for missing job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.retryJob('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 2,
        delayed: 0,
      });
    });
  });
});
