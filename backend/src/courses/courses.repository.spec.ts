import { Test, TestingModule } from '@nestjs/testing';
import { CoursesRepository } from './courses.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CourseSortBy } from './dto';

describe('CoursesRepository', () => {
  let repository: CoursesRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      course: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<CoursesRepository>(CoursesRepository);
  });

  describe('findAll', () => {
    it('should build correct query with no filters', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);

      const result = await repository.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should apply category and provider filters', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);

      await repository.findAll({
        page: 1,
        limit: 10,
        categoryId: 'cat-1',
        providerId: 'prov-1',
      });

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-1',
            providerId: 'prov-1',
          }),
        }),
      );
    });

    it('should calculate pagination correctly', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(50);

      const result = await repository.findAll({ page: 3, limit: 10 });

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.totalPages).toBe(5);
    });
  });

  describe('findById', () => {
    it('should return a course with relations', async () => {
      const mockCourse = { id: 'c1', title: 'Test' };
      prisma.course.findUnique.mockResolvedValue(mockCourse);

      const result = await repository.findById('c1');

      expect(result).toEqual(mockCourse);
      expect(prisma.course.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          include: expect.any(Object),
        }),
      );
    });

    it('should return null when not found', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should build OR clause for text search', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);

      await repository.search({ query: 'python', page: 1, limit: 20 });

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) }),
              expect.objectContaining({ description: expect.any(Object) }),
              expect.objectContaining({ instructor: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should not include OR clause when no query provided', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);

      await repository.search({ page: 1, limit: 20 });

      const calledWith = prisma.course.findMany.mock.calls[0][0];
      expect(calledWith.where.OR).toBeUndefined();
    });
  });

  describe('countActive', () => {
    it('should count active, free, non-expired courses', async () => {
      prisma.course.count.mockResolvedValue(42);

      const result = await repository.countActive();

      expect(result).toBe(42);
      expect(prisma.course.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            isFree: true,
          }),
        }),
      );
    });
  });

  describe('countExpiringSoon', () => {
    it('should count courses expiring within threshold', async () => {
      prisma.course.count.mockResolvedValue(3);

      const result = await repository.countExpiringSoon(24);

      expect(result).toBe(3);
      expect(prisma.course.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            isFree: true,
            expiresAt: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('findRecent', () => {
    it('should return most recent courses', async () => {
      const mockCourses = [{ id: 'c1' }, { id: 'c2' }];
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const result = await repository.findRecent(5);

      expect(result).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
