import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Course, Prisma } from '@prisma/client';
import { CourseSortBy } from './dto';

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
  }): Promise<PaginatedResult<Course>> {
    const { page, limit, categoryId, providerId, sortBy, expiryStatus, language } =
      params;
    const skip = (page - 1) * limit;

    const activeFilter: Prisma.CouponSourceWhereInput = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };

    const langFilter =
      language === 'all'
        ? undefined
        : language === 'Non-English'
        ? { not: 'English' }
        : language || 'English';

    const where: Prisma.CourseWhereInput = {
      ...(langFilter && { language: langFilter }),
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

  async search(params: {
    query?: string;
    page: number;
    limit: number;
    categoryId?: string;
    providerId?: string;
    sortBy?: CourseSortBy;
    expiryStatus?: string;
    language?: string;
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
    } = params;
    const skip = (page - 1) * limit;

    const activeFilter: Prisma.CouponSourceWhereInput = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };

    const langFilter =
      language === 'all'
        ? undefined
        : language === 'Non-English'
        ? { not: 'English' }
        : language || 'English';

    const where: Prisma.CourseWhereInput = {
      ...(langFilter && { language: langFilter }),
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

  async countActive(): Promise<number> {
    const activeFilter = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };
    return this.prisma.course.count({
      where: {
        couponSources: {
          some: activeFilter,
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

  async findRecent(limit = 10): Promise<Course[]> {
    const activeFilter = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };
    return this.prisma.course.findMany({
      where: {
        language: 'English',
        couponSources: {
          some: activeFilter,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        couponSources: {
          include: {
            provider: { select: { id: true, name: true } },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  private buildSortOrder(
    sortBy?: CourseSortBy,
  ): Prisma.CourseOrderByWithRelationInput {
    switch (sortBy) {
      case CourseSortBy.EXPIRING:
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
      case CourseSortBy.TITLE:
      case CourseSortBy.ALPHABETICAL:
        return { title: 'asc' };
      case CourseSortBy.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }
}
