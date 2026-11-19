import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HistoryModule } from '../src/history/history.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ConfigModule } from '../src/config/config.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';

describe('History (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  const mockPrisma = {
    history: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'h-1',
        userId: 'user-1',
        courseId: 'c-1',
        action: 'CLICKED',
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };

  const mockBlacklist = {
    isBlacklisted: jest.fn().mockResolvedValue(false),
    onModuleInit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AuthModule, HistoryModule],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(TokenBlacklistService)
      .useValue(mockBlacklist)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const configService = moduleFixture.get<ConfigService>(ConfigService);
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign(
      {
        sub: 'user-1',
        email: 'test@test.com',
        role: 'USER',
        jti: 'jti-1',
      },
      { secret: configService.get<string>('JWT_SECRET') },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /history', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/history').expect(401);
    });

    it('should return history for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('DELETE /history', () => {
    it('should clear history for authenticated user', () => {
      return request(app.getHttpServer())
        .delete('/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});
