# Intro to Prisma

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

-- 2) Sample data --------------------------------------------------------

INSERT INTO customers (name, email) VALUES
    ('Anna Weber', 'anna@example.com'),
    ('Ben Koch', 'ben@example.com');

INSERT INTO products (name, price) VALUES
    ('Keyboard', 79.99),
    ('Mouse', 29.99),
    ('Monitor', 249.00);

-- One-to-many: each order belongs to exactly one customer
INSERT INTO orders (customer_id) VALUES
    (1), -- Anna's order
    (2); -- Ben's order

-- Many-to-many via junction table: an order has many products, a product appears in many orders
INSERT INTO order_items (order_id, product_id, quantity) VALUES
    (1, 1, 1), -- Anna: 1x Keyboard
    (1, 2, 2), -- Anna: 2x Mouse
    (2, 3, 1); -- Ben: 1x Monitor

-- 3) Demonstrate the one-to-many relationship (customer -> orders) ------

-- All orders with their customer
SELECT o.id AS order_id, c.name AS customer_name, o.created_at
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;

-- Count of orders per customer (one-to-many)
SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
ORDER BY c.name;

-- 4) Demonstrate the many-to-many relationship (orders <-> products) ----

-- Full order details: order -> order_items -> product
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

-- Which orders contain the "Mouse"? (many-to-many lookup from the product side)
SELECT o.id AS order_id, c.name AS customer_name, oi.quantity
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = oi.product_id
WHERE p.name = 'Mouse';

-- Order total per order
SELECT o.id AS order_id, SUM(oi.quantity * p.price) AS order_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY o.id
ORDER BY o.id;
```

---

## Coming from Mongoose: the mental model

| Mongoose / MongoDB                             | Prisma / PostgreSQL                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `Schema` + `model()`                           | `model` block in `prisma/schema.prisma`                              |
| Schema lives only in JS, DB doesn't enforce it | Schema is compiled into real SQL (`CREATE TABLE ...`) via migrations |
| `mongoose.connect(uri)`                        | Not needed — `PrismaClient` opens/pools connections lazily           |
| `Model.find()`                                 | `prisma.model.findMany()`                                            |
| `Model.findById(id)`                           | `prisma.model.findUnique({ where: { id } })`                         |
| `Model.create(data)`                           | `prisma.model.create({ data })`                                      |
| `Model.findByIdAndUpdate(id, data)`            | `prisma.model.update({ where: { id }, data })`                       |
| `.populate('field')`                           | `include: { field: true }`                                           |
| Embedded subdocuments / arrays                 | Real separate tables + foreign keys + `include` to join them         |
| No enforced relations between collections      | Postgres foreign keys (`REFERENCES`) enforced at the DB level        |

The biggest mental shift: **Mongoose documents can embed their related data directly** (subdocuments). **Prisma models relational data as separate tables** connected by foreign keys, and you explicitly ask for related rows with `include` (similar to `.populate()`, but resolved via SQL `JOIN`s).

---

## Prerequisites

- Node.js `v24.x` and npm `v11.x` (anything with native `--env-file` support, i.e. Node ≥ 20.6, works).
- PostgreSQL running locally, reachable at `localhost:5432`, with a `postgres` role whose **user and password are both `postgres`**.
- **Prisma `6.19.3`** (both `prisma` and `@prisma/client`) — already pinned as an exact version (no `^`) in `package.json`'s `devDependencies`, and locked in `package-lock.json`. Always install with `npm ci` (not `npm install`) so you get _exactly_ that version — Prisma ships frequent major versions (e.g. 7/8) that rename or remove config options such as the `datasource.url` field used below.

```bash
npm ci
```

---

## Project setup, step by step

### 1. Install Prisma

Already done by `npm ci` above if `prisma` and `@prisma/client` are listed in `package.json`. If you're starting from scratch, pin exact versions (no `^`) so everyone on the team resolves the same major version:

```bash
npm install --save-exact --save-dev prisma@6.19.3 @prisma/client@6.19.3
```

- `prisma` — the CLI (migrations, schema validation, Prisma Studio, client generation).
- `@prisma/client` — the auto-generated, type-safe query client your app code imports at runtime.
- `--save-exact` writes `"6.19.3"` instead of `"^6.19.3"` into `package.json`, so a future `npm install` can't silently jump to a new major version with breaking schema/config changes.

### 2. Scaffold the Prisma project files

```bash
npx prisma init --datasource-provider postgresql
```

This generates a starting `prisma/schema.prisma`, a `prisma.config.ts`, and a `.env` file (with a placeholder `DATABASE_URL`) for you — you then edit them as shown below instead of writing every file from zero.

### 3. Configure the database connection

Connection info lives in **`.env`** (git-ignored) so secrets never get committed. Copy [.env.example](.env.example) to `.env` (or edit the `.env` generated in step 2) and fill in:

```env
PORT=3004
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prisma_shop?schema=public"
```

- Format: `postgresql://<user>:<password>@<host>:<port>/<database>?schema=public`. For this lesson, the local Postgres user/password are both `postgres`.

- This project loads `.env` using Node's **native** `--env-file` flag (see `package.json` scripts) instead of the `dotenv` npm package — one less dependency for the app itself.

- `prisma.config.ts` (read by the Prisma CLI, e.g. `prisma migrate dev`) tells Prisma where the schema and migrations live, and which env var holds the connection string:

```ts
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  engine: "classic",
  datasource: { url: env("DATABASE_URL") },
});
```

- Because our npm scripts run the CLI as `node --env-file=.env node_modules/.bin/prisma ...`, `process.env.DATABASE_URL` is already populated by the time this file runs — no `dotenv` import needed here either.

### 4. Write the schema (`prisma/schema.prisma`)

- This is the Prisma equivalent of your Mongoose schema files — **one file describing every model in the whole app**. See the fully annotated version in [prisma/schema.prisma](prisma/schema.prisma). Key syntax explained:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

- Tells Prisma **what to generate**: a type-safe JS client (like an auto-written Mongoose model, but generated from this file instead of hand-written).

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- Tells Prisma **which database** to talk to. `env(...)` reads the connection string from the environment instead of hardcoding it.

```prisma
model Customer {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique

  orders Order[]

  @@map("customers")
}
```

- `model Customer { ... }` — one model = one SQL table.
- `id Int` — field name `id`, type `Int` (maps to a Postgres integer).
- `@id` — marks this field as the **primary key**.
- `@default(autoincrement())` — auto-incrementing value, i.e. Postgres `GENERATED ALWAYS AS IDENTITY` / `SERIAL`.
- `@unique` — adds a `UNIQUE` constraint (like `{ unique: true }` in a Mongoose schema).
- `orders Order[]` — a **relation field**, not a real column. It doesn't exist in the `customers` table; Prisma uses it purely so you can write `customer.orders` in JS and to know how to join `Order` back to this model. The real foreign key lives on `Order.customerId`.
- `@@map("customers")` — a **block-level** attribute (double `@@`) that renames the table in the actual database. We use `PascalCase` singular names in Prisma (`Customer`) but `snake_case` plural names in SQL (`customers`), matching common conventions on both sides.

```prisma
model Product {
  id         Int         @id @default(autoincrement())
  name       String
  price      Decimal     @db.Decimal(10, 2)
  orderItems OrderItem[]

  @@map("products")
}
```

- `price Decimal @db.Decimal(10, 2)` — stores the product price as `NUMERIC(10,2)` in PostgreSQL, preserving exact decimal values for money.
- `orderItems OrderItem[]` — the reverse relation to the join table. It is not a real column; it lets Prisma navigate from a product to the order items that contain it.
- `@@map("products")` — maps the Prisma model name `Product` to the `products` table in PostgreSQL.

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

- `customerId Int @map("customer_id")` — a **real** foreign key column. `@map` (single `@`, field-level) renames just this field in the DB (camelCase in Prisma, snake_case in SQL).
- `@relation(fields: [customerId], references: [id])` — explicitly wires up the foreign key: "the `customerId` field on this model points at the `id` field on `Customer`". This is what generates `REFERENCES customers(id)`.
- `onDelete: Restrict` — mirrors plain `REFERENCES` behavior in the SQL file: deleting a customer that still has orders is blocked by Postgres.
- `@db.Timestamptz()` — a **native database type** attribute; keeps this column `TIMESTAMPTZ` instead of Prisma's default `TIMESTAMP`.
- `@default(now())` — translates to Postgres `DEFAULT now()`.

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

- This is the **join table** implementing the many-to-many relationship between `Order` and `Product` — exactly like `order_items` in the raw SQL.
- `@@id([orderId, productId])` — a **composite primary key** made of two fields (`PRIMARY KEY (order_id, product_id)` in SQL). No single field has `@id` here; instead the whole combination is unique.
- `onDelete: Cascade` on the `order` relation — deleting an order also deletes its `order_items` rows automatically (Postgres `ON DELETE CASCADE`).
- `onDelete: Restrict` on `product` — you can't delete a product that's still referenced by an existing order item.

**Attribute cheat sheet:**

| Syntax             | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `@id`              | Primary key (single field)                                               |
| `@@id([a, b])`     | Composite primary key (multiple fields)                                  |
| `@default(...)`    | Default value (`autoincrement()`, `now()`, literals, ...)                |
| `@unique`          | Unique constraint on one field                                           |
| `@relation(...)`   | Defines how a foreign key field connects to another model                |
| `@map("db_name")`  | Renames **this field** in the actual database column                     |
| `@@map("db_name")` | Renames **this whole model** to a different database table name          |
| `@db.<Type>()`     | Forces a specific native database column type (e.g. `@db.Decimal(10,2)`) |
| `Model[]`          | "many" side of a relation (array, not a real column)                     |
| single `@`         | field-level attribute                                                    |
| double `@@`        | block/model-level attribute                                              |

### 5. Create the database & run the first migration

- Run the following commands in your VS Code terminal (or any shell) to create the database, generate a SQL migration from `schema.prisma`, and apply it to the database. This is the Prisma equivalent of hand-writing the `CREATE TABLE` statements at the top of this file.

```bash
# create the Postgres database (once)
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE prisma_shop"

# generate + apply a SQL migration from schema.prisma, and regenerate the client
npm run prisma:migrate -- --name init
```

- `-h localhost` forces a TCP connection (password auth), so you don't need `sudo -u postgres` here — that's only required for the Unix-socket "peer" auth used when you connect without `-h`. `PGPASSWORD=postgres` supplies the password inline so the command doesn't stop and wait for interactive input; if your local Postgres prompts anyway, just type `postgres` when asked.

`prisma migrate dev` compares `schema.prisma` against the database, writes a plain `.sql` file under `prisma/migrations/`, and applies it — this is the Prisma equivalent of hand-writing the `CREATE TABLE` statements at the top of this file, except versioned and repeatable.

### 6. Seed sample data

- `Seeding` is the process of populating a database with initial data.
  - This is done ONCE after the first migration, and can be repeated if you drop the database and start over.
  - It is useful for demos, tests, and development environments.
  - The SQL statements above are one way to do it, but Prisma also supports a JS/TS script that can use the Prisma client to insert rows programmatically.

[prisma/seed.js](prisma/seed.js) inserts the exact same sample rows as the SQL file above, using Prisma's **nested writes** to create an order and its order_items in one call:

```bash
npm run prisma:seed
```

### 7. Generate the client (after any schema change)

```bash
npm run prisma:generate
```

- Regenerates the type-safe client in `node_modules/@prisma/client` from the current `schema.prisma`. Run this any time you edit the schema (it also happens automatically after `prisma:migrate`).

### 8. Explore the data visually (optional)

```bash
npm run prisma:studio
```

Opens Prisma Studio, a browser-based admin UI for browsing/editing rows — handy for a live demo instead of `psql`.

---

## App structure (MVC, same shape as the Mongoose projects)

```
src/
  database/
    prismaClient.js   # ONE shared PrismaClient instance (like mongoose.connect, but lazy)
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
  schema.prisma       # the "models" — Prisma's equivalent of Mongoose schemas
  seed.js             # sample data script
  migrations/          # generated SQL migration history
```

- **`src/database/prismaClient.js`** creates a single `PrismaClient` and exports it. Every controller imports this same instance — creating a new client per request would exhaust Postgres' connection pool.
- **Controllers** call `prisma.<model>.<method>()` instead of Mongoose's `Model.<method>()`. `include` replaces `.populate()`.
- **Prisma error codes** show up as `err.code` on thrown errors (e.g. `P2002` unique violation, `P2025` record not found, `P2003` foreign key violation) — controllers map these to HTTP status codes before calling `next(err)`, which flows into the existing `errorHandler` middleware unchanged.

## API endpoints

| Method | Path                 | Description                                                          |
| ------ | -------------------- | -------------------------------------------------------------------- |
| GET    | `/api/customers`     | List customers                                                       |
| GET    | `/api/customers/:id` | Get one customer with their orders + items + products                |
| POST   | `/api/customers`     | Create a customer (`{ name, email }`)                                |
| PUT    | `/api/customers/:id` | Update a customer                                                    |
| DELETE | `/api/customers/:id` | Delete a customer (blocked if they still have orders)                |
| GET    | `/api/products`      | List products                                                        |
| GET    | `/api/products/:id`  | Get one product                                                      |
| POST   | `/api/products`      | Create a product (`{ name, price }`)                                 |
| PUT    | `/api/products/:id`  | Update a product                                                     |
| DELETE | `/api/products/:id`  | Delete a product (blocked if used in an order)                       |
| GET    | `/api/orders`        | List orders with customer + items + products                         |
| GET    | `/api/orders/:id`    | Get one order                                                        |
| POST   | `/api/orders`        | Create an order (`{ customerId, items: [{ productId, quantity }] }`) |
| DELETE | `/api/orders/:id`    | Delete an order (also removes its order_items)                       |

## Running the project

```bash
npm install
npm run prisma:migrate -- --name init   # first time only, creates the tables
npm run prisma:seed                     # loads the sample data from README's SQL
npm start                                # starts Express on PORT from .env
```
