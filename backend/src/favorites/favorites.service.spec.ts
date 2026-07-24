import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesService } from './favorites.service';
import { FavoritesRepository } from './favorites.repository';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let repository: jest.Mocked<Partial<FavoritesRepository>>;

  beforeEach(async () => {
    repository = {
      findByUser: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: FavoritesRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('findByUser', () => {
    it('should return user favorites', async () => {
      const mockFavorites = [{ id: 'fav-1', courseId: 'c1' }];
      repository.findByUser!.mockResolvedValue(mockFavorites as any);

      const result = await service.findByUser('user-1');
      expect(result).toEqual([{ id: 'fav-1', courseId: 'c1', course: null }]);
    });
  });

  describe('addFavorite', () => {
    it('should create a favorite', async () => {
      const mockFav = { id: 'fav-1', userId: 'user-1', courseId: 'c1' };
      repository.create!.mockResolvedValue(mockFav as any);

      const result = await service.addFavorite('user-1', 'c1');
      expect(result).toEqual(mockFav);
      expect(repository.create).toHaveBeenCalledWith('user-1', 'c1');
    });
  });

  describe('removeFavorite', () => {
    it('should delete a favorite', async () => {
      repository.delete!.mockResolvedValue(undefined);

      await service.removeFavorite('user-1', 'c1');
      expect(repository.delete).toHaveBeenCalledWith('user-1', 'c1');
    });
  });

  describe('isFavorite', () => {
    it('should return true when favorite exists', async () => {
      repository.exists!.mockResolvedValue(true);

      const result = await service.isFavorite('user-1', 'c1');
      expect(result).toBe(true);
    });

    it('should return false when favorite does not exist', async () => {
      repository.exists!.mockResolvedValue(false);

      const result = await service.isFavorite('user-1', 'c2');
      expect(result).toBe(false);
    });
  });
});
