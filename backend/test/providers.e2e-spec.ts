import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProvidersModule } from '../src/providers/providers.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '../src/config/config.module';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { JobsService } from '../src/jobs/jobs.service';

describe('Providers (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  const mockPrisma = {
    provider: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', name: 'Real Discount', isEnabled: true },
        ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'p1',
        name: 'Real Discount',
        isEnabled: true,
      }),
      update: jest.fn().mockResolvedValue({ id: 'p1', isEnabled: false }),
      count: jest.fn().mockResolvedValue(9),
    },
    log: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    },
  };

  const mockBlacklist = {
    isBlacklisted: jest.fn().mockResolvedValue(false),
    onModuleInit: jest.fn(),
  };

  const mockJobsService = {
    enqueueScrapeJob: jest.fn().mockResolvedValue('job-1'),
    enqueueTestJob: jest.fn().mockResolvedValue('test-job-1'),
    retryJob: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Retried' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ProvidersModule,
        JwtModule.register({ secret: 'test-secret' }),
      ],
      providers: [
        TokenBlacklistService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(TokenBlacklistService)
      .useValue(mockBlacklist)
      .overrideProvider(JobsService)
      .useValue(mockJobsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: 'user-1',
      email: 'test@test.com',
      role: 'ADMIN',
      jti: 'jti-1',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /providers', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/providers').expect(401);
    });

    it('should return providers list', () => {
      return request(app.getHttpServer())
        .get('/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('PATCH /providers/:id', () => {
    it('should update provider', () => {
      return request(app.getHttpServer())
        .patch('/providers/p1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isEnabled: false })
        .expect(200);
    });
  });

  describe('POST /providers/scrape', () => {
    it('should trigger scrape', () => {
      return request(app.getHttpServer())
        .post('/providers/scrape')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);
    });
  });

  describe('GET /providers/:id/stats', () => {
    it('should return provider stats', () => {
      return request(app.getHttpServer())
        .get('/providers/p1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});
