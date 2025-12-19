const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("clubSphere");
    console.log("✅ Successfully connected to MongoDB!");

    // Ping to confirm connection
    await db.command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

// Connect to database before starting server
connectDB().then(() => {
  // Make db available to routes through app.locals
  app.locals.db = db;

  // Import routes after DB connection
  const usersRoute = require("./routes/users");
  const clubsRoute = require("./routes/clubs");
  const eventsRoute = require("./routes/events");
  const membershipsRoute = require("./routes/memberships");
  const eventRegistrationsRoute = require("./routes/eventRegistrations");
  const paymentsRoute = require("./routes/payments");
  const statsRoute = require("./routes/stats");

  // Mount routes
  app.use("/api/users", usersRoute);
  app.use("/api/clubs", clubsRoute);
  app.use("/api/events", eventsRoute);
  app.use("/api/memberships", membershipsRoute);
  app.use("/api/event-registrations", eventRegistrationsRoute);
  app.use("/api/payments", paymentsRoute);
  app.use("/api/stats", statsRoute);

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "OK", message: "Server is running" });
  });

  // Root route
  app.get("/", (req, res) => {
    res.send("Club Sphere Server is Running");
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!", error: err.message });
  });

  // Start server
  app.listen(port, () => {
    console.log(`🚀 Club Sphere Server is Running on port: ${port}`);
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⏳ Shutting down gracefully...");
  await client.close();
  console.log("✅ MongoDB connection closed");
  process.exit(0);
});

module.exports = { app };
