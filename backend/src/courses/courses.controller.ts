import { Controller, Get, Post, Param, Query, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { ListCoursesDto, SearchCoursesDto } from './dto';
import { CurrentUser } from '../common/decorators';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List courses (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated course list' })
  async findAll(@Query() dto: ListCoursesDto) {
    return this.coursesService.findAll(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Full-text search courses' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query() dto: SearchCoursesDto) {
    return this.coursesService.search(dto);
  }

  @Get('search/semantic')
  @ApiOperation({ summary: 'Semantic vector-based search courses' })
  @ApiResponse({ status: 200, description: 'Semantic search results' })
  async semanticSearch(@Query() dto: SearchCoursesDto) {
    return this.coursesService.semanticSearch(dto);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized course recommendations' })
  @ApiResponse({ status: 200, description: 'List of recommended courses' })
  async getRecommendations(@CurrentUser('id') userId: string) {
    return this.coursesService.getRecommendations(userId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export courses (CSV or JSON)' })
  async exportCourses(
    @Query('format') format: 'csv' | 'json',
    @Query('type') type: 'all' | 'favorites',
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.coursesService.exportCourses(
      format || 'csv',
      type || 'all',
      userId,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return result.data;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard course statistics' })
  @ApiResponse({ status: 200, description: 'Course statistics' })
  async getStats(@Request() req: { user?: { id: string } }) {
    return this.coursesService.getDashboardStats(req.user?.id);
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Get semantically similar courses' })
  @ApiResponse({ status: 200, description: 'List of similar courses' })
  async getSimilar(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.coursesService.getSimilarCourses(id, limit ? Number(limit) : 4);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single course by ID' })
  @ApiResponse({ status: 200, description: 'Course detail' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findById(@Param('id') id: string) {
    return this.coursesService.findById(id);
  }

  @Post(':id/report-expired')
  @ApiOperation({ summary: 'Report a course coupon as expired' })
  @ApiResponse({ status: 200, description: 'Course coupon marked as expired' })
  async reportExpired(@Param('id') id: string) {
    return this.coursesService.reportExpired(id);
  }
}
