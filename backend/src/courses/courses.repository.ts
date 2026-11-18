import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Course, Prisma } from '@prisma/client';
import { CourseSortBy } from './dto';
import { getActiveFilter } from '../common/helpers/active-filter.helper';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page: number;
    limit: number;
    categoryId?: string;
    providerId?: string;
    sortBy?: CourseSortBy;
    expiryStatus?: string;
    language?: string;
    timeRange?: string;
  }): Promise<PaginatedResult<Course>> {
    return this.findCourses(params);
  }

  async search(params: {
    query?: string;
    page: number;
    limit: number;
    categoryId?: string;
    providerId?: string;
    sortBy?: CourseSortBy;
    expiryStatus?: string;
    language?: string;
    timeRange?: string;
  }): Promise<PaginatedResult<Course>> {
    return this.findCourses(params);
  }

  async findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        couponSources: {
          include: {
            provider: { select: { id: true, name: true, baseUrl: true } },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async countActive(): Promise<number> {
    return this.prisma.course.count({
      where: {
        couponSources: {
          some: getActiveFilter(),
        },
      },
    });
  }

  async countExpiringSoon(hoursThreshold = 24): Promise<number> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() + hoursThreshold);

    return this.prisma.course.count({
      where: {
        couponSources: {
          some: {
            isActive: true,
            isFree: true,
            expiresAt: { gte: new Date(), lte: threshold },
          },
        },
      },
    });
  }

  private async findCourses(params: {
    query?: string;
    page: number;
    limit: number;
    categoryId?: string;
    providerId?: string;
    sortBy?: CourseSortBy;
    expiryStatus?: string;
    language?: string;
    timeRange?: string;
  }): Promise<PaginatedResult<Course>> {
    const {
      query,
      page,
      limit,
      categoryId,
      providerId,
      sortBy,
      expiryStatus,
      language,
      timeRange,
    } = params;
    const skip = (page - 1) * limit;

    const activeFilter = getActiveFilter();
    const langFilter = this.buildLanguageFilter(language);

    const timeFilter =
      timeRange === 'today'
        ? {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          }
        : timeRange === '24h'
          ? {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            }
          : undefined;

    const where: Prisma.CourseWhereInput = {
      ...(langFilter && { language: langFilter }),
      ...(timeFilter && { createdAt: timeFilter }),
      ...(query && {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { instructor: { contains: query } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(providerId
        ? {
            couponSources: {
              some: {
                providerId,
                ...(expiryStatus === 'active' && activeFilter),
                ...(expiryStatus === 'expired' && { NOT: activeFilter }),
              },
            },
          }
        : {
            ...(expiryStatus === 'active' && {
              couponSources: { some: activeFilter },
            }),
            ...(expiryStatus === 'expired' && {
              couponSources: { none: activeFilter },
            }),
          }),
    };

    const orderBy = this.buildSortOrder(sortBy);

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          couponSources: {
            include: {
              provider: { select: { id: true, name: true } },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { history: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildLanguageFilter(
    language?: string,
  ): string | { not: string } | undefined {
    if (language === 'all') return undefined;
    if (language === 'Non-English') return { not: 'English' };
    return language || 'English';
  }

  private buildSortOrder(
    sortBy?: CourseSortBy,
  ): Prisma.CourseOrderByWithRelationInput {
    switch (sortBy) {
      case CourseSortBy.EXPIRING_SOON:
        return {
          couponSources: {
            _min: {
              expiresAt: 'asc',
            },
          },
        } as any;
      case CourseSortBy.RATING:
        return { rating: 'desc' };
      case CourseSortBy.ALPHABETICAL:
        return { title: 'asc' };
      case CourseSortBy.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }
}
