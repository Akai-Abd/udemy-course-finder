import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { NotificationsModule } from '../notifications/notifications.module';

const isRedisDisabled = process.env.ENABLE_REDIS === 'false';

const mockQueue = {
  add: async () => ({ id: 'standalone-job-id' }),
  getJob: async () => null,
  getRepeatableJobs: async () => [],
  removeRepeatableByKey: async () => {},
  getWaitingCount: async () => 0,
  getActiveCount: async () => 0,
  getCompletedCount: async () => 0,
  getFailedCount: async () => 0,
  getDelayedCount: async () => 0,
  on: () => {},
};

@Module({
  imports: [
    NotificationsModule,
    ...(isRedisDisabled
      ? []
      : [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              connection: {
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: configService.get<number>('REDIS_PORT', 6379),
                maxRetriesPerRequest: null,
                enableOfflineQueue: false,
                retryStrategy: () => null,
              },
            }),
          }),
          BullModule.registerQueue({
            name: 'scrape-queue',
          }),
        ]),
  ],
  providers: [
    JobsService,
    ...(isRedisDisabled
      ? [
          {
            provide: getQueueToken('scrape-queue'),
            useValue: mockQueue,
          },
        ]
      : []),
  ],
  exports: [JobsService],
})
export class JobsModule {}
