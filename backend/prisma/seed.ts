import { PrismaClient, Role, ProviderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
let prisma: PrismaClient;

if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace(/^file:/, '');
  const adapter = new PrismaBetterSqlite3({ url: filePath });
  prisma = new PrismaClient({ adapter });
} else {
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

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

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const lastRun = new Date(Date.now() - (i + 1) * 15 * 60 * 1000); // 15 mins apart

    const providerRecord = await prisma.provider.upsert({
      where: { name: p.name },
      update: {
        baseUrl: p.baseUrl,
        lastStatus: ProviderStatus.SUCCESS,
        lastRunAt: lastRun,
      },
      create: {
        name: p.name,
        baseUrl: p.baseUrl,
        isEnabled: true,
        timeoutMs: 30000,
        lastStatus: ProviderStatus.SUCCESS,
        lastRunAt: lastRun,
      },
    });

    await prisma.log.create({
      data: {
        providerId: providerRecord.id,
        status: 'SUCCESS',
        message: `Scraped ${10 + i * 2} coupon links successfully.`,
        coursesFound: 15 + i * 2,
        coursesAccepted: 10 + i,
        coursesRejected: 5 + i,
        startedAt: lastRun,
        finishedAt: new Date(lastRun.getTime() + 4500),
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

  // ───────────── Seed Sample Courses ─────────────
  const sampleCourses = [
    {
      title: 'Complete Next.js 16 & React 19 Web Development Bootcamp',
      description: 'Master Next.js App Router, Server Actions, Turbopack, TailwindCSS, and build 5 real-world full-stack web applications from scratch.',
      udemyUrl: 'https://www.udemy.com/course/nextjs-react-bootcamp/',
      udemyCourseId: 'nextjs-bootcamp-2026',
      categorySlug: 'development',
      instructor: 'Dr. Angela Yu',
      rating: 4.9,
      priceOriginal: 94.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=600&q=80',
      providerName: 'Real Discount',
      couponUrl: 'https://www.real.discount/offer/nextjs-bootcamp-free',
    },
    {
      title: 'Python for Data Science & Machine Learning Masterclass',
      description: 'Learn NumPy, Pandas, Matplotlib, Seaborn, Scikit-Learn, TensorFlow, and SQL for Data Analysis with hands-on projects.',
      udemyUrl: 'https://www.udemy.com/course/python-data-science-machine-learning/',
      udemyCourseId: 'python-data-science-2026',
      categorySlug: 'development',
      instructor: 'Jose Portilla',
      rating: 4.8,
      priceOriginal: 89.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
      providerName: 'Courson',
      couponUrl: 'https://courson.xyz/python-ds-coupon',
    },
    {
      title: 'AWS Certified Solutions Architect Associate (SAA-C03) Prep',
      description: 'Pass the AWS Solutions Architect Associate exam with hands-on labs, practice tests, architectural diagrams, and deep dives into S3, EC2, Lambda & VPC.',
      udemyUrl: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate/',
      udemyCourseId: 'aws-saa-c03-2026',
      categorySlug: 'it-software',
      instructor: 'Stephane Maarek',
      rating: 4.9,
      priceOriginal: 99.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
      providerName: 'DiscUdemy',
      couponUrl: 'https://www.discudemy.com/aws-solutions-architect',
    },
    {
      title: 'UI/UX Design Essentials: Figma, User Research & Prototyping',
      description: 'Become a professional UI/UX designer. Learn Figma, wireframing, interactive prototyping, design systems, usability testing, and mobile app design.',
      udemyUrl: 'https://www.udemy.com/course/ui-ux-design-figma-essentials/',
      udemyCourseId: 'ui-ux-figma-2026',
      categorySlug: 'design',
      instructor: 'Daniel Walter Scott',
      rating: 4.7,
      priceOriginal: 84.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=600&q=80',
      providerName: 'E-next',
      couponUrl: 'https://www.e-next.in/figma-uiux-free',
    },
    {
      title: 'Docker & Kubernetes: The Complete Developer Guide',
      description: 'Build, test, and deploy Docker container applications with Kubernetes, Helm, CI/CD pipelines, and microservices architecture.',
      udemyUrl: 'https://www.udemy.com/course/docker-kubernetes-developer-guide/',
      udemyCourseId: 'docker-k8s-guide-2026',
      categorySlug: 'it-software',
      instructor: 'Stephen Grider',
      rating: 4.8,
      priceOriginal: 94.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=600&q=80',
      providerName: 'Udemy Freebies',
      couponUrl: 'https://www.udemyfreebies.com/docker-k8s-free',
    },
    {
      title: 'Digital Marketing Strategy 2026: SEO, Social Media & Ads',
      description: 'Complete digital marketing course: Search Engine Optimization (SEO), Google Ads, Meta Ads, Email Marketing, Copywriting & Content Strategy.',
      udemyUrl: 'https://www.udemy.com/course/digital-marketing-strategy-masterclass/',
      udemyCourseId: 'digital-marketing-2026',
      categorySlug: 'marketing',
      instructor: 'Rob Percival',
      rating: 4.6,
      priceOriginal: 74.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
      providerName: 'Coupon Scorpion',
      couponUrl: 'https://couponscorpion.com/digital-marketing-deal',
    },
    {
      title: 'Financial Analysis, Valuation & Financial Modeling in Excel',
      description: 'Build DCF models, LBO models, financial statements analysis, budgeting, and corporate finance decision-making tools in Microsoft Excel.',
      udemyUrl: 'https://www.udemy.com/course/financial-modeling-excel-valuation/',
      udemyCourseId: 'financial-modeling-2026',
      categorySlug: 'finance-accounting',
      instructor: '365 Careers',
      rating: 4.8,
      priceOriginal: 89.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      providerName: 'CourseJoiner',
      couponUrl: 'https://coursejoiner.com/financial-modeling',
    },
    {
      title: 'Ethical Hacking & Penetration Testing Complete Course',
      description: 'Learn ethical hacking, Wi-Fi cracking, Nmap scanning, Metasploit, web application security, SQL injection, and privilege escalation.',
      udemyUrl: 'https://www.udemy.com/course/ethical-hacking-penetration-testing/',
      udemyCourseId: 'ethical-hacking-2026',
      categorySlug: 'it-software',
      instructor: 'Zaid Sabih',
      rating: 4.9,
      priceOriginal: 99.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
      providerName: 'FreeWebCart',
      couponUrl: 'https://www.freewebcart.com/ethical-hacking',
    },
    {
      title: 'Node.js, Express, MongoDB & TypeScript Microservices',
      description: 'Build scalable REST & GraphQL APIs using Node.js, TypeScript, Express, MongoDB, Redis caching, and JWT authentication.',
      udemyUrl: 'https://www.udemy.com/course/nodejs-express-mongodb-typescript/',
      udemyCourseId: 'nodejs-express-2026',
      categorySlug: 'development',
      instructor: 'Maximilian Schwarzmüller',
      rating: 4.8,
      priceOriginal: 84.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?auto=format&fit=crop&w=600&q=80',
      providerName: 'Freebies Global',
      couponUrl: 'https://freebiesglobal.com/nodejs-microservices',
    },
    {
      title: 'Flutter & Dart: The Complete Cross-Platform iOS & Android Guide',
      description: 'Build beautiful native mobile apps for iOS and Android using Flutter, Dart 3, Provider, Riverpod, and Firebase backend integration.',
      udemyUrl: 'https://www.udemy.com/course/flutter-dart-complete-guide/',
      udemyCourseId: 'flutter-dart-2026',
      categorySlug: 'development',
      instructor: 'Academind by Maximilian Schwarzmüller',
      rating: 4.8,
      priceOriginal: 89.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=80',
      providerName: 'iDownloadCoupons',
      couponUrl: 'https://idownloadcoupon.com/flutter-course',
    },
  ];

  for (const item of sampleCourses) {
    const category = await prisma.category.findUnique({
      where: { slug: item.categorySlug },
    });
    const provider = await prisma.provider.findUnique({
      where: { name: item.providerName },
    });

    if (category && provider) {
      const course = await prisma.course.upsert({
        where: { udemyCourseId: item.udemyCourseId },
        update: {
          title: item.title,
          description: item.description,
          rating: item.rating,
          thumbnailUrl: item.thumbnailUrl,
        },
        create: {
          title: item.title,
          description: item.description,
          udemyUrl: item.udemyUrl,
          udemyCourseId: item.udemyCourseId,
          categoryId: category.id,
          language: 'English',
          thumbnailUrl: item.thumbnailUrl,
          rating: item.rating,
          instructor: item.instructor,
          priceOriginal: item.priceOriginal,
        },
      });

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 5);

      await prisma.couponSource.upsert({
        where: {
          unique_coupon_per_provider: {
            courseId: course.id,
            providerId: provider.id,
          },
        },
        update: {
          expiresAt: expiryDate,
          isActive: true,
        },
        create: {
          courseId: course.id,
          providerId: provider.id,
          couponUrl: item.couponUrl,
          isFree: true,
          expiresAt: expiryDate,
          isActive: true,
        },
      });
    }
  }
  console.log(`✅ ${sampleCourses.length} sample courses and coupon sources seeded`);

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
