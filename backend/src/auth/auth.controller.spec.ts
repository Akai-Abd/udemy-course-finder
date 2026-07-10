import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
      }),
      refreshTokens: jest.fn().mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      }),
      logout: jest
        .fn()
        .mockResolvedValue({ message: 'Logged out successfully' }),
      changePassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password changed successfully' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should return tokens on login', async () => {
      const result = await controller.login({
        email: 'admin@localhost',
        password: 'pass',
      });

      expect(result).toEqual({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
      });
      expect(authService.login).toHaveBeenCalledWith({
        email: 'admin@localhost',
        password: 'pass',
      });
    });
  });

  describe('refresh', () => {
    it('should return new tokens', async () => {
      const result = await controller.refresh('user-1', {
        refreshToken: 'old-refresh',
      });

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });
  });

  describe('logout', () => {
    it('should extract bearer token and pass to service', async () => {
      const result = await controller.logout('Bearer some-jwt-token');

      expect(authService.logout).toHaveBeenCalledWith('some-jwt-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should handle missing authorization header', async () => {
      const result = await controller.logout(undefined as unknown as string);

      expect(authService.logout).toHaveBeenCalledWith('');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('changePassword', () => {
    it('should change password for authenticated user', async () => {
      const result = await controller.changePassword('user-1', {
        currentPassword: 'old',
        newPassword: 'NewPass123',
      });

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'old',
        'NewPass123',
      );
    });
  });
});
