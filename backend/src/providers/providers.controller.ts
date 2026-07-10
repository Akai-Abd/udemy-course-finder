import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProvidersService } from './providers.service';
import { UpdateProviderDto, TriggerScrapeDto } from './dto';

@ApiTags('Providers')
@ApiBearerAuth()
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'List all scraper sources with status' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  async findAll() {
    return this.providersService.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update provider (enable/disable, timeout)' })
  @ApiResponse({ status: 200, description: 'Updated provider' })
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  @Post('scrape')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Trigger a manual scrape' })
  @ApiResponse({ status: 200, description: 'Scrape job enqueued' })
  @ApiResponse({ status: 429, description: 'Too many scrape requests' })
  async triggerScrape(@Body() dto: TriggerScrapeDto) {
    return this.providersService.triggerScrape(dto.providerId);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test provider connectivity' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async test(@Param('id') id: string) {
    return this.providersService.testProvider(id);
  }

  @Post(':id/retry')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Retry failed scrape job' })
  @ApiResponse({ status: 200, description: 'Retry enqueued' })
  @ApiResponse({ status: 429, description: 'Too many retry requests' })
  async retry(@Param('id') id: string) {
    return this.providersService.retryProvider(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get provider run logs' })
  @ApiResponse({ status: 200, description: 'Paginated logs' })
  async getLogs(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.providersService.getLogs(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get provider aggregate stats' })
  @ApiResponse({ status: 200, description: 'Provider statistics' })
  async getStats(@Param('id') id: string) {
    return this.providersService.getStats(id);
  }
}
