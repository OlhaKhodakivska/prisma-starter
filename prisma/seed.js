import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient();

async function main() {
  // User-Testdaten
  await prisma.user.createMany({
    data: [
      { name: "Anna Weber", email: "anna@example.com" },
      { name: "Ben Koch", email: "ben@example.com" },
      { name: "Maria Schulz", email: "maria@example.com" },
    ],
    skipDuplicates: true,
  });

  // Alte Shop-Testdaten löschen, damit das Seed wiederholbar ist.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  // Customers erstellen
  const anna = await prisma.customer.create({
    data: {
      name: "Anna Weber",
      email: "anna.customer@example.com",
    },
  });

  const ben = await prisma.customer.create({
    data: {
      name: "Ben Koch",
      email: "ben.customer@example.com",
    },
  });

  // Products erstellen
  const keyboard = await prisma.product.create({
    data: {
      name: "Keyboard",
      price: "79.99",
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: "Mouse",
      price: "29.99",
    },
  });

  const monitor = await prisma.product.create({
    data: {
      name: "Monitor",
      price: "249.00",
    },
  });

  // Annas Order mit zwei Products
  await prisma.order.create({
    data: {
      customer: {
        connect: { id: anna.id },
      },
      orderItems: {
        create: [
          {
            quantity: 1,
            product: {
              connect: { id: keyboard.id },
            },
          },
          {
            quantity: 2,
            product: {
              connect: { id: mouse.id },
            },
          },
        ],
      },
    },
  });

  // Bens Order mit einem Product
  await prisma.order.create({
    data: {
      customer: {
        connect: { id: ben.id },
      },
      orderItems: {
        create: [
          {
            quantity: 1,
            product: {
              connect: { id: monitor.id },
            },
          },
        ],
      },
    },
  });

  const orders = await prisma.order.findMany({
    include: {
      customer: true,
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  console.dir(orders, { depth: null });
}

try {
  await main();
  console.log("Seeding erfolgreich abgeschlossen.");
} catch (error) {
  console.error("Fehler beim Seeding:", error);
} finally {
  await prisma.$disconnect();
}