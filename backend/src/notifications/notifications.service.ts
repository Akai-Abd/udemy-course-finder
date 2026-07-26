import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { UpdateNotificationPreferencesDto, PushSubscriptionDto } from './dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async deleteNotification(id: string, userId: string) {
    await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    return { success: true };
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata ?? undefined,
      },
    });
  }

  async notifyNewCourses(coursesAccepted: number, providerName: string) {
    if (coursesAccepted <= 0) return;

    // Find users with preference onNewCourses = true (or default true)
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { notificationPreference: { is: null } },
          { notificationPreference: { onNewCourses: true } },
        ],
      },
      select: { id: true },
    });

    const title = `🎓 New Courses Discovered!`;
    const message = `${coursesAccepted} new free course(s) added from ${providerName}.`;

    await Promise.all(
      users.map((u) =>
        this.createNotification(u.id, NotificationType.NEW_COURSES, title, message, {
          providerName,
          coursesAccepted,
        }),
      ),
    );
  }

  async notifyExpiringSoon() {
    // Find favorites expiring within 6 hours that haven't been notified yet
    const now = new Date();
    const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const expiringFavorites = await this.prisma.favorite.findMany({
      where: {
        course: {
          couponSources: {
            some: {
              isActive: true,
              expiresAt: {
                gte: now,
                lte: in6Hours,
              },
            },
          },
        },
      },
      include: {
        course: { select: { title: true } },
      },
    });

    for (const fav of expiringFavorites) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: fav.userId,
          type: NotificationType.EXPIRING_SOON,
          metadata: { path: ['courseId'], equals: fav.courseId } as any,
        },
      });

      if (!existing) {
        await this.createNotification(
          fav.userId,
          NotificationType.EXPIRING_SOON,
          `⏰ Course Expiring Soon!`,
          `"${fav.course?.title || 'A favorited course'}" will expire in less than 6 hours.`,
          { courseId: fav.courseId },
        );
      }
    }
  }

  async getPreferences(userId: string) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: { userId, onNewCourses: true, onExpiringSoon: true, browserPushEnabled: false },
      });
    }

    return pref;
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: { ...dto },
      create: { userId, ...dto },
    });
  }

  async savePushSubscription(userId: string, dto: PushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, keys: dto.keys },
      create: { userId, endpoint: dto.endpoint, keys: dto.keys },
    });
  }

  async removePushSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { success: true };
  }
}
