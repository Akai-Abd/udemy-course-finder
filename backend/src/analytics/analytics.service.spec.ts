import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;
  let cache: jest.Mocked<Partial<RedisCacheService>>;

  beforeEach(async () => {
    prisma = {
      course: {
        count: jest.fn().mockResolvedValue(100),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      provider: {
        count: jest.fn().mockResolvedValue(9),
        findMany: jest.fn().mockResolvedValue([]),
      },
      log: {
        count: jest.fn().mockResolvedValue(50),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getOverview', () => {
    it('should return cached result if available', async () => {
      const cached = { totalCourses: 50 };
      cache.get!.mockResolvedValue(cached);

      const result = await service.getOverview();
      expect(result).toEqual(cached);
      expect(prisma.course.count).not.toHaveBeenCalled();
    });

    it('should compute overview and cache it', async () => {
      prisma.course.count.mockResolvedValue(100);
      prisma.provider.count
        .mockResolvedValueOnce(9) // total
        .mockResolvedValueOnce(7); // active
      prisma.log.count
        .mockResolvedValueOnce(50) // total runs
        .mockResolvedValueOnce(45); // successful

      const result = await service.getOverview();

      expect(result.totalCourses).toBe(100);
      expect(result.totalProviders).toBe(9);
      expect(result.activeSources).toBe(7);
      expect(result.totalScrapingRuns).toBe(50);
      expect(result.successRate).toBe(90);
      expect(cache.set).toHaveBeenCalledWith(
        'analytics:overview',
        expect.any(Object),
        120,
      );
    });

    it('should return 0 success rate when no runs', async () => {
      prisma.log.count.mockResolvedValue(0);

      const result = await service.getOverview();
      expect(result.successRate).toBe(0);
    });
  });

  describe('getTimeSeries', () => {
    it('should return cached result if available', async () => {
      const cached = { coursesPerDay: [] };
      cache.get!.mockResolvedValue(cached);

      const result = await service.getTimeSeries(30);
      expect(result).toEqual(cached);
    });

    it('should compute time-series and cache for 5 minutes', async () => {
      const result = await service.getTimeSeries(30);

      expect(result).toHaveProperty('coursesPerDay');
      expect(result).toHaveProperty('coursesByProviderPerDay');
      expect(result).toHaveProperty('scrapingRunsPerDay');
      expect(result.days).toBe(30);
      expect(cache.set).toHaveBeenCalledWith(
        'analytics:timeseries:30',
        expect.any(Object),
        300,
      );
    });
  });
});
