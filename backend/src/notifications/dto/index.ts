import { IsBoolean, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onNewCourses?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onExpiringSoon?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  browserPushEnabled?: boolean;
}

export class PushSubscriptionDto {
  @ApiProperty()
  @IsString()
  endpoint!: string;

  @ApiProperty()
  @IsObject()
  keys!: Record<string, string>;
}
