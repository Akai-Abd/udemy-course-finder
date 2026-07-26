import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersRepository } from './providers.repository';
import { JobsService } from '../jobs/jobs.service';

describe('ProvidersService', () => {
  let service: ProvidersService;
  let repository: jest.Mocked<Partial<ProvidersRepository>>;
  let jobsService: jest.Mocked<Partial<JobsService>>;

  const mockProvider = {
    id: 'prov-1',
    name: 'Real Discount',
    baseUrl: 'https://real.discount',
    isEnabled: true,
    timeoutMs: 30000,
    lastRunAt: null,
    lastStatus: 'IDLE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findAll: jest.fn().mockResolvedValue([mockProvider]),
      findById: jest.fn(),
      update: jest.fn(),
      findLogs: jest.fn(),
      getStats: jest.fn(),
      countEnabled: jest.fn(),
      createLog: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'log-1',
          providerId: data.provider?.connect?.id || 'prov-1',
          jobId: data.jobId,
          status: data.status || 'RUNNING',
          startedAt: new Date(),
          completedAt: null,
          itemsFound: 0,
          errorMessage: null,
        }),
      ),
    };

    jobsService = {
      enqueueScrapeJob: jest.fn().mockResolvedValue('job-1'),
      enqueueTestJob: jest.fn().mockResolvedValue('test-job-1'),
      retryJob: jest.fn(),
      triggerPythonScraper: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        { provide: ProvidersRepository, useValue: repository },
        { provide: JobsService, useValue: jobsService },
      ],
    }).compile();

    service = module.get<ProvidersService>(ProvidersService);
  });

  describe('findAll', () => {
    it('should return all providers', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockProvider]);
    });
  });

  describe('findById', () => {
    it('should return a provider when found', async () => {
      repository.findById!.mockResolvedValue(mockProvider as any);

      const result = await service.findById('prov-1');
      expect(result).toEqual(mockProvider);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById!.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update provider after verifying existence', async () => {
      repository.findById!.mockResolvedValue(mockProvider as any);
      repository.update!.mockResolvedValue({
        ...mockProvider,
        isEnabled: false,
      } as any);

      const result = await service.update('prov-1', { isEnabled: false });

      expect(result.isEnabled).toBe(false);
      expect(repository.update).toHaveBeenCalledWith('prov-1', {
        isEnabled: false,
      });
    });
  });

  describe('triggerScrape', () => {
    it('should enqueue scrape for specific provider', async () => {
      repository.findById!.mockResolvedValue(mockProvider as any);

      const result = await service.triggerScrape('prov-1');

      expect(result.jobId).toBe('job-1');
      expect(jobsService.enqueueScrapeJob).toHaveBeenCalledWith('prov-1');
    });

    it('should enqueue scrape for all providers', async () => {
      const result = await service.triggerScrape();

      expect(result.jobId).toBe('job-1');
      expect(jobsService.enqueueScrapeJob).toHaveBeenCalledWith(undefined);
    });
  });

  describe('testProvider', () => {
    it('should enqueue a test job', async () => {
      repository.findById!.mockResolvedValue(mockProvider as any);

      const result = await service.testProvider('prov-1');

      expect(result.jobId).toBe('test-job-1');
      expect(jobsService.enqueueTestJob).toHaveBeenCalledWith('prov-1');
    });
  });

  describe('retryProvider', () => {
    it('should initiate retry for provider', async () => {
      repository.findById!.mockResolvedValue(mockProvider as any);
      repository.update!.mockResolvedValue(mockProvider as any);

      const result = await service.retryProvider('prov-1');

      expect(result.message).toBe('Retry initiated for Real Discount');
      expect(repository.update).toHaveBeenCalledWith('prov-1', {
        lastStatus: 'RUNNING',
        lastRunAt: expect.any(Date),
      });
      expect(repository.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'RUNNING',
          message: 'Retrying scrape for Real Discount...',
        }),
      );
    });
  });
});
