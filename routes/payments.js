const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

// Get user's payment history
router.get("/my-payments", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;

    const payments = await db
      .collection("payments")
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ message: "Error fetching payments", error: error.message });
  }
});

// Get all payments (Admin only)
router.get("/all", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const payments = await db
      .collection("payments")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(payments);
  } catch (error) {
    console.error("Error fetching all payments:", error);
    res.status(500).json({ message: "Error fetching payments", error: error.message });
  }
});

// Create a payment
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const paymentData = {
      ...req.body,
      userEmail: req.user.email,
      status: "completed",
      createdAt: new Date(),
    };

    const result = await db.collection("payments").insertOne(paymentData);

    res.status(201).json({
      message: "Payment recorded successfully",
      paymentId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ message: "Error creating payment", error: error.message });
  }
});

module.exports = router;