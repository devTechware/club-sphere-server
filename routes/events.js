const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../middleware/auth");

// Get all approved events (Public) with search and sort
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, sort } = req.query;

    let query = {};

    // Search by event title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Sort options
    let sortOption = {};
    switch (sort) {
      case "eventDate":
        sortOption = { eventDate: 1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { eventDate: 1 };
    }

    const events = await db.collection("events").find(query).sort(sortOption).toArray();

    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Error fetching events", error: error.message });
  }
});

// Get single event by ID (Public)
router.get("/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await db.collection("events").findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Get registration count
    const registrationCount = await db.collection("eventRegistrations").countDocuments({
      eventId: new ObjectId(id),
    });

    event.registrationCount = registrationCount;

    res.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ message: "Error fetching event", error: error.message });
  }
});

// Create a new event
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const eventData = {
      ...req.body,
      clubId: new ObjectId(req.body.clubId),
      createdAt: new Date(),
    };

    const result = await db.collection("events").insertOne(eventData);

    res.status(201).json({
      message: "Event created successfully",
      eventId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Error creating event", error: error.message });
  }
});

module.exports = router;