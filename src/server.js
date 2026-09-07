import express from "express";

import errorHandler from "./middlewares/errorHandler.js";

const app = express();
const PORT = Number(process.env.PORT);

app.use(express.json());

// TODO: mount your customer/product/order routes here, e.g.
// app.use("/api/customers", customerRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

export default app;
