import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getOverview() {
    const cacheKey = 'analytics:overview';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [
      totalCourses,
      totalProviders,
      activeSources,
      totalScrapingRuns,
      successfulRuns,
      coursesByCategory,
      coursesByProvider,
    ] = await Promise.all([
      this.prisma.course.count(),
      this.prisma.provider.count(),
      this.prisma.provider.count({ where: { isEnabled: true } }),
      this.prisma.log.count(),
      this.prisma.log.count({ where: { status: 'SUCCESS' } }),
      this.getCoursesByCategory(),
      this.getCoursesByProvider(),
    ]);

    const successRate =
      totalScrapingRuns > 0 ? (successfulRuns / totalScrapingRuns) * 100 : 0;

    const result = {
      totalCourses,
      totalProviders,
      activeSources,
      totalScrapingRuns,
      successRate,
      coursesByCategory,
      coursesByProvider,
    };

    await this.cache.set(cacheKey, result, 120); // cache for 2 minutes
    return result;
  }

  async getTimeSeries(days: number = 30) {
    const cacheKey = `analytics:timeseries:${days}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [coursesPerDay, coursesByProviderPerDay, scrapingRunsPerDay] =
      await Promise.all([
        this.getCoursesPerDay(startDate),
        this.getCoursesByProviderPerDay(startDate),
        this.getScrapingRunsPerDay(startDate),
      ]);

    const result = {
      coursesPerDay,
      coursesByProviderPerDay,
      scrapingRunsPerDay,
      startDate: startDate.toISOString(),
      days,
    };

    await this.cache.set(cacheKey, result, 300); // cache for 5 minutes
    return result;
  }

  private async getCoursesPerDay(
    startDate: Date,
  ): Promise<{ date: string; count: number }[]> {
    const results: { date: Date; count: bigint }[] = await this.prisma
      .$queryRaw`
      SELECT DATE_TRUNC('day', created_at) as date, COUNT(*)::bigint as count
      FROM courses
      WHERE created_at >= ${startDate}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `;

    return results.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      count: Number(r.count),
    }));
  }

  private async getCoursesByProviderPerDay(
    startDate: Date,
  ): Promise<{ date: string; provider: string; count: number }[]> {
    const results: { date: Date; provider_name: string; count: bigint }[] =
      await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', cs.created_at) as date, 
        p.name as provider_name,
        COUNT(*)::bigint as count
      FROM coupon_sources cs
      JOIN providers p ON cs.provider_id = p.id
      WHERE cs.created_at >= ${startDate}
      GROUP BY DATE_TRUNC('day', cs.created_at), p.name
      ORDER BY date ASC, p.name ASC
    `;

    return results.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      provider: r.provider_name,
      count: Number(r.count),
    }));
  }

  private async getScrapingRunsPerDay(
    startDate: Date,
  ): Promise<{ date: string; success: number; failed: number }[]> {
    const results: {
      date: Date;
      success_count: bigint;
      failed_count: bigint;
    }[] = await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', started_at) as date,
        COUNT(*) FILTER (WHERE status = 'SUCCESS')::bigint as success_count,
        COUNT(*) FILTER (WHERE status = 'FAILED')::bigint as failed_count
      FROM logs
      WHERE started_at >= ${startDate}
      GROUP BY DATE_TRUNC('day', started_at)
      ORDER BY date ASC
    `;

    return results.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      success: Number(r.success_count),
      failed: Number(r.failed_count),
    }));
  }

  private async getCoursesByCategory(): Promise<
    { category: string; count: number }[]
  > {
    const activeFilter = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };
    const results = await this.prisma.course.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: {
        categoryId: { not: null },
        couponSources: { some: activeFilter },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Fetch category names for the grouped results
    if (results.length === 0) return [];

    const categoryIds = results
      .map((r) => r.categoryId)
      .filter((id): id is string => id !== null);

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return results.map((r) => ({
      category: categoryMap.get(r.categoryId!) ?? 'Unknown',
      count: r._count.id,
    }));
  }

  private async getCoursesByProvider(): Promise<
    { provider: string; count: number }[]
  > {
    const activeFilter = {
      isActive: true,
      isFree: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };
    const results = await this.prisma.couponSource.groupBy({
      by: ['providerId'],
      _count: { id: true },
      where: {
        ...activeFilter,
      },
      orderBy: { _count: { id: 'desc' } },
    });

    if (results.length === 0) return [];

    const providerIds = results.map((r) => r.providerId);

    const providers = await this.prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true },
    });

    const providerMap = new Map(providers.map((p) => [p.id, p.name]));

    return results.map((r) => ({
      provider: providerMap.get(r.providerId) ?? 'Unknown',
      count: r._count.id,
    }));
  }
}
