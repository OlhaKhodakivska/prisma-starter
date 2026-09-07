import { PrismaClient } from "./generated/prisma/client.ts";

// Prisma Client ermöglicht den Zugriff auf die Datenbank.
const prisma = new PrismaClient();

async function main() {
  // Verbindung zur PostgreSQL-Datenbank herstellen.
  await prisma.$connect();
  console.log("Verbindung zur Datenbank hergestellt.");

  // Einen neuen User über das Prisma-Modell erstellen.
  const newUser = await prisma.user.create({
    data: {
      name: "Olha Khodakivska",
      email: "olha@example.com",
    },
  });

  console.log("Neuer User:", newUser);

  // Alle User über das Prisma-Modell abrufen.
  const users = await prisma.user.findMany();

  console.log("Alle User:", users);
}

try {
  await main();
} catch (error) {
  console.error("Fehler beim Datenbankzugriff:", error);
} finally {
  // Verbindung auch bei einem Fehler zuverlässig schließen.
  await prisma.$disconnect();
  console.log("Datenbankverbindung geschlossen.");
}