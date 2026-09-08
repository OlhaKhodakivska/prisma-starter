import express from "express";
import { PrismaClient } from "./generated/prisma/client.ts";

import errorHandler from "./middlewares/errorHandler.js";

const app = express();
const PORT = Number(process.env.PORT);
const prisma = new PrismaClient();

app.use(express.json());

// TODO: mount your customer/product/order routes here, e.g.
// app.use("/api/customers", customerRoutes);

// GET ALL CUSTOMERS
app.get("/api/customers", async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany();

    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

export default app;
