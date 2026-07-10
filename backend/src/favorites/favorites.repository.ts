import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Favorite } from '@prisma/client';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<any[]> {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
    });
  }

  async create(userId: string, courseId: string): Promise<Favorite> {
    return this.prisma.favorite.upsert({
      where: {
        unique_user_course_favorite: { userId, courseId },
      },
      update: {},
      create: { userId, courseId },
    });
  }

  async delete(userId: string, courseId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: { userId, courseId },
    });
  }

  async exists(userId: string, courseId: string): Promise<boolean> {
    const count = await this.prisma.favorite.count({
      where: { userId, courseId },
    });
    return count > 0;
  }
}
