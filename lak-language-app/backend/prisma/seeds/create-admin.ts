import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (!process.argv[2] || !process.argv[3]) {
    console.error('Usage: npm run create-admin -- <email> <password>');
    process.exit(1);
  }

  const [email, password] = process.argv.slice(2);

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Invalid email format');
    process.exit(1);
  }

  // Validate password length
  if (password.length < 6) {
    console.error('Password must be at least 6 characters long');
    process.exit(1);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create or update admin user
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      level: 1,
      xp: 0,
    },
  });

  console.log(`✅ Admin user created/updated: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
