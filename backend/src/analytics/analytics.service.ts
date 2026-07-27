import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import { getActiveFilter } from '../common/helpers/active-filter.helper';

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

  private get isSqlite(): boolean {
    return (process.env.DATABASE_URL || '').startsWith('file:');
  }

  private formatDate(dateVal: Date | string): string {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
      return dateVal.toISOString().split('T')[0];
    }
    const str = String(dateVal);
    return str.includes('T') ? str.split('T')[0] : str.slice(0, 10);
  }

  private async getCoursesPerDay(
    startDate: Date,
  ): Promise<{ date: string; count: number }[]> {
    let results: { date: Date | string; count: bigint | number }[];

    if (this.isSqlite) {
      results = await this.prisma.$queryRaw`
        SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count
        FROM courses
        WHERE created_at >= ${startDate}
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY date ASC
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT DATE_TRUNC('day', created_at) as date, COUNT(*)::bigint as count
        FROM courses
        WHERE created_at >= ${startDate}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `;
    }

    return results.map((r) => ({
      date: this.formatDate(r.date),
      count: Number(r.count),
    }));
  }

  private async getCoursesByProviderPerDay(
    startDate: Date,
  ): Promise<{ date: string; provider: string; count: number }[]> {
    let results: {
      date: Date | string;
      provider_name: string;
      count: bigint | number;
    }[];

    if (this.isSqlite) {
      results = await this.prisma.$queryRaw`
        SELECT 
          strftime('%Y-%m-%d', cs.created_at) as date, 
          p.name as provider_name,
          COUNT(*) as count
        FROM coupon_sources cs
        JOIN providers p ON cs.provider_id = p.id
        WHERE cs.created_at >= ${startDate}
        GROUP BY strftime('%Y-%m-%d', cs.created_at), p.name
        ORDER BY date ASC, p.name ASC
      `;
    } else {
      results = await this.prisma.$queryRaw`
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
    }

    return results.map((r) => ({
      date: this.formatDate(r.date),
      provider: r.provider_name,
      count: Number(r.count),
    }));
  }

  private async getScrapingRunsPerDay(
    startDate: Date,
  ): Promise<{ date: string; success: number; failed: number }[]> {
    let results: {
      date: Date | string;
      success_count: bigint | number;
      failed_count: bigint | number;
    }[];

    if (this.isSqlite) {
      results = await this.prisma.$queryRaw`
        SELECT 
          strftime('%Y-%m-%d', started_at) as date,
          SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
        FROM logs
        WHERE started_at >= ${startDate}
        GROUP BY strftime('%Y-%m-%d', started_at)
        ORDER BY date ASC
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', started_at) as date,
          COUNT(*) FILTER (WHERE status = 'SUCCESS')::bigint as success_count,
          COUNT(*) FILTER (WHERE status = 'FAILED')::bigint as failed_count
        FROM logs
        WHERE started_at >= ${startDate}
        GROUP BY DATE_TRUNC('day', started_at)
        ORDER BY date ASC
      `;
    }

    return results.map((r) => ({
      date: this.formatDate(r.date),
      success: Number(r.success_count ?? 0),
      failed: Number(r.failed_count ?? 0),
    }));
  }

  private async getCoursesByCategory(): Promise<
    { category: string; count: number }[]
  > {
    const activeFilter = getActiveFilter();
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
    const activeFilter = getActiveFilter();
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
