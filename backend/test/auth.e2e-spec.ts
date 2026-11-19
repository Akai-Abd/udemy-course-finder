import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ConfigModule } from '../src/config/config.module';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';

import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockBlacklist = {
    blacklist: jest.fn().mockResolvedValue(undefined),
    isBlacklisted: jest.fn().mockResolvedValue(false),
    onModuleInit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AuthModule, UsersModule],
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

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'Password123' })
        .expect(400);
    });

    it('should reject missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@localhost' })
        .expect(400);
    });

    it('should reject short password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@localhost', password: '12345' })
        .expect(400);
    });
  });

  describe('PATCH /auth/password', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .patch('/auth/password')
        .send({ currentPassword: 'old', newPassword: 'NewPass123' })
        .expect(401);
    });

    it('should reject weak new password', async () => {
      const token = jwtService.sign(
        {
          sub: 'user-1',
          email: 'test@test.com',
          role: 'USER',
          jti: 'test-jti',
        },
        { secret: process.env.JWT_SECRET || 'test-secret' },
      );

      return request(app.getHttpServer())
        .patch('/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old', newPassword: 'weak' })
        .expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
