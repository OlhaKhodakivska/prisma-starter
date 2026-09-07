# Prisma – Projektnotizen

## Warum verwenden wir Prisma?

- Prisma verbindet unser Node.js-Projekt mit der PostgreSQL-Datenbank.
- Wir beschreiben Tabellen und Felder übersichtlich als Models in der Datei `schema.prisma`.
- Prisma erstellt und aktualisiert die Datenbankstruktur mithilfe von Migrationen.
- Mit Prisma Client können wir Daten über JavaScript-Methoden bearbeiten, ohne direkte SQL-Strings zu schreiben.
- Prisma reduziert Fehler und macht den Datenbankzugriff im Projekt leichter verständlich.

## Die Rolle der DATABASE_URL

Die `DATABASE_URL` enthält alle Informationen, die Prisma für die Verbindung mit PostgreSQL benötigt: Benutzer, Passwort, Host, Port und Datenbankname. Sie befindet sich in der `.env`-Datei, damit sensible Zugangsdaten nicht direkt im Quellcode gespeichert werden. Prisma liest diese Variable bei Migrationen und beim Datenbankzugriff.

## Arbeiten mit dem Prisma-Modell

In `src/index.js` verwenden wir `prisma.user.create()`, um einen Datensatz zu erstellen, und `prisma.user.findMany()`, um alle User abzurufen. `prisma.user` bezieht sich dabei direkt auf das `User`-Model aus `schema.prisma`. Es werden keine direkten SQL-Strings verwendet.

## Prisma, Query Builder und Drizzle

### Was ist Prisma in diesem Projekt?

Prisma ist die Verbindungsschicht zwischen unserem JavaScript-Code und PostgreSQL. Wir arbeiten mit dem `User`-Model und Methoden wie `create()` oder `findMany()`, während Prisma daraus die notwendigen Datenbankabfragen erstellt.

### ORM und Query Builder

Mit einem ORM arbeiten wir hauptsächlich mit Models und Objekten. Ein Query Builder bleibt näher an SQL: Abfragen werden schrittweise mit Methoden zusammengesetzt, wodurch wir mehr Kontrolle über die genaue Struktur der Datenbankabfrage haben.

### Wann wäre Drizzle interessant?

Drizzle wäre interessant, wenn wir weiterhin TypeScript-Unterstützung und typsichere Abfragen möchten, aber näher an SQL arbeiten und mehr Kontrolle über die ausgeführten Abfragen behalten wollen.

## Getesteter Fehlerfall

Beim zweiten Start des Testskripts wurde erneut der User mit der E-Mail-Adresse `olha@example.com` erstellt. Da das Feld `email` im Prisma-Schema mit `@unique` definiert ist, hat Prisma den Fehlercode `P2002` zurückgegeben. Der Fehler wurde durch `catch` kontrolliert behandelt und die Datenbankverbindung wurde im `finally`-Block trotzdem geschlossen.
