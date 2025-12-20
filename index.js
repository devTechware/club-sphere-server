const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://club-sphere-psi.vercel.app"    
  ],
  credentials: true
}));
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
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
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return db;
  }

  try {
    await client.connect();
    db = client.db("clubSphere");
    isConnected = true;
    console.log("✅ Successfully connected to MongoDB!");
    await db.command({ ping: 1 });
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Middleware to ensure DB connection and attach to app.locals
app.use(async (req, res, next) => {
  if (req.path === "/api/stripe/webhook") {
    return next();
  }
  try {
    if (!isConnected) {
      await connectDB();
    }
    req.app.locals.db = db;
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ 
      message: "Database connection failed",
      error: error.message 
    });
  }
});

// Import routes
const usersRoute = require("./routes/users");
const clubsRoute = require("./routes/clubs");
const eventsRoute = require("./routes/events");
const membershipsRoute = require("./routes/memberships");
const eventRegistrationsRoute = require("./routes/eventRegistrations");
const paymentsRoute = require("./routes/payments");
const statsRoute = require("./routes/stats");
const stripeRoute = require("./routes/stripe");

// Mount routes
app.use("/api/users", usersRoute);
app.use("/api/clubs", clubsRoute);
app.use("/api/events", eventsRoute);
app.use("/api/memberships", membershipsRoute);
app.use("/api/event-registrations", eventRegistrationsRoute);
app.use("/api/payments", paymentsRoute);
app.use("/api/stats", statsRoute);
app.use("/api/stripe", stripeRoute);

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Club Sphere Server is Running",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    database: isConnected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.stack);
  res.status(500).json({ 
    message: "Something went wrong!", 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 Club Sphere Server is Running on port: ${port}`);
  });
}

// Export for Vercel
module.exports = app;