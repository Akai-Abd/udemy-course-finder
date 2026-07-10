import { Injectable } from '@nestjs/common';
import { FavoritesRepository } from './favorites.repository';
import { mapCourseToResponse } from '../courses/courses.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly favoritesRepository: FavoritesRepository) {}

  async findByUser(userId: string) {
    const favorites = await this.favoritesRepository.findByUser(userId);
    return favorites.map((fav) => ({
      ...fav,
      course: mapCourseToResponse(fav.course),
    }));
  }

  async addFavorite(userId: string, courseId: string) {
    return this.favoritesRepository.create(userId, courseId);
  }

  async removeFavorite(userId: string, courseId: string) {
    return this.favoritesRepository.delete(userId, courseId);
  }

  async isFavorite(userId: string, courseId: string): Promise<boolean> {
    return this.favoritesRepository.exists(userId, courseId);
  }
}
