import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesRepository } from './courses.repository';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let repository: jest.Mocked<Partial<CoursesRepository>>;
  let prisma: any;
  let cache: jest.Mocked<Partial<RedisCacheService>>;
  let embeddings: jest.Mocked<Partial<EmbeddingsService>>;

  beforeEach(async () => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      search: jest.fn(),
      countActive: jest.fn(),
      countExpiringSoon: jest.fn(),
    };

    prisma = {
      course: { count: jest.fn().mockResolvedValue(100) },
      favorite: { count: jest.fn().mockResolvedValue(5) },
      provider: { count: jest.fn().mockResolvedValue(9) },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    embeddings = {
      generateEmbedding: jest.fn().mockResolvedValue([]),
      findSimilarCourses: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: CoursesRepository, useValue: repository },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisCacheService, useValue: cache },
        { provide: EmbeddingsService, useValue: embeddings },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  describe('findAll', () => {
    it('should delegate to repository with correct params', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      repository.findAll!.mockResolvedValue(mockResult);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(repository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        categoryId: undefined,
        providerId: undefined,
        sortBy: undefined,
        expiryStatus: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it('should use default pagination when not provided', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      repository.findAll!.mockResolvedValue(mockResult);

      await service.findAll({});

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  describe('findById', () => {
    it('should return a course when found', async () => {
      const mockCourse = { id: 'course-1', title: 'Test Course' };
      repository.findById!.mockResolvedValue(mockCourse as any);

      const result = await service.findById('course-1');
      expect(result).toMatchObject(mockCourse);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById!.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should delegate to repository with correct params', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      repository.search!.mockResolvedValue(mockResult);

      await service.search({ query: 'python', page: 1 });

      expect(repository.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'python', page: 1, limit: 20 }),
      );
    });
  });

  describe('getDashboardStats', () => {
    it('should return cached stats if available', async () => {
      const cached = { totalCourses: 50, activeCourses: 40 };
      cache.get!.mockResolvedValue(cached);

      const result = await service.getDashboardStats('user-1');
      expect(result).toEqual(cached);
      expect(repository.countActive).not.toHaveBeenCalled();
    });

    it('should compute and cache stats when not cached', async () => {
      cache.get!.mockResolvedValue(null);
      repository.countActive!.mockResolvedValue(80);
      repository.countExpiringSoon!.mockResolvedValue(5);

      const result = await service.getDashboardStats('user-1');

      expect(result).toEqual({
        totalCourses: 100,
        activeCourses: 80,
        expiringSoon: 5,
        totalFavorites: 5,
        activeSources: 9,
      });
      expect(cache.set).toHaveBeenCalledWith(
        'dashboard:stats:user-1',
        expect.any(Object),
        60,
      );
    });

    it('should use global favorite count when no userId', async () => {
      cache.get!.mockResolvedValue(null);
      repository.countActive!.mockResolvedValue(80);
      repository.countExpiringSoon!.mockResolvedValue(5);

      await service.getDashboardStats();

      expect(prisma.favorite.count).toHaveBeenCalledWith();
    });
  });
});
