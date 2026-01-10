const express = require("express");
const router = express.Router();
const { verifyToken, verifyAdmin } = require("../middleware/auth");

// Register or update user
router.post("/register", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, email, photoURL } = req.body;

    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      return res.json({ message: "User already exists", user: existingUser });
    }

    const user = {
      name,
      email,
      photoURL,
      role: "member",
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(user);
    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error("Error in register:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await db.collection("users").findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update user profile
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, photoURL } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    updateData.updatedAt = new Date();

    const result = await db.collection("users").findOneAndUpdate(
      { email: req.user.email },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated successfully", user: result });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all users (Admin only)
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const users = await db.collection("users").find({}).toArray();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update user role (Admin only)
router.patch("/role/:email", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email } = req.params;
    const { role } = req.body;

    if (!["member", "clubManager", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (email === req.user.email) {
      return res.status(400).json({ message: "Cannot change your own role" });
    }

    const result = await db.collection("users").findOneAndUpdate(
      { email },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Role updated successfully", user: result });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;