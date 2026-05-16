import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  // Users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const memberPassword = await bcrypt.hash('member123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'ceo@stallion.com' },
    update: {},
    create: {
      email: 'ceo@stallion.com',
      password: adminPassword,
      name: 'Ahmed Al-Rashid',
      role: 'ADMIN',
    },
  });

  const member1 = await prisma.user.upsert({
    where: { email: 'sara@stallion.com' },
    update: {},
    create: {
      email: 'sara@stallion.com',
      password: memberPassword,
      name: 'Sara Hassan',
      role: 'TEAM_MEMBER',
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'omar@stallion.com' },
    update: {},
    create: {
      email: 'omar@stallion.com',
      password: memberPassword,
      name: 'Omar Khalid',
      role: 'TEAM_MEMBER',
    },
  });

  const member3 = await prisma.user.upsert({
    where: { email: 'lina@stallion.com' },
    update: {},
    create: {
      email: 'lina@stallion.com',
      password: memberPassword,
      name: 'Lina Nasser',
      role: 'TEAM_MEMBER',
    },
  });

  console.log('✅ Users created');

  // Clients
  const client1 = await prisma.client.create({
    data: {
      name: 'Al-Faris Retail Group',
      service: 'SOCIAL_MEDIA_MANAGEMENT',
      monthlyFee: 4500,
      billingFrequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date('2024-01-15'),
      website: 'https://alfaris.com',
      contactPerson: 'Khalid Al-Faris',
      email: 'khalid@alfaris.com',
      phone: '+966501234567',
      notes: 'Key account — quarterly review required.',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'Noor Beauty Studio',
      service: 'SEO',
      monthlyFee: 2800,
      billingFrequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date('2024-03-01'),
      website: 'https://noorbeauty.com',
      contactPerson: 'Nadia Rahman',
      email: 'nadia@noorbeauty.com',
      phone: '+966509876543',
      notes: 'Focus on local SEO for Riyadh area.',
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: 'TechPeak Solutions',
      service: 'PPC_ADS',
      monthlyFee: 6000,
      billingFrequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date('2023-11-01'),
      website: 'https://techpeak.sa',
      contactPerson: 'Mohammed Saleh',
      email: 'msaleh@techpeak.sa',
      phone: '+966551234567',
      notes: 'Google + Meta ads. High-spend account.',
    },
  });

  const client4 = await prisma.client.create({
    data: {
      name: 'Saffron Restaurant Chain',
      service: 'FULL_SERVICE',
      monthlyFee: 9500,
      billingFrequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date('2023-08-15'),
      website: 'https://saffronksa.com',
      contactPerson: 'Fahad Al-Otaibi',
      email: 'fahad@saffronksa.com',
      phone: '+966501112233',
      notes: 'Full service — social, SEO, PPC, content.',
    },
  });

  await prisma.client.create({
    data: {
      name: 'Horizon Real Estate',
      service: 'CONTENT_CREATION',
      monthlyFee: 3200,
      billingFrequency: 'MONTHLY',
      status: 'PAUSED',
      startDate: new Date('2024-02-01'),
      website: 'https://horizonre.com',
      contactPerson: 'Yasmin Al-Zahra',
      email: 'yasmin@horizonre.com',
      phone: '+966503344556',
      notes: 'Paused pending new campaign strategy review.',
    },
  });

  console.log('✅ Clients created');

  // Payments - last 12 months
  const now = new Date();
  for (let month = 11; month >= 0; month--) {
    const payDate = new Date(now.getFullYear(), now.getMonth() - month, 5);

    for (const client of [client1, client2, client3, client4]) {
      const isCurrentMonth = month === 0;
      await prisma.payment.create({
        data: {
          clientId: client.id,
          amount: client.monthlyFee,
          date: payDate,
          method: 'BANK_TRANSFER',
          invoiceNumber: `INV-${client.name.substring(0, 3).toUpperCase()}-${payDate.getFullYear()}${String(payDate.getMonth() + 1).padStart(2, '0')}`,
          status: isCurrentMonth ? 'PENDING' : 'PAID',
          notes: `Monthly retainer — ${payDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        },
      });
    }
  }

  console.log('✅ Payments created');

  // Expenses
  const expenses = [
    { name: 'Office Rent', category: 'RENT', type: 'FIXED', amount: 8000, recurring: true },
    { name: 'Staff Salaries', category: 'SALARIES', type: 'FIXED', amount: 45000, recurring: true },
    { name: 'Adobe Creative Cloud', category: 'SOFTWARE_SUBSCRIPTIONS', type: 'FIXED', amount: 850, recurring: true },
    { name: 'HubSpot CRM', category: 'SOFTWARE_SUBSCRIPTIONS', type: 'FIXED', amount: 600, recurring: true },
    { name: 'Semrush', category: 'SOFTWARE_SUBSCRIPTIONS', type: 'FIXED', amount: 400, recurring: true },
    { name: 'Business Insurance', category: 'INSURANCE', type: 'FIXED', amount: 1200, recurring: true },
    { name: 'Meta Ads Client Budget', category: 'ADS_SPEND', type: 'VARIABLE', amount: 15000, recurring: false },
    { name: 'Google Ads Client Budget', category: 'ADS_SPEND', type: 'VARIABLE', amount: 12000, recurring: false },
    { name: 'Freelance Videographer', category: 'FREELANCERS', type: 'VARIABLE', amount: 3500, recurring: false },
    { name: 'New Camera Equipment', category: 'EQUIPMENT', type: 'VARIABLE', amount: 2200, recurring: false },
    { name: 'Client Meeting Travel', category: 'TRAVEL', type: 'VARIABLE', amount: 800, recurring: false },
    { name: 'Office Supplies', category: 'MISC', type: 'VARIABLE', amount: 350, recurring: false },
  ];

  for (let month = 5; month >= 0; month--) {
    const expDate = new Date(now.getFullYear(), now.getMonth() - month, 1);
    for (const exp of expenses) {
      await prisma.expense.create({
        data: {
          name: exp.name,
          category: exp.category as any,
          type: exp.type as any,
          amount: exp.amount + (Math.random() * 200 - 100),
          date: expDate,
          method: 'BANK_TRANSFER',
          recurring: exp.recurring,
        },
      });
    }
  }

  console.log('✅ Expenses created');

  // Leads
  const lead1 = await prisma.lead.create({
    data: {
      name: 'Hassan Al-Mutairi',
      company: 'Gulf Logistics Co',
      email: 'hassan@gulflg.com',
      phone: '+966505678901',
      service: 'SEO',
      expectedValue: 3500,
      source: 'REFERRAL',
      stage: 'WARMED',
      assignedToId: member1.id,
      notes: 'Referred by Saffron Restaurant. Very interested in SEO package.',
      followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.lead.create({
    data: {
      name: 'Rania Abdulaziz',
      company: 'Bloom Boutique',
      email: 'rania@bloomboutique.sa',
      phone: '+966509988776',
      service: 'SOCIAL_MEDIA_MANAGEMENT',
      expectedValue: 2500,
      source: 'SOCIAL_MEDIA',
      stage: 'NEW',
      assignedToId: member2.id,
      notes: 'Found us via Instagram. Wants a demo.',
      followUpDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.lead.create({
    data: {
      name: 'Faisal Bin Turki',
      company: 'Turki Motors',
      email: 'faisal@turkimotors.com',
      phone: '+966501239876',
      service: 'PPC_ADS',
      expectedValue: 7500,
      source: 'COLD_OUTREACH',
      stage: 'CLOSED_WON',
      assignedToId: admin.id,
      notes: 'Converted. Starting next month.',
    },
  });

  await prisma.lead.create({
    data: {
      name: 'Dina Al-Harbi',
      company: 'Harbi Law Firm',
      email: 'dina@harbilaw.sa',
      phone: '+966503456789',
      service: 'WEB_DESIGN',
      expectedValue: 12000,
      source: 'WEBSITE',
      stage: 'CLOSED_LOST',
      assignedToId: member3.id,
      notes: 'Went with a competitor due to pricing.',
    },
  });

  await prisma.lead.create({
    data: {
      name: 'Saad Al-Qahtani',
      company: 'Qahtani Pharmaceuticals',
      email: 'saad@qahtanipharma.com',
      phone: '+966507654321',
      service: 'FULL_SERVICE',
      expectedValue: 15000,
      source: 'EVENT',
      stage: 'NEW',
      assignedToId: admin.id,
      notes: 'Met at Marketing Summit. Very high potential.',
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.leadActivity.createMany({
    data: [
      { leadId: lead1.id, note: 'Initial discovery call completed — 45 mins. Strong fit for SEO package.', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { leadId: lead1.id, note: 'Sent proposal PDF. Awaiting review.', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  });

  console.log('✅ Leads created');

  // Tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Prepare Q2 Social Media Calendar',
        description: 'Create content calendar for Al-Faris Retail for Q2 2025',
        assignedToId: member1.id,
        clientId: client1.id,
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        tags: ['content', 'planning'],
      },
      {
        title: 'Monthly SEO Audit — Noor Beauty',
        description: 'Run full technical SEO audit and keyword ranking report',
        assignedToId: member2.id,
        clientId: client2.id,
        priority: 'MEDIUM',
        status: 'TODO',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        tags: ['seo', 'reporting'],
      },
      {
        title: 'TechPeak Google Ads Optimization',
        description: 'Review and optimize campaign performance. Adjust bidding strategies.',
        assignedToId: member3.id,
        clientId: client3.id,
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        tags: ['ppc', 'google-ads'],
      },
      {
        title: 'Saffron November Content Shoot',
        description: 'Coordinate photography and video shoot for November campaign',
        assignedToId: member1.id,
        clientId: client4.id,
        priority: 'HIGH',
        status: 'REVIEW',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        tags: ['content', 'photography'],
      },
      {
        title: 'Monthly Invoicing — All Clients',
        description: 'Generate and send invoices for all active clients',
        assignedToId: admin.id,
        priority: 'URGENT',
        status: 'TODO',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        tags: ['admin', 'billing'],
      },
      {
        title: 'Design Stallion Portfolio Deck',
        description: 'Update agency portfolio for new business presentations',
        assignedToId: member3.id,
        priority: 'LOW',
        status: 'TODO',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        tags: ['design', 'internal'],
      },
      {
        title: 'Facebook Ads Performance Report — TechPeak',
        description: 'Compile monthly performance report for Meta campaigns',
        assignedToId: member2.id,
        clientId: client3.id,
        priority: 'MEDIUM',
        status: 'COMPLETED',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        tags: ['reporting', 'meta'],
      },
    ],
  });

  console.log('✅ Tasks created');

  // Activity logs
  await prisma.activityLog.createMany({
    data: [
      { userId: admin.id, module: 'CLIENTS', action: 'CLIENT_ADDED', details: 'Added client: Al-Faris Retail Group', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      { userId: member1.id, module: 'TASKS', action: 'TASK_UPDATED', details: 'Task status updated to In Progress: Q2 Social Media Calendar', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { userId: admin.id, module: 'LEADS', action: 'LEAD_CONVERTED', details: 'Lead converted: Faisal Bin Turki → Turki Motors', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { userId: member2.id, module: 'TASKS', action: 'TASK_COMPLETED', details: 'Completed: Facebook Ads Performance Report', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      { userId: admin.id, module: 'REVENUE', action: 'PAYMENT_RECORDED', details: 'Payment recorded for TechPeak Solutions: MAD 6,000', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    ],
  });

  console.log('✅ Activity logs created');
  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────');
  console.log('Admin login:  ceo@stallion.com / admin123');
  console.log('Member login: sara@stallion.com / member123');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
