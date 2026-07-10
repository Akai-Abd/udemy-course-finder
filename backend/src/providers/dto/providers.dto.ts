import { IsOptional, IsBoolean, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProviderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  timeoutMs?: number;
}

export class TriggerScrapeDto {
  @ApiPropertyOptional({
    description: 'Specific provider ID to scrape (omit for all)',
  })
  @IsOptional()
  @IsString()
  providerId?: string;
}
