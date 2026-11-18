import { Injectable, NotFoundException } from '@nestjs/common';
import { Course } from '@prisma/client';
import { CoursesRepository, PaginatedResult } from './courses.repository';
import { ListCoursesDto, SearchCoursesDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { getActiveFilter } from '../common/helpers/active-filter.helper';

export function mapCourseToResponse(
  course: any,
  targetProviderId?: string,
): any {
  if (!course) return null;

  let source = null;

  if (targetProviderId) {
    source = course.couponSources?.find(
      (s: any) => s.providerId === targetProviderId,
    );
  }

  if (!source) {
    const activeSources =
      course.couponSources?.filter(
        (s: any) =>
          s.isActive &&
          s.isFree &&
          (!s.expiresAt ||
            new Date(s.expiresAt as string | number | Date) >= new Date()),
      ) || [];

    source =
      activeSources.length > 0
        ? activeSources[0]
        : course.couponSources?.[0] || {};
  }

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
    provider:
      source.provider ||
      (source.providerId
        ? { id: source.providerId, name: 'Unknown' }
        : undefined),
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
      sortBy: dto.sortBy,
      expiryStatus: dto.expiryStatus,
      language: dto.language,
      timeRange: dto.timeRange,
    });
    return {
      ...result,
      data: result.data.map((c) => mapCourseToResponse(c, dto.providerId)),
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
    const result = await this.coursesRepository.search({
      query: dto.query,
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      categoryId: dto.categoryId,
      providerId: dto.providerId,
      sortBy: dto.sortBy,
      expiryStatus: dto.expiryStatus,
      language: dto.language,
      timeRange: dto.timeRange,
    });
    return {
      ...result,
      data: result.data.map((c) => mapCourseToResponse(c, dto.providerId)),
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

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getRecommendations(userId: string): Promise<Course[]> {
    // Single fetch for favorites — get both courseId and categoryId
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { categoryId: true } } },
    });

    // Single fetch for history — get both courseId and categoryId
    const history = await this.prisma.history.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { categoryId: true } } },
    });

    // Build category weights and exclusion IDs from the same data
    const categoryCounts: Record<string, number> = {};
    const addCount = (catId: string | null, weight: number) => {
      if (catId) {
        categoryCounts[catId] = (categoryCounts[catId] || 0) + weight;
      }
    };

    const excludedCourseIds = new Set<string>();

    favorites.forEach((f) => {
      addCount(f.course?.categoryId, 3);
      excludedCourseIds.add(f.courseId);
    });
    history.forEach((h) => {
      addCount(h.course?.categoryId, 1);
      excludedCourseIds.add(h.courseId);
    });

    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([catId]) => catId);

    const excludedIds = [...excludedCourseIds];
    const activeFilter = getActiveFilter();

    let recommended: Course[] = [];

    if (sortedCategories.length > 0) {
      recommended = await this.prisma.course.findMany({
        where: {
          language: 'English',
          id: { notIn: excludedIds },
          categoryId: { in: sortedCategories },
          couponSources: { some: activeFilter },
        },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
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

    // Backfill if we have fewer than 10 recommendations
    if (recommended.length < 10) {
      const needed = 10 - recommended.length;
      const alreadyRecommendedIds = recommended.map((r) => r.id);
      const backfill = await this.prisma.course.findMany({
        where: {
          language: 'English',
          id: { notIn: [...excludedIds, ...alreadyRecommendedIds] },
          couponSources: { some: activeFilter },
        },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
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

    return recommended.map((c) => mapCourseToResponse(c));
  }

  async semanticSearch(
    dto: SearchCoursesDto,
  ): Promise<PaginatedResult<Course>> {
    const searchText = dto.query;
    if (!searchText) {
      return this.search(dto);
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    try {
      const queryEmbedding = await this.embeddingsService.generate(searchText);
      const vectorSql = `[${queryEmbedding.join(',')}]`;

      // Get total matching count and paginated results in parallel
      const [similarityRows, totalResult] = await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT ce.course_id, 1 - (ce.embedding <=> $1::vector) as similarity
           FROM course_embeddings ce
           JOIN courses c ON c.id = ce.course_id
           ORDER BY ce.embedding <=> $1::vector ASC
           LIMIT $2 OFFSET $3`,
          vectorSql,
          limit,
          skip,
        ),
        this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*)::bigint as count
           FROM course_embeddings ce
           JOIN courses c ON c.id = ce.course_id`,
          vectorSql,
        ),
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
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
            similarity: row ? parseFloat(String(row.similarity)) : 0,
          };
        })
        .filter(Boolean) as any[];

      return {
        data: sortedCourses.map((c) => mapCourseToResponse(c, dto.providerId)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch {
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
            similarity: row ? parseFloat(String(row.similarity)) : 0,
          };
        })
        .filter(Boolean)
        .map((c) => mapCourseToResponse(c));
    } catch {
      return [];
    }
  }

  async exportCourses(
    format: 'csv' | 'json' = 'csv',
    type: 'all' | 'favorites' = 'all',
    userId?: string,
  ) {
    let courses: any[] = [];
    if (type === 'favorites' && userId) {
      const favs = await this.prisma.favorite.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              category: true,
              couponSources: { include: { provider: true } },
            },
          },
        },
      });
      courses = favs.map((f) => mapCourseToResponse(f.course));
    } else {
      const res = await this.coursesRepository.findAll({
        page: 1,
        limit: 1000,
      });
      courses = res.data.map((c) => mapCourseToResponse(c));
    }

    if (format === 'json') {
      return {
        data: JSON.stringify(courses, null, 2),
        filename: `udemy-courses-${type}-${Date.now()}.json`,
        contentType: 'application/json',
      };
    }

    const headers = [
      'ID',
      'Title',
      'Udemy URL',
      'Coupon URL',
      'Category',
      'Provider',
      'Rating',
      'Instructor',
      'Created At',
    ];
    const rows = courses.map((c) => [
      c.id,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.udemyUrl || ''}"`,
      `"${c.couponUrl || ''}"`,
      `"${c.category?.name || ''}"`,
      `"${c.provider?.name || ''}"`,
      c.rating ?? '',
      `"${(c.instructor || '').replace(/"/g, '""')}"`,
      c.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    return {
      data: csvContent,
      filename: `udemy-courses-${type}-${Date.now()}.csv`,
      contentType: 'text/csv',
    };
  }

  async reportExpired(id: string) {
    await this.prisma.couponSource.updateMany({
      where: { courseId: id },
      data: { isActive: false },
    });
    return { success: true, message: 'Coupon reported and marked as expired' };
  }
}
