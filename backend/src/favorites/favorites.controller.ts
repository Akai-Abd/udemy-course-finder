import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto';
import { CurrentUser } from '../common/decorators';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  @ApiResponse({ status: 200, description: 'List of favorited courses' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.favoritesService.findByUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add course to favorites' })
  @ApiResponse({ status: 201, description: 'Favorite added' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFavoriteDto,
  ) {
    return this.favoritesService.addFavorite(userId, dto.courseId);
  }

  @Delete(':courseId')
  @ApiOperation({ summary: 'Remove course from favorites' })
  @ApiResponse({ status: 200, description: 'Favorite removed' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('courseId') courseId: string,
  ) {
    await this.favoritesService.removeFavorite(userId, courseId);
    return { message: 'Favorite removed' };
  }
}
