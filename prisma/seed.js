import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.createMany({
    data: [
      {
        name: "Anna Weber",
        email: "anna@example.com",
      },
      {
        name: "Ben Koch",
        email: "ben@example.com",
      },
      {
        name: "Maria Schulz",
        email: "maria@example.com",
      },
    ],
    skipDuplicates: true,
  });

  console.log(`${result.count} User wurden erstellt.`);

  const users = await prisma.user.findMany();
  console.log("Alle User:", users);
}

try {
  await main();
} catch (error) {
  console.error("Fehler beim Seeding:", error);
} finally {
  await prisma.$disconnect();
}