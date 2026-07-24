import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';
import { UpdateNotificationPreferencesDto, PushSubscriptionDto } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List user notifications' })
  async list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.list(userId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
  async markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(id, userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }

  @Post('push-subscription')
  @ApiOperation({ summary: 'Save browser push subscription' })
  async savePushSubscription(
    @CurrentUser('id') userId: string,
    @Body() dto: PushSubscriptionDto,
  ) {
    return this.notificationsService.savePushSubscription(userId, dto);
  }

  @Delete('push-subscription')
  @ApiOperation({ summary: 'Remove browser push subscription' })
  async removePushSubscription(
    @CurrentUser('id') userId: string,
    @Body('endpoint') endpoint: string,
  ) {
    return this.notificationsService.removePushSubscription(userId, endpoint);
  }
}
