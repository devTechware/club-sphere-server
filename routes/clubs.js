const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken, verifyClubManager, verifyAdmin } = require("../middleware/auth");

// Get all approved clubs (Public) with search, filter, sort
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, category, sort } = req.query;

    let query = { status: "approved" };

    // Search by club name
    if (search) {
      query.clubName = { $regex: search, $options: "i" };
    }

    // Filter by category
    if (category && category !== "all") {
      query.category = category;
    }

    // Sort options
    let sortOption = {};
    switch (sort) {
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "highestFee":
        sortOption = { membershipFee: -1 };
        break;
      case "lowestFee":
        sortOption = { membershipFee: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const clubs = await db.collection("clubs").find(query).sort(sortOption).toArray();

    // Get member counts for each club
    for (let club of clubs) {
      const memberCount = await db.collection("memberships").countDocuments({
        clubId: club._id,
        status: "active",
      });
      club.memberCount = memberCount;
    }

    res.json(clubs);
  } catch (error) {
    console.error("Error fetching clubs:", error);
    res.status(500).json({ message: "Error fetching clubs", error: error.message });
  }
});

// Get single club by ID (Public)
router.get("/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid club ID" });
    }

    const club = await db.collection("clubs").findOne({ _id: new ObjectId(id) });

    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    // Get member and event counts
    const memberCount = await db.collection("memberships").countDocuments({
      clubId: new ObjectId(id),
      status: "active",
    });

    const eventCount = await db.collection("events").countDocuments({
      clubId: new ObjectId(id),
    });

    club.memberCount = memberCount;
    club.eventCount = eventCount;

    res.json(club);
  } catch (error) {
    console.error("Error fetching club:", error);
    res.status(500).json({ message: "Error fetching club", error: error.message });
  }
});

// Get all clubs including pending (Admin only)
router.get("/admin/all", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const clubs = await db.collection("clubs").find({}).sort({ createdAt: -1 }).toArray();

    // Get member counts
    for (let club of clubs) {
      const memberCount = await db.collection("memberships").countDocuments({
        clubId: club._id,
        status: "active",
      });
      club.memberCount = memberCount;
    }

    res.json(clubs);
  } catch (error) {
    console.error("Error fetching all clubs:", error);
    res.status(500).json({ message: "Error fetching clubs", error: error.message });
  }
});

// Update club status (Admin only)
router.patch("/admin/:id/status", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const result = await db.collection("clubs").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Club not found" });
    }

    res.json({ success: true, status, message: `Club ${status}` });
  } catch (error) {
    console.error("Error updating club status:", error);
    res.status(500).json({ message: "Error updating club status", error: error.message });
  }
});

// Create a new club
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const clubData = {
      ...req.body,
      managerEmail: req.user.email,
      status: "pending",
      images: req.body.images || [],
      createdAt: new Date(),
    };

    const result = await db.collection("clubs").insertOne(clubData);

    res.status(201).json({
      message: "Club created successfully",
      clubId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating club:", error);
    res.status(500).json({ message: "Error creating club", error: error.message });
  }
});

module.exports = router;