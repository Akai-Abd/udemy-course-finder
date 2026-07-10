import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { History, HistoryAction } from '@prisma/client';

@Injectable()
export class HistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [data, total] = await Promise.all([
      this.prisma.history.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          course: {
            include: {
              couponSources: {
                include: {
                  provider: { select: { id: true, name: true } },
                },
              },
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.history.count({ where }),
    ]);

    return { data, total };
  }

  async create(
    userId: string,
    courseId: string,
    action: HistoryAction,
  ): Promise<History> {
    return this.prisma.history.create({
      data: { userId, courseId, action },
    });
  }

  async deleteAllByUser(userId: string): Promise<number> {
    const result = await this.prisma.history.deleteMany({
      where: { userId },
    });
    return result.count;
  }
}
