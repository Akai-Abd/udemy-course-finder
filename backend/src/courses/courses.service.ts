import { Injectable, NotFoundException } from '@nestjs/common';
import { Course } from '@prisma/client';
import { CoursesRepository, PaginatedResult } from './courses.repository';
import { ListCoursesDto, SearchCoursesDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export function mapCourseToResponse(course: any): any {
  if (!course) return null;
  const activeSources = course.couponSources?.filter(
    (s: any) =>
      s.isActive &&
      s.isFree &&
      (!s.expiresAt || new Date(s.expiresAt) >= new Date()),
  ) || [];

  const source = activeSources.length > 0
    ? activeSources[0]
    : (course.couponSources?.[0] || {});

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    udemyUrl: course.udemyUrl,
    udemyCourseId: course.udemyCourseId,
    categoryId: course.categoryId,
    language: course.language,
    thumbnailUrl: course.thumbnailUrl,
    rating: course.rating,
    instructor: course.instructor,
    priceOriginal: course.priceOriginal,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    category: course.category,
    _count: course._count,

    // Flattened fields
    couponUrl: source.couponUrl || '',
    providerId: source.providerId || '',
    isFree: source.isFree !== undefined ? source.isFree : true,
    expiresAt: source.expiresAt || null,
    firstSeenAt: source.firstSeenAt || course.createdAt,
    lastVerifiedAt: source.lastVerifiedAt || course.updatedAt,
    isActive: source.isActive !== undefined ? source.isActive : false,
    provider: source.provider || (source.providerId ? { id: source.providerId, name: 'Unknown' } : undefined),
    similarity: course.similarity,

    // Full relation for advanced usage
    couponSources: course.couponSources,
  };
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async findAll(dto: ListCoursesDto): Promise<PaginatedResult<Course>> {
    const result = await this.coursesRepository.findAll({
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      categoryId: dto.categoryId,
      providerId: dto.providerId,
      sortBy: dto.sortBy ?? dto.sort,
      expiryStatus: dto.expiryStatus,
    });
    return {
      ...result,
      data: result.data.map(mapCourseToResponse),
    };
  }

  async findById(id: string): Promise<Course> {
    const course = await this.coursesRepository.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`);
    }
    return mapCourseToResponse(course);
  }

  async search(dto: SearchCoursesDto): Promise<PaginatedResult<Course>> {
    const searchText = dto.query || dto.q;
    const result = await this.coursesRepository.search({
      query: searchText,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      categoryId: dto.categoryId,
      providerId: dto.providerId,
      sortBy: dto.sortBy ?? dto.sort,
      expiryStatus: dto.expiryStatus,
    });
    return {
      ...result,
      data: result.data.map(mapCourseToResponse),
    };
  }

  async getDashboardStats(userId?: string) {
    const cacheKey = `dashboard:stats:${userId ?? 'global'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [
      totalCourses,
      activeCourses,
      expiringSoon,
      totalFavorites,
      activeSources,
    ] = await Promise.all([
      this.prisma.course.count(),
      this.coursesRepository.countActive(),
      this.coursesRepository.countExpiringSoon(),
      userId
        ? this.prisma.favorite.count({ where: { userId } })
        : this.prisma.favorite.count(),
      this.prisma.provider.count({ where: { isEnabled: true } }),
    ]);

    const result = {
      totalCourses,
      activeCourses,
      expiringSoon,
      totalFavorites,
      activeSources,
    };

    await this.cache.set(cacheKey, result, 60); // cache for 60 seconds
    return result;
  }

  async getRecommendations(userId: string): Promise<Course[]> {
    // 1. Fetch user's favorites to extract categories
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { course: { select: { categoryId: true } } },
    });

    // 2. Fetch user's history to extract categories
    const history = await this.prisma.history.findMany({
      where: { userId },
      select: { course: { select: { categoryId: true } } },
    });

    // Combine and count category occurrences with weighted values
    const categoryCounts: Record<string, number> = {};
    const addCount = (catId: string | null, weight: number) => {
      if (catId) {
        categoryCounts[catId] = (categoryCounts[catId] || 0) + weight;
      }
    };

    favorites.forEach((f) => addCount(f.course?.categoryId, 3));
    history.forEach((h) => addCount(h.course?.categoryId, 1));

    // Sort categories by weight descending
    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([catId]) => catId);

    // Get excluded course IDs (already favorited or visited in history)
    const [favCourses, histCourses] = await Promise.all([
      this.prisma.favorite.findMany({ where: { userId }, select: { courseId: true } }),
      this.prisma.history.findMany({ where: { userId }, select: { courseId: true } }),
    ]);
    const excludedCourseIds = [...new Set([...favCourses.map((f) => f.courseId), ...histCourses.map((h) => h.courseId)])];

    let recommended: Course[] = [];
    const activeFilter = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };

    if (sortedCategories.length > 0) {
      recommended = await this.prisma.course.findMany({
        where: {
          language: 'English',
          id: { notIn: excludedCourseIds },
          categoryId: { in: sortedCategories },
          couponSources: { some: activeFilter },
        },
        orderBy: [
          { rating: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 10,
        include: {
          couponSources: {
            include: {
              provider: { select: { id: true, name: true } },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { history: true } },
        },
      });
    }

    // 4. Backfill if we have fewer than 10 recommendations
    if (recommended.length < 10) {
      const needed = 10 - recommended.length;
      const alreadyRecommendedIds = recommended.map((r) => r.id);
      const backfill = await this.prisma.course.findMany({
        where: {
          language: 'English',
          id: { notIn: [...excludedCourseIds, ...alreadyRecommendedIds] },
          couponSources: { some: activeFilter },
        },
        orderBy: [
          { rating: 'desc' },
          { createdAt: 'desc' },
        ],
        take: needed,
        include: {
          couponSources: {
            include: {
              provider: { select: { id: true, name: true } },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { history: true } },
        },
      });
      recommended = [...recommended, ...backfill];
    }

    return recommended.map(mapCourseToResponse);
  }

  async semanticSearch(dto: SearchCoursesDto): Promise<PaginatedResult<Course>> {
    const searchText = dto.query || dto.q;
    if (!searchText) {
      return this.search(dto);
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    try {
      const queryEmbedding = await this.embeddingsService.generate(searchText);
      const vectorSql = `[${queryEmbedding.join(',')}]`;

      const similarityRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT ce.course_id, 1 - (ce.embedding <=> $1::vector) as similarity
         FROM course_embeddings ce
         JOIN courses c ON c.id = ce.course_id
         ORDER BY ce.embedding <=> $1::vector ASC
         LIMIT $2 OFFSET $3`,
        vectorSql,
        limit,
        skip,
      );

      const courseIds = similarityRows.map((r) => r.course_id);

      if (courseIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      const courses = await this.prisma.course.findMany({
        where: {
          id: { in: courseIds },
        },
        include: {
          category: true,
          couponSources: {
            include: {
              provider: true,
            },
          },
          _count: {
            select: { history: true },
          },
        },
      });

      const sortedCourses = courseIds
        .map((id) => {
          const course = courses.find((c) => c.id === id);
          if (!course) return null;
          const row = similarityRows.find((r) => r.course_id === id);
          return {
            ...course,
            similarity: row ? parseFloat(row.similarity) : 0,
          };
        })
        .filter(Boolean) as any[];

      const total = await this.prisma.courseEmbedding.count();

      return {
        data: sortedCourses.map(mapCourseToResponse),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      return this.search(dto);
    }
  }

  async getSimilarCourses(courseId: string, limit = 4): Promise<Course[]> {
    try {
      const similarityRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT ce.course_id, 1 - (ce.embedding <=> target.embedding) as similarity
         FROM course_embeddings ce
         CROSS JOIN (SELECT embedding FROM course_embeddings WHERE course_id = $1) target
         WHERE ce.course_id != $1
         ORDER BY ce.embedding <=> target.embedding ASC
         LIMIT $2`,
        courseId,
        limit,
      );

      const courseIds = similarityRows.map((r) => r.course_id);
      if (courseIds.length === 0) return [];

      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        include: {
          category: true,
          couponSources: {
            include: {
              provider: true,
            },
          },
          _count: {
            select: { history: true },
          },
        },
      });

      return courseIds
        .map((id) => {
          const course = courses.find((c) => c.id === id);
          if (!course) return null;
          const row = similarityRows.find((r) => r.course_id === id);
          return {
            ...course,
            similarity: row ? parseFloat(row.similarity) : 0,
          };
        })
        .filter(Boolean)
        .map(mapCourseToResponse) as any[];
    } catch (error) {
      return [];
    }
  }
}
