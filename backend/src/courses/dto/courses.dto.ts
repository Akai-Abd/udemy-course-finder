import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum CourseSortBy {
  NEWEST = 'newest',
  EXPIRING = 'expiring',
  EXPIRING_SOON = 'expiring_soon',
  RATING = 'rating',
  TITLE = 'title',
  ALPHABETICAL = 'alphabetical',
}

export class ListCoursesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ enum: CourseSortBy, default: CourseSortBy.NEWEST })
  @IsOptional()
  @IsEnum(CourseSortBy)
  sortBy?: CourseSortBy = CourseSortBy.NEWEST;

  @ApiPropertyOptional({ enum: CourseSortBy })
  @IsOptional()
  @IsEnum(CourseSortBy)
  sort?: CourseSortBy;

  @ApiPropertyOptional({
    description: 'Filter by expiry: active, expired, all',
  })
  @IsOptional()
  @IsString()
  expiryStatus?: string = 'active';

  @ApiPropertyOptional({
    description: 'Filter by language: English, all, etc.',
  })
  @IsOptional()
  @IsString()
  language?: string;
}

export class SearchCoursesDto extends ListCoursesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
