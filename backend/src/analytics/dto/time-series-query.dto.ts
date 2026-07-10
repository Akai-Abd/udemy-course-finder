import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TimeSeriesQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to look back (7–365)',
    default: 30,
    minimum: 7,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number = 30;
}
