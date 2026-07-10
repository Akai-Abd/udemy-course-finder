import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Partial<UsersRepository>>;

  const mockUser = {
    id: 'user-1',
    email: 'admin@localhost',
    passwordHash: '$hash',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      repository.findByEmail!.mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('admin@localhost');
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findByEmail!.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      repository.findById!.mockResolvedValue(mockUser as any);

      const result = await service.findById('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findById!.mockResolvedValue(null);

      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should delegate to repository', async () => {
      repository.updatePassword!.mockResolvedValue(undefined);

      await service.updatePassword('user-1', '$new-hash');
      expect(repository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        '$new-hash',
      );
    });
  });
});
