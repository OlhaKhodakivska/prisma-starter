import { PrismaClient } from "./generated/prisma/client.ts";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      posts: {
        create: {
          title: "Mein erster Post",
          content: "Prisma Relations lernen",
        },
      },
    },
    include: {
      posts: true,
    },
  });

  console.log("User mit Post:", user);

  const users = await prisma.user.findMany({
    include: {
      posts: true,
    },
  });

  console.dir(users, { depth: null });
}

try {
  await main();
} catch (error) {
  console.error("Fehler:", error);
} finally {
  await prisma.$disconnect();
}