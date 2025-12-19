const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../middleware/auth");

// Get all memberships for current user
router.get("/my-memberships", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;

    const memberships = await db
      .collection("memberships")
      .find({ userEmail })
      .toArray();

    res.json(memberships);
  } catch (error) {
    console.error("Error fetching memberships:", error);
    res.status(500).json({ message: "Error fetching memberships", error: error.message });
  }
});

// Create a new membership
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { clubId } = req.body;
    const userEmail = req.user.email;

    // Check if membership already exists
    const existingMembership = await db.collection("memberships").findOne({
      clubId: new ObjectId(clubId),
      userEmail,
    });

    if (existingMembership) {
      return res.status(400).json({ message: "Already a member of this club" });
    }

    const newMembership = {
      clubId: new ObjectId(clubId),
      userEmail,
      status: "active",
      joinedAt: new Date(),
    };

    const result = await db.collection("memberships").insertOne(newMembership);

    res.status(201).json({
      message: "Membership created successfully",
      membershipId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating membership:", error);
    res.status(500).json({ message: "Error creating membership", error: error.message });
  }
});

// Get all memberships (Admin only)
router.get("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const memberships = await db
      .collection("memberships")
      .find({})
      .toArray();

    res.json(memberships);
  } catch (error) {
    console.error("Error fetching all memberships:", error);
    res.status(500).json({ message: "Error fetching memberships", error: error.message });
  }
});

module.exports = router;