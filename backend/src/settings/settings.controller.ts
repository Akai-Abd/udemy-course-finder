import { Controller, Get, Body, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  @ApiOperation({ summary: 'Get app setting value by key' })
  @ApiResponse({ status: 200, description: 'Setting value' })
  async getSetting(@Param('key') key: string) {
    const value = await this.settingsService.getSetting(key);
    return { key, value };
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update app setting value by key' })
  @ApiResponse({ status: 200, description: 'Updated setting value' })
  async updateSetting(
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    const updatedValue = await this.settingsService.updateSetting(key, value);
    return { key, value: updatedValue };
  }
}
