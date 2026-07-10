import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TokenBlacklistService } from './token-blacklist.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let tokenBlacklist: jest.Mocked<Partial<TokenBlacklistService>>;

  const mockUser = {
    id: 'user-1',
    email: 'admin@localhost',
    passwordHash: '$argon2hash',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      decode: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('15m'),
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    tokenBlacklist = {
      blacklist: jest.fn().mockResolvedValue(undefined),
      isBlacklisted: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: TokenBlacklistService, useValue: tokenBlacklist },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@localhost',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(usersService.findByEmail).toHaveBeenCalledWith('admin@localhost');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      usersService.findByEmail!.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'admin@localhost', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for a valid user', async () => {
      usersService.findById!.mockResolvedValue(mockUser as any);

      const result = await service.refreshTokens('user-1', 'old-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw ForbiddenException when user not found', async () => {
      usersService.findById!.mockResolvedValue(null);

      await expect(
        service.refreshTokens('nonexistent', 'token'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should blacklist the token JTI', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 900; // 15 min from now
      jwtService.decode!.mockReturnValue({
        jti: 'test-jti',
        exp: futureExp,
      });

      const result = await service.logout('valid-bearer-token');

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(tokenBlacklist.blacklist).toHaveBeenCalledWith(
        'test-jti',
        expect.any(Number),
      );
    });

    it('should succeed gracefully if token cannot be decoded', async () => {
      jwtService.decode!.mockReturnValue(null);

      const result = await service.logout('invalid-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is valid', async () => {
      usersService.findById!.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('$new-hash');

      const result = await service.changePassword(
        'user-1',
        'old-pass',
        'NewPass123',
      );

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user-1',
        '$new-hash',
      );
    });

    it('should throw BadRequestException for wrong current password', async () => {
      usersService.findById!.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user not found', async () => {
      usersService.findById!.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'old', 'new'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
