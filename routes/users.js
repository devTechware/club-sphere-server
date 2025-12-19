const express = require("express");
const router = express.Router();
const { verifyToken, verifyAdmin } = require("../middleware/auth");

// Register or update user (called after Firebase authentication)
router.post("/register", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, email, photoURL } = req.body;

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      // Update existing user info (in case they changed their profile)
      await db.collection("users").updateOne(
        { email },
        {
          $set: {
            name,
            photoURL,
            updatedAt: new Date(),
          },
        }
      );

      return res.json({
        success: true,
        message: "User profile updated",
        isNewUser: false,
        user: { ...existingUser, name, photoURL },
      });
    }

    // Create new user with default role "member"
    const newUser = {
      email,
      name,
      photoURL,
      role: "member",
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(newUser);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      isNewUser: true,
      user: newUser,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
});

// Get current user profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    const user = await db.collection("users").findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
});

// Update user profile
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    const { name, photoURL } = req.body;

    const result = await db.collection("users").updateOne(
      { email: userEmail },
      {
        $set: {
          name,
          photoURL,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
});

// Get all users (Admin only)
router.get("/", verifyAdmin, async (req, res) => {
  try {
    console.log("📋 GET /api/users - Fetching all users");
    console.log("User making request:", req.user?.email);
    console.log("User role:", req.userRole);
    
    const db = req.app.locals.db;
    
    if (!db) {
      console.error("❌ Database connection not available");
      return res.status(500).json({ message: "Database connection error" });
    }
    
    console.log("✅ Database connection OK");
    
    const users = await db
      .collection("users")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Error fetching users", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update user role (Admin only)
router.patch("/role/:email", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email } = req.params;
    const { role } = req.body;
    const adminEmail = req.user.email;

    console.log(`📝 Updating role for ${email} to ${role}`);

    // Validate role
    if (!["member", "clubManager", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Prevent admin from changing their own role
    if (email === adminEmail) {
      return res.status(403).json({ message: "Cannot change your own role" });
    }

    const result = await db.collection("users").updateOne(
      { email },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ Role updated successfully for ${email}`);
    res.json({ 
      success: true,
      message: "User role updated successfully",
      email,
      newRole: role
    });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating user role", 
      error: error.message 
    });
  }
});

// Debug route - Check current user's role
router.get("/debug/me", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await db.collection("users").findOne({ email: req.user.email });
    
    res.json({
      firebaseUser: {
        email: req.user.email,
        uid: req.user.uid
      },
      databaseUser: user,
      isAdmin: user?.role === "admin",
      hasAdminAccess: user?.role === "admin"
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
});

module.exports = router;