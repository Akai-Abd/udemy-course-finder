import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Provider, Log, Prisma } from '@prisma/client';

@Injectable()
export class ProvidersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Provider[]> {
    return this.prisma.provider.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Provider | null> {
    return this.prisma.provider.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: Prisma.ProviderUpdateInput,
  ): Promise<Provider> {
    return this.prisma.provider.update({
      where: { id },
      data,
    });
  }

  async createLog(data: Prisma.LogCreateInput): Promise<Log> {
    return this.prisma.log.create({ data });
  }

  async updateLog(
    id: string,
    data: Prisma.LogUpdateInput,
  ): Promise<Log> {
    return this.prisma.log.update({
      where: { id },
      data,
    });
  }

  async findLogs(
    providerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Log[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = { providerId };

    const [data, total] = await Promise.all([
      this.prisma.log.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.log.count({ where }),
    ]);

    return { data, total };
  }

  async getStats(providerId: string) {
    const [
      totalRuns,
      successRuns,
      totalFound,
      totalAccepted,
      totalRejected,
      lastLog,
    ] = await Promise.all([
      this.prisma.log.count({ where: { providerId } }),
      this.prisma.log.count({
        where: { providerId, status: 'SUCCESS' },
      }),
      this.prisma.log.aggregate({
        where: { providerId },
        _sum: { coursesFound: true },
      }),
      this.prisma.log.aggregate({
        where: { providerId },
        _sum: { coursesAccepted: true },
      }),
      this.prisma.log.aggregate({
        where: { providerId },
        _sum: { coursesRejected: true },
      }),
      this.prisma.log.findFirst({
        where: { providerId },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      totalRuns,
      successRuns,
      successfulRuns: successRuns,
      failedRuns: totalRuns - successRuns,
      successRate: totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0,
      coursesFound: totalFound._sum.coursesFound ?? 0,
      totalCoursesFound: totalFound._sum.coursesFound ?? 0,
      coursesAccepted: totalAccepted._sum.coursesAccepted ?? 0,
      totalCoursesAccepted: totalAccepted._sum.coursesAccepted ?? 0,
      coursesRejected: totalRejected._sum.coursesRejected ?? 0,
      totalCoursesRejected: totalRejected._sum.coursesRejected ?? 0,
      lastRunAt: lastLog?.startedAt ?? null,
      lastStatus: lastLog?.status ?? null,
    };
  }

  async countEnabled(): Promise<number> {
    return this.prisma.provider.count({ where: { isEnabled: true } });
  }
}
