import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'OldPassword123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description:
      'New password (min 8 characters, must include uppercase, lowercase, and number)',
    example: 'NewPassword456!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
