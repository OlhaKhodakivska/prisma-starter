# Einführung in Prisma

```sql
-- 1) Schema -----------------------------------------------------------

CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id)
);

-- 2) Beispieldaten --------------------------------------------------------

INSERT INTO customers (name, email) VALUES
    ('Anna Weber', 'anna@example.com'),
    ('Ben Koch', 'ben@example.com');

INSERT INTO products (name, price) VALUES
    ('Keyboard', 79.99),
    ('Mouse', 29.99),
    ('Monitor', 249.00);

-- One-to-many: jede Order gehört genau einem Customer
INSERT INTO orders (customer_id) VALUES
    (1), -- Annas Order
    (2); -- Bens Order

-- Many-to-many über eine Zwischentabelle: eine Order hat viele Produkte, ein Produkt taucht in vielen Orders auf
INSERT INTO order_items (order_id, product_id, quantity) VALUES
    (1, 1, 1), -- Anna: 1x Keyboard
    (1, 2, 2), -- Anna: 2x Mouse
    (2, 3, 1); -- Ben: 1x Monitor

-- 3) Die one-to-many-Beziehung demonstrieren (customer -> orders) ------

-- Alle Orders mit ihrem Customer
SELECT o.id AS order_id, c.name AS customer_name, o.created_at
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;

-- Anzahl der Orders pro Customer (one-to-many)
SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;

-- 4) Die many-to-many-Beziehung demonstrieren (orders <-> products) ----

-- Vollständige Order-Details: order -> order_items -> product
SELECT
    o.id AS order_id,
    c.name AS customer_name,
    p.name AS product_name,
    oi.quantity,
    p.price,
    (oi.quantity * p.price) AS line_total
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY o.id, p.name;

-- Welche Orders enthalten die "Mouse"? (many-to-many-Suche von der Produktseite aus)
SELECT o.id AS order_id, c.name AS customer_name, oi.quantity
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = oi.product_id
WHERE p.name = 'Mouse';

-- Gesamtsumme pro Order
SELECT o.id AS order_id, SUM(oi.quantity * p.price) AS order_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY o.id
ORDER BY o.id;
```

---

## Vom Mongoose kommend: das Denkmodell

| Mongoose / MongoDB                                 | Prisma / PostgreSQL                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `Schema` + `model()`                               | `model`-Block in `prisma/schema.prisma`                                    |
| Schema existiert nur in JS, die DB erzwingt nichts | Schema wird über Migrationen in echtes SQL kompiliert (`CREATE TABLE ...`) |
| `mongoose.connect(uri)`                            | Nicht nötig — `PrismaClient` öffnet/poolt Verbindungen lazy                |
| `Model.find()`                                     | `prisma.model.findMany()`                                                  |
| `Model.findById(id)`                               | `prisma.model.findUnique({ where: { id } })`                               |
| `Model.create(data)`                               | `prisma.model.create({ data })`                                            |
| `Model.findByIdAndUpdate(id, data)`                | `prisma.model.update({ where: { id }, data })`                             |
| `.populate('field')`                               | `include: { field: true }`                                                 |
| Eingebettete Subdokumente / Arrays                 | Echte, separate Tabellen + Fremdschlüssel + `include` zum Verbinden        |
| Keine erzwungenen Beziehungen zwischen Collections | Postgres-Fremdschlüssel (`REFERENCES`) werden auf DB-Ebene erzwungen       |

Der größte gedankliche Wechsel: **Mongoose-Dokumente können ihre zusammengehörigen Daten direkt einbetten** (Subdokumente). **Prisma modelliert relationale Daten als separate Tabellen**, verbunden über Fremdschlüssel — du fragst zusammengehörige Zeilen explizit mit `include` ab (ähnlich wie `.populate()`, aber über SQL-`JOIN`s aufgelöst).

---

## Voraussetzungen

- Node.js `v24.x` und npm `v11.x` (alles mit nativer `--env-file`-Unterstützung, also Node ≥ 20.6, funktioniert).
- PostgreSQL läuft lokal und ist unter `localhost:5432` erreichbar, mit einer `postgres`-Rolle, deren **Benutzer und Passwort beide `postgres`** sind.
- **Prisma `6.19.3`** (sowohl `prisma` als auch `@prisma/client`) — bereits als exakte Version (ohne `^`) in den `devDependencies` von `package.json` gepinnt und in `package-lock.json` fixiert. Installiere immer mit `npm ci` (nicht `npm install`), damit du _genau_ diese Version bekommst — Prisma bringt häufig neue Major-Versionen heraus (z. B. 7/8), die Konfigurationsoptionen wie das unten genutzte `datasource.url`-Feld umbenennen oder entfernen.

```bash
npm ci
```

---

## Projekt-Setup, Schritt für Schritt

### 1. Prisma installieren

Bereits erledigt durch `npm ci` oben, wenn `prisma` und `@prisma/client` in `package.json` stehen. Falls du bei null anfängst, pinne exakte Versionen (ohne `^`), damit alle im Team dieselbe Major-Version auflösen:

```bash
npm install --save-exact --save-dev prisma@6.19.3 @prisma/client@6.19.3
```

- `prisma` — die CLI (Migrationen, Schema-Validierung, Prisma Studio, Client-Generierung).
- `@prisma/client` — der automatisch generierte, typsichere Query-Client, den dein App-Code zur Laufzeit importiert.
- `--save-exact` schreibt `"6.19.3"` statt `"^6.19.3"` in die `package.json`, damit ein späteres `npm install` nicht heimlich auf eine neue Major-Version mit brechenden Schema-/Config-Änderungen springt.

### 2. Die Prisma-Projektdateien erzeugen

```bash
npx prisma init --datasource-provider postgresql
```

Das erzeugt ein Start-`prisma/schema.prisma`, eine `prisma.config.ts` und eine `.env`-Datei (mit Platzhalter-`DATABASE_URL`) für dich — die du danach wie unten gezeigt anpasst, statt jede Datei bei null zu schreiben.

### 3. Die Datenbankverbindung konfigurieren

Die Verbindungsinfos liegen in **`.env`** (von git ausgeschlossen), damit nie Geheimnisse committet werden. Kopiere [.env.example](.env.example) nach `.env` (oder bearbeite die in Schritt 2 generierte `.env`) und trage ein:

```env
PORT=3004
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prisma_shop?schema=public"
```

- Format: `postgresql://<user>:<password>@<host>:<port>/<database>?schema=public`. Für diese Lektion sind lokaler Postgres-Benutzer und -Passwort beide `postgres`.

- Dieses Projekt lädt `.env` über Node's **eingebautes** `--env-file`-Flag (siehe `package.json`-Scripts) statt über das `dotenv`-npm-Package — eine Abhängigkeit weniger für die App selbst.

- `prisma.config.ts` (wird von der Prisma-CLI gelesen, z. B. bei `prisma migrate dev`) sagt Prisma, wo Schema und Migrationen liegen und welche Umgebungsvariable den Connection-String enthält:

```ts
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  engine: "classic",
  datasource: { url: env("DATABASE_URL") },
});
```

- Da unsere npm-Scripts die CLI als `node --env-file=.env node_modules/.bin/prisma ...` ausführen, ist `process.env.DATABASE_URL` bereits gesetzt, wenn diese Datei läuft — auch hier brauchst du keinen `dotenv`-Import.

### 4. Das Schema schreiben (`prisma/schema.prisma`)

- Das ist das Prisma-Gegenstück zu deinen Mongoose-Schema-Dateien — **eine Datei, die jedes Model der ganzen App beschreibt**. Die vollständig kommentierte Version findest du in [prisma/schema.prisma](prisma/schema.prisma). Die wichtigste Syntax erklärt:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

- Sagt Prisma, **was generiert werden soll**: ein typsicherer JS-Client (wie ein automatisch geschriebenes Mongoose-Model, nur aus dieser Datei generiert statt von Hand geschrieben).

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- Sagt Prisma, **mit welcher Datenbank** es sprechen soll. `env(...)` liest den Connection-String aus der Umgebung, statt ihn hart zu codieren.

```prisma
model Customer {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique

  orders Order[]

  @@map("customers")
}
```

- `model Customer { ... }` — ein Model = eine SQL-Tabelle.
- `id Int` — Feldname `id`, Typ `Int` (wird auf einen Postgres-Integer gemappt).
- `@id` — markiert dieses Feld als **Primärschlüssel**.
- `@default(autoincrement())` — automatisch hochzählender Wert, also Postgres' `GENERATED ALWAYS AS IDENTITY` / `SERIAL`.
- `@unique` — fügt einen `UNIQUE`-Constraint hinzu (wie `{ unique: true }` in einem Mongoose-Schema).
- `orders Order[]` — ein **relation field**, keine echte Spalte. Es existiert nicht in der Tabelle `customers`; Prisma nutzt es nur, damit du `customer.orders` in JS schreiben kannst, und um zu wissen, wie `Order` mit diesem Model verbunden wird. Der echte Fremdschlüssel liegt auf `Order.customerId`.
- `@@map("customers")` — ein **Block-Attribut** (doppeltes `@@`), das die Tabelle in der echten Datenbank umbenennt. Wir nutzen `PascalCase`-Singularnamen in Prisma (`Customer`), aber `snake_case`-Pluralnamen in SQL (`customers`) — passend zu den üblichen Konventionen auf beiden Seiten.

```prisma
model Product {
  id         Int         @id @default(autoincrement())
  name       String
  price      Decimal     @db.Decimal(10, 2)
  orderItems OrderItem[]

  @@map("products")
}
```

- `price Decimal @db.Decimal(10, 2)` — speichert den Produktpreis in PostgreSQL als `NUMERIC(10,2)` und bewahrt dadurch exakte Dezimalwerte für Geldbeträge.
- `orderItems OrderItem[]` — die umgekehrte Beziehung zur Zwischentabelle. Das ist keine echte Spalte; Prisma kann damit von einem Produkt zu den Order-Items navigieren, die es enthalten.
- `@@map("products")` — mappt den Prisma-Modellnamen `Product` auf die Tabelle `products` in PostgreSQL.

```prisma
model Order {
  id         Int      @id @default(autoincrement())
  customerId Int      @map("customer_id")
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz()
  orderItems OrderItem[]

  @@map("orders")
}
```

- `customerId Int @map("customer_id")` — eine **echte** Fremdschlüssel-Spalte. `@map` (einfaches `@`, Feld-Attribut) benennt nur dieses Feld in der DB um (camelCase in Prisma, snake_case in SQL).
- `@relation(fields: [customerId], references: [id])` — verdrahtet den Fremdschlüssel explizit: "das Feld `customerId` auf diesem Model zeigt auf das Feld `id` von `Customer`". Daraus entsteht `REFERENCES customers(id)`.
- `onDelete: Restrict` — entspricht dem Standardverhalten von `REFERENCES` in der SQL-Datei: Das Löschen eines Customers, der noch Orders hat, wird von Postgres blockiert.
- `@db.Timestamptz()` — ein **natives Datenbanktyp**-Attribut; hält diese Spalte als `TIMESTAMPTZ` statt Prismas Standard `TIMESTAMP`.
- `@default(now())` — wird zu Postgres' `DEFAULT now()`.

```prisma
model OrderItem {
  orderId   Int @map("order_id")
  productId Int @map("product_id")
  quantity  Int

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@id([orderId, productId])
  @@map("order_items")
}
```

- Das ist die **Zwischentabelle (Join Table)**, die die many-to-many-Beziehung zwischen `Order` und `Product` umsetzt — genau wie `order_items` im reinen SQL.
- `@@id([orderId, productId])` — ein **zusammengesetzter Primärschlüssel** aus zwei Feldern (`PRIMARY KEY (order_id, product_id)` in SQL). Kein einzelnes Feld hat hier `@id`; stattdessen ist die gesamte Kombination eindeutig.
- `onDelete: Cascade` auf der `order`-Relation — beim Löschen einer Order werden automatisch auch ihre `order_items`-Zeilen gelöscht (Postgres' `ON DELETE CASCADE`).
- `onDelete: Restrict` auf `product` — du kannst kein Produkt löschen, das noch von einem bestehenden Order-Item referenziert wird.

**Attribut-Spickzettel:**

| Syntax             | Bedeutung                                                                          |
| ------------------ | ---------------------------------------------------------------------------------- |
| `@id`              | Primärschlüssel (einzelnes Feld)                                                   |
| `@@id([a, b])`     | Zusammengesetzter Primärschlüssel (mehrere Felder)                                 |
| `@default(...)`    | Standardwert (`autoincrement()`, `now()`, Literale, ...)                           |
| `@unique`          | Unique-Constraint auf einem Feld                                                   |
| `@relation(...)`   | Definiert, wie ein Fremdschlüsselfeld mit einem anderen Model verbunden ist        |
| `@map("db_name")`  | Benennt **dieses Feld** in der echten Datenbankspalte um                           |
| `@@map("db_name")` | Benennt **das ganze Model** auf einen anderen Tabellennamen um                     |
| `@db.<Type>()`     | Erzwingt einen bestimmten nativen Datenbank-Spaltentyp (z. B. `@db.Decimal(10,2)`) |
| `Model[]`          | die "viele"-Seite einer Beziehung (Array, keine echte Spalte)                      |
| einfaches `@`      | Feld-Attribut                                                                      |
| doppeltes `@@`     | Block-/Model-Attribut                                                              |

### 5. Datenbank anlegen & erste Migration ausführen

- Führe die folgenden Befehle in deinem VS Code-Terminal (oder jeder Shell) aus, um die Datenbank zu erstellen, eine SQL-Migration aus `schema.prisma` zu generieren und auf die Datenbank anzuwenden. Das ist das Prisma-Gegenstück zum handgeschriebenen `CREATE TABLE` am Anfang dieser Datei.

```bash
# Postgres-Datenbank anlegen (einmalig)
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE prisma_shop"

# SQL-Migration aus schema.prisma erzeugen + anwenden, Client neu generieren
npm run prisma:migrate -- --name init
```

- `-h localhost` erzwingt eine TCP-Verbindung (Passwort-Auth), du brauchst hier also kein `sudo -u postgres` — das ist nur für die Unix-Socket-"peer"-Auth nötig, die ohne `-h` genutzt wird. `PGPASSWORD=postgres` übergibt das Passwort direkt, damit der Befehl nicht auf eine interaktive Eingabe wartet; falls dein lokales Postgres trotzdem danach fragt, gib einfach `postgres` ein.

`prisma migrate dev` vergleicht `schema.prisma` mit der Datenbank, schreibt eine reine `.sql`-Datei unter `prisma/migrations/` und wendet sie an — das ist das Prisma-Gegenstück zum handgeschriebenen `CREATE TABLE` am Anfang dieser Datei, nur versioniert und wiederholbar.

### 6. Beispieldaten einspielen (Seeding)

- `Seeding` ist der Vorgang, eine Datenbank mit Anfangsdaten zu befüllen.
  - Das machst du EINMAL nach der ersten Migration, und kannst es wiederholen, wenn du die Datenbank löschst und neu anfängst.
  - Es ist nützlich für Demos, Tests und Entwicklungsumgebungen.
  - Die SQL-Statements oben sind ein Weg, das zu tun, aber Prisma unterstützt auch ein JS/TS-Skript, das den Prisma-Client nutzt, um Zeilen programmatisch einzufügen.

[prisma/seed.js](prisma/seed.js) fügt genau dieselben Beispielzeilen wie die SQL-Datei oben ein, mithilfe von Prismas **Nested Writes**, um eine Order und ihre order_items in einem Aufruf zu erstellen:

```bash
npm run prisma:seed
```

### 7. Den Client generieren (nach jeder Schema-Änderung)

```bash
npm run prisma:generate
```

- Regeneriert den typsicheren Client in `node_modules/@prisma/client` aus dem aktuellen `schema.prisma`. Führe das aus, wann immer du das Schema änderst (passiert auch automatisch nach `prisma:migrate`).

### 8. Die Daten visuell erkunden (optional)

```bash
npm run prisma:studio
```

Öffnet Prisma Studio, eine browserbasierte Admin-Oberfläche zum Durchsuchen/Bearbeiten von Zeilen — praktisch für eine Live-Demo statt `psql`.

---

## Projektstruktur (MVC, gleiche Form wie bei den Mongoose-Projekten)

```
src/
  database/
    prismaClient.js   # EINE gemeinsame PrismaClient-Instanz (wie mongoose.connect, nur lazy)
  controllers/
    customerController.js
    productController.js
    orderController.js
  routes/
    customerRoutes.js
    productRoutes.js
    orderRoutes.js
  middlewares/
    errorHandler.js
  server.js
prisma/
  schema.prisma       # die "Models" — Prismas Gegenstück zu Mongoose-Schemas
  seed.js             # Skript für Beispieldaten
  migrations/          # generierte SQL-Migrationshistorie
```

- **`src/database/prismaClient.js`** erstellt einen einzigen `PrismaClient` und exportiert ihn. Jeder Controller importiert dieselbe Instanz — ein neuer Client pro Request würde Postgres' Connection-Pool erschöpfen.
- **Controller** rufen `prisma.<model>.<method>()` auf statt Mongoose's `Model.<method>()`. `include` ersetzt `.populate()`.
- **Prisma-Fehlercodes** tauchen als `err.code` bei geworfenen Fehlern auf (z. B. `P2002` Unique-Verletzung, `P2025` Datensatz nicht gefunden, `P2003` Fremdschlüssel-Verletzung) — die Controller mappen diese auf HTTP-Statuscodes, bevor sie `next(err)` aufrufen, was unverändert in die bestehende `errorHandler`-Middleware fließt.

## API-Endpunkte

| Methode | Pfad                 | Beschreibung                                                              |
| ------- | -------------------- | ------------------------------------------------------------------------- |
| GET     | `/api/customers`     | Customers auflisten                                                       |
| GET     | `/api/customers/:id` | Einen Customer mit seinen Orders + Items + Products abrufen               |
| POST    | `/api/customers`     | Einen Customer erstellen (`{ name, email }`)                              |
| PUT     | `/api/customers/:id` | Einen Customer aktualisieren                                              |
| DELETE  | `/api/customers/:id` | Einen Customer löschen (blockiert, wenn er noch Orders hat)               |
| GET     | `/api/products`      | Products auflisten                                                        |
| GET     | `/api/products/:id`  | Ein Product abrufen                                                       |
| POST    | `/api/products`      | Ein Product erstellen (`{ name, price }`)                                 |
| PUT     | `/api/products/:id`  | Ein Product aktualisieren                                                 |
| DELETE  | `/api/products/:id`  | Ein Product löschen (blockiert, wenn es in einer Order verwendet wird)    |
| GET     | `/api/orders`        | Orders mit Customer + Items + Products auflisten                          |
| GET     | `/api/orders/:id`    | Eine Order abrufen                                                        |
| POST    | `/api/orders`        | Eine Order erstellen (`{ customerId, items: [{ productId, quantity }] }`) |
| DELETE  | `/api/orders/:id`    | Eine Order löschen (entfernt auch ihre order_items)                       |

## Das Projekt starten

```bash
npm install
npm run prisma:migrate -- --name init   # nur beim ersten Mal, legt die Tabellen an
npm run prisma:seed                     # lädt die Beispieldaten aus dem SQL der README
npm start                                # startet Express auf PORT aus .env
```
