import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://udemy_finder:change_me_in_production@localhost:5432/udemy_finder?schema=public',
  },
  migrations: {
    seed: 'node dist/prisma/seed.js',
  },
  migrate: {
    async url() {
      return process.env.DATABASE_URL ?? 'postgresql://udemy_finder:change_me_in_production@localhost:5432/udemy_finder?schema=public';
    },
  },
});
