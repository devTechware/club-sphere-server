const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../middleware/auth");

// Get user's event registrations
router.get("/my-registrations", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;

    const registrations = await db
      .collection("eventRegistrations")
      .find({ userEmail })
      .toArray();

    res.json(registrations);
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ message: "Error fetching registrations", error: error.message });
  }
});

// Register for an event
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { eventId } = req.body;
    const userEmail = req.user.email;

    // Check if already registered
    const existingRegistration = await db.collection("eventRegistrations").findOne({
      eventId: new ObjectId(eventId),
      userEmail,
    });

    if (existingRegistration) {
      return res.status(400).json({ message: "Already registered for this event" });
    }

    const newRegistration = {
      eventId: new ObjectId(eventId),
      userEmail,
      registeredAt: new Date(),
    };

    const result = await db.collection("eventRegistrations").insertOne(newRegistration);

    res.status(201).json({
      message: "Registration successful",
      registrationId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating registration:", error);
    res.status(500).json({ message: "Error creating registration", error: error.message });
  }
});

module.exports = router;