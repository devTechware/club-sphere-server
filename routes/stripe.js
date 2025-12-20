const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { verifyToken } = require("../middleware/auth");

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent for club membership
router.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { clubId, amount } = req.body;

    if (!clubId || amount === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify club exists
    const { ObjectId } = require("mongodb");
    const club = await db.collection("clubs").findOne({ _id: new ObjectId(clubId) });
    
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: "usd",
      metadata: {
        clubId: clubId,
        clubName: club.clubName,
        userEmail: req.user.email,
        type: "membership",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ 
      message: "Error creating payment intent", 
      error: error.message 
    });
  }
});

// Create payment intent for event registration
router.post("/create-event-payment-intent", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { eventId, amount } = req.body;

    if (!eventId || amount === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify event exists
    const { ObjectId } = require("mongodb");
    const event = await db.collection("events").findOne({ _id: new ObjectId(eventId) });
    
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: "usd",
      metadata: {
        eventId: eventId,
        eventTitle: event.title,
        userEmail: req.user.email,
        type: "event",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating event payment intent:", error);
    res.status(500).json({ 
      message: "Error creating payment intent", 
      error: error.message 
    });
  }
});

// Webhook to handle payment success
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    console.log("Payment succeeded:", paymentIntent.id);
    
    // You can add logic here to update your database
    // For example, create membership or event registration
  }

  res.json({ received: true });
});

// Get Stripe publishable key
router.get("/config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

module.exports = router;