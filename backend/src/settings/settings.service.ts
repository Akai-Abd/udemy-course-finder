import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSetting(key: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });
    return setting ? setting.value : '';
  }

  async updateSetting(key: string, value: string): Promise<string> {
    const setting = await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return setting.value;
  }
}
