import path from 'node:path';
import { defineConfig } from 'prisma/config';

const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const isSqlite = dbUrl.startsWith('file:');

export default defineConfig({
  schema: path.join(__dirname, 'prisma', isSqlite ? 'schema.sqlite.prisma' : 'schema.prisma'),
  datasource: {
    url: dbUrl,
  },
  migrations: {
    seed: 'node dist/prisma/seed.js',
  },
  migrate: {
    async url() {
      return dbUrl;
    },
  },
});
