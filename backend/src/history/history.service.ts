import { Injectable } from '@nestjs/common';
import { HistoryAction } from '@prisma/client';
import { HistoryRepository } from './history.repository';
import { mapCourseToResponse } from '../courses/courses.service';

@Injectable()
export class HistoryService {
  constructor(private readonly historyRepository: HistoryRepository) {}

  async findByUser(userId: string, page = 1, limit = 20) {
    const result = await this.historyRepository.findByUser(userId, page, limit);
    return {
      ...result,
      data: result.data.map((entry) => ({
        ...entry,
        course: mapCourseToResponse(entry.course),
      })),
    };
  }

  async recordAction(userId: string, courseId: string, action: HistoryAction) {
    return this.historyRepository.create(userId, courseId, action);
  }

  async clearHistory(userId: string): Promise<{ deleted: number }> {
    const count = await this.historyRepository.deleteAllByUser(userId);
    return { deleted: count };
  }
}
