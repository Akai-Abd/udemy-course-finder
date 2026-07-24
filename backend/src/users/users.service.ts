import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async create(email: string, passwordHash: string, role: any = 'USER'): Promise<User> {
    return this.usersRepository.create(email, passwordHash, role);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePassword(userId, passwordHash);
  }

  async updateRole(userId: string, role: any): Promise<User> {
    return this.usersRepository.updateRole(userId, role);
  }

  async delete(userId: string): Promise<void> {
    await this.usersRepository.delete(userId);
  }
}

