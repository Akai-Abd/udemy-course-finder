import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  async listAll(@CurrentUser('role') role: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    const users = await this.usersService.findAll();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  async updateRole(
    @CurrentUser('role') currentRole: string,
    @Param('id') id: string,
    @Body('role') newRole: 'ADMIN' | 'USER',
  ) {
    if (currentRole !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    const user = await this.usersService.updateRole(id, newRole);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      updatedAt: user.updatedAt,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  async deleteUser(
    @CurrentUser('role') currentRole: string,
    @CurrentUser('id') currentUserId: string,
    @Param('id') id: string,
  ) {
    if (currentRole !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (currentUserId === id) {
      throw new ForbiddenException('Cannot delete your own admin account');
    }
    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
