import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersRepository } from './providers.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('ProvidersRepository', () => {
  let repository: ProvidersRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      provider: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      log: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<ProvidersRepository>(ProvidersRepository);
  });

  describe('findAll', () => {
    it('should return providers ordered by name', async () => {
      const mockProviders = [{ id: 'p1', name: 'Alpha' }];
      prisma.provider.findMany.mockResolvedValue(mockProviders);

      const result = await repository.findAll();

      expect(result).toEqual(mockProviders);
      expect(prisma.provider.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a provider when found', async () => {
      const mockProvider = { id: 'p1', name: 'Test' };
      prisma.provider.findUnique.mockResolvedValue(mockProvider);

      const result = await repository.findById('p1');
      expect(result).toEqual(mockProvider);
    });

    it('should return null when not found', async () => {
      prisma.provider.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update provider data', async () => {
      const updated = { id: 'p1', isEnabled: false };
      prisma.provider.update.mockResolvedValue(updated);

      const result = await repository.update('p1', { isEnabled: false });

      expect(result).toEqual(updated);
      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isEnabled: false },
      });
    });
  });

  describe('findLogs', () => {
    it('should return paginated logs', async () => {
      const mockLogs = [{ id: 'log-1' }];
      prisma.log.findMany.mockResolvedValue(mockLogs);
      prisma.log.count.mockResolvedValue(1);

      const result = await repository.findLogs('p1', 1, 10);

      expect(result).toEqual({ data: mockLogs, total: 1 });
      expect(prisma.log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: 'p1' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should calculate skip for page 2', async () => {
      prisma.log.findMany.mockResolvedValue([]);
      prisma.log.count.mockResolvedValue(0);

      await repository.findLogs('p1', 2, 20);

      expect(prisma.log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });
  });

  describe('getStats', () => {
    it('should return aggregated stats', async () => {
      prisma.log.count
        .mockResolvedValueOnce(10) // totalRuns
        .mockResolvedValueOnce(8); // successRuns
      prisma.log.aggregate.mockResolvedValueOnce({
        _sum: { coursesFound: 100, coursesAccepted: 80, coursesRejected: 20 },
      });
      prisma.log.findFirst.mockResolvedValue({
        startedAt: new Date('2026-01-01'),
        status: 'SUCCESS',
      });

      const result = await repository.getStats('p1');

      expect(result.totalRuns).toBe(10);
      expect(result.successfulRuns).toBe(8);
      expect(result.failedRuns).toBe(2);
      expect(result.successRate).toBe(80);
      expect(result.totalCoursesFound).toBe(100);
      expect(result.totalCoursesAccepted).toBe(80);
      expect(result.totalCoursesRejected).toBe(20);
    });

    it('should return 0 success rate when no runs', async () => {
      prisma.log.count.mockResolvedValue(0);
      prisma.log.aggregate.mockResolvedValue({ _sum: {} });
      prisma.log.findFirst.mockResolvedValue(null);

      const result = await repository.getStats('p1');

      expect(result.successRate).toBe(0);
      expect(result.lastRunAt).toBeNull();
    });
  });
});
