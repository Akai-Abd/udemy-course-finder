import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { CreateHistoryDto } from './dto';
import { CurrentUser } from '../common/decorators';

@ApiTags('History')
@ApiBearerAuth()
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get user history' })
  @ApiResponse({ status: 200, description: 'Paginated history list' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.historyService.findByUser(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Record a history event (view/click)' })
  @ApiResponse({ status: 201, description: 'History event recorded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHistoryDto,
  ) {
    return this.historyService.recordAction(userId, dto.courseId, dto.action);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all history for the authenticated user' })
  @ApiResponse({ status: 200, description: 'History cleared' })
  async clear(@CurrentUser('id') userId: string) {
    return this.historyService.clearHistory(userId);
  }
}
