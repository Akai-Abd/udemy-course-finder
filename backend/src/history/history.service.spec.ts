import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { HistoryRepository } from './history.repository';
import { HistoryAction } from '@prisma/client';

describe('HistoryService', () => {
  let service: HistoryService;
  let repository: jest.Mocked<Partial<HistoryRepository>>;

  beforeEach(async () => {
    repository = {
      findByUser: jest.fn(),
      create: jest.fn(),
      deleteAllByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: HistoryRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  describe('findByUser', () => {
    it('should return paginated history', async () => {
      const mockResult = { data: [], total: 0 };
      repository.findByUser!.mockResolvedValue(mockResult);

      const result = await service.findByUser('user-1', 1, 20);

      expect(result).toEqual(mockResult);
      expect(repository.findByUser).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('recordAction', () => {
    it('should create a history entry', async () => {
      const mockEntry = {
        id: 'h-1',
        userId: 'user-1',
        courseId: 'c-1',
        action: 'CLICKED' as HistoryAction,
      };
      repository.create!.mockResolvedValue(mockEntry as any);

      const result = await service.recordAction('user-1', 'c-1', 'CLICKED');

      expect(result).toEqual(mockEntry);
      expect(repository.create).toHaveBeenCalledWith(
        'user-1',
        'c-1',
        'CLICKED',
      );
    });
  });

  describe('clearHistory', () => {
    it('should delete all history for a user', async () => {
      repository.deleteAllByUser!.mockResolvedValue(5);

      const result = await service.clearHistory('user-1');

      expect(result).toEqual({ deleted: 5 });
      expect(repository.deleteAllByUser).toHaveBeenCalledWith('user-1');
    });
  });
});
