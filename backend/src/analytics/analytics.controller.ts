import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TimeSeriesQueryDto } from './dto/time-series-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview' })
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Get time-series analytics data' })
  async getTimeSeries(@Query() query: TimeSeriesQueryDto) {
    return this.analyticsService.getTimeSeries(query.days);
  }
}
