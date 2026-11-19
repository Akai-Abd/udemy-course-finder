import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FavoritesModule } from '../src/favorites/favorites.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ConfigModule } from '../src/config/config.module';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';

describe('Favorites (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  const mockPrisma = {
    favorite: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'fav-1', userId: 'user-1', courseId: 'c-1' }),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  };

  const mockBlacklist = {
    isBlacklisted: jest.fn().mockResolvedValue(false),
    onModuleInit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AuthModule, FavoritesModule],
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

  describe('GET /favorites', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/favorites').expect(401);
    });

    it('should return favorites for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('POST /favorites', () => {
    it('should reject without courseId', () => {
      return request(app.getHttpServer())
        .post('/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });
});
