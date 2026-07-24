import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL || 'postgresql://udemy_finder:change_me_in_production@localhost:5432/udemy_finder?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ───────────── Seed Admin User ─────────────
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost.local';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`⏭️  Admin user already exists: ${adminEmail}`);
  }

  // ───────────── Seed Providers (10 Sources) ─────────────
  const providers = [
    { name: 'Real Discount', baseUrl: 'https://www.real.discount' },
    { name: 'Courson', baseUrl: 'https://courson.xyz' },
    { name: 'E-next', baseUrl: 'https://www.e-next.in' },
    { name: 'iDownloadCoupons', baseUrl: 'https://idownloadcoupon.com' },
    { name: 'DiscUdemy', baseUrl: 'https://www.discudemy.com' },
    { name: 'Udemy Freebies', baseUrl: 'https://www.udemyfreebies.com' },
    { name: 'Coupon Scorpion', baseUrl: 'https://couponscorpion.com' },
    { name: 'CourseJoiner', baseUrl: 'https://coursejoiner.com' },
    { name: 'FreeWebCart', baseUrl: 'https://www.freewebcart.com' },
    { name: 'Freebies Global', baseUrl: 'https://freebiesglobal.com' },
  ];

  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { name: provider.name },
      update: { baseUrl: provider.baseUrl },
      create: {
        name: provider.name,
        baseUrl: provider.baseUrl,
        isEnabled: true,
        timeoutMs: 30000,
      },
    });
  }

  // Delete deprecated providers
  await prisma.provider.deleteMany({
    where: {
      name: {
        in: ['CourseVania', 'Course Vania', 'Course Joiner', 'Tutorial Bar'], // clean up any typos or deprecated entries
      },
    },
  });
  console.log(`✅ ${providers.length} providers seeded and deprecated ones cleaned up`);

  // ───────────── Seed Categories ─────────────
  const categories = [
    { name: 'Development', slug: 'development' },
    { name: 'Business', slug: 'business' },
    { name: 'Finance & Accounting', slug: 'finance-accounting' },
    { name: 'IT & Software', slug: 'it-software' },
    { name: 'Office Productivity', slug: 'office-productivity' },
    { name: 'Personal Development', slug: 'personal-development' },
    { name: 'Design', slug: 'design' },
    { name: 'Marketing', slug: 'marketing' },
    { name: 'Lifestyle', slug: 'lifestyle' },
    { name: 'Photography & Video', slug: 'photography-video' },
    { name: 'Health & Fitness', slug: 'health-fitness' },
    { name: 'Music', slug: 'music' },
    { name: 'Teaching & Academics', slug: 'teaching-academics' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ───────────── Seed Default Settings ─────────────
  const settings = [
    { key: 'scrape_interval_minutes', value: '30' },
    { key: 'max_course_age_days', value: '7' },
    { key: 'auto_purge_expired', value: 'true' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`✅ ${settings.length} settings seeded`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
