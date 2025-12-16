require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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
  }
});

// Import Routes
const userRoutes = require('./routes/users');
const clubRoutes = require('./routes/clubs');
const eventRoutes = require('./routes/events');
const membershipRoutes = require('./routes/memberships');
const eventRegistrationRoutes = require('./routes/eventRegistrations');
const paymentRoutes = require('./routes/payments');
const statsRoutes = require('./routes/stats');

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Successfully connected to MongoDB!");
    
    // Make database accessible to routes
    const db = client.db("clubSphere");
    app.locals.db = db;
    
    // Root Route
    app.get('/', (req, res) => {
      res.send('Club Sphere Server is Running');
    });
    
    // API Routes
    app.use('/api/users', userRoutes);
    app.use('/api/clubs', clubRoutes);
    app.use('/api/events', eventRoutes);
    app.use('/api/memberships', membershipRoutes);
    app.use('/api/event-registrations', eventRegistrationRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/stats', statsRoutes);
    
    // Health Check Route
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', message: 'Server is healthy' });
    });
    
    // 404 Handler
    app.use((req, res) => {
      res.status(404).json({ message: 'Route not found' });
    });
    
    // Error Handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: 'Something went wrong!', error: err.message });
    });
    
    // Ping MongoDB
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

run().catch(console.dir);

// Start Server
app.listen(port, () => {
  console.log(`Club Sphere Server is Running on port: ${port}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});