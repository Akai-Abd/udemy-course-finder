import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { CoursesModule } from '../src/courses/courses.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { RedisCacheModule } from '../src/common/cache/redis-cache.module';
import { ConfigModule } from '../src/config/config.module';
import { RedisCacheService } from '../src/common/cache/redis-cache.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';

describe('Courses (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  const mockPrisma = {
    course: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    favorite: { count: jest.fn().mockResolvedValue(0) },
    provider: { count: jest.fn().mockResolvedValue(9) },
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn(),
  };

  const mockBlacklist = {
    isBlacklisted: jest.fn().mockResolvedValue(false),
    onModuleInit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        RedisCacheModule,
        AuthModule,
        CoursesModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisCacheService)
      .useValue(mockCache)
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

  describe('GET /courses', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/courses').expect(401);
    });

    it('should return paginated courses', () => {
      return request(app.getHttpServer())
        .get('/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('GET /courses/stats', () => {
    it('should return dashboard stats', () => {
      return request(app.getHttpServer())
        .get('/courses/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('GET /courses/:id', () => {
    it('should return 404 for nonexistent course', () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/courses/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
