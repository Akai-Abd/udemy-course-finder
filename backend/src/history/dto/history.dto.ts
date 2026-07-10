import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { HistoryAction } from '@prisma/client';

export class CreateHistoryDto {
  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiProperty({ enum: HistoryAction })
  @IsEnum(HistoryAction)
  action!: HistoryAction;
}
