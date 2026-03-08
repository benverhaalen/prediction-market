import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Create default settings
  await prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      defaultBParam: 100,
      rakePercent: 0.05,
      adminPassword: "changeme",
      houseBankroll: 200,
      venmoHandle: "@admin",
    },
  });

  console.log("Seed complete: default settings created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
