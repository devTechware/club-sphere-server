const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../middleware/auth");

// Get reviews for an item (club or event)
router.get("/:itemType/:itemId", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { itemType, itemId } = req.params;

    if (!["club", "event"].includes(itemType)) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    if (!ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const reviews = await db
      .collection("reviews")
      .find({ itemType, itemId: new ObjectId(itemId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Error fetching reviews", error: error.message });
  }
});

// Add a review
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { itemType, itemId, rating, comment } = req.body;

    // Validation
    if (!["club", "event"].includes(itemType)) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    if (!ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ message: "Comment must be at least 10 characters" });
    }

    // Check if user already reviewed this item
    const existingReview = await db.collection("reviews").findOne({
      itemType,
      itemId: new ObjectId(itemId),
      userId: req.user.uid,
    });

    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this item" });
    }

    const review = {
      itemType,
      itemId: new ObjectId(itemId),
      userId: req.user.uid,
      userName: req.user.name || req.user.email.split("@")[0],
      userPhoto: req.user.picture || null,
      rating: parseInt(rating),
      comment: comment.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("reviews").insertOne(review);

    res.status(201).json({
      message: "Review submitted successfully",
      reviewId: result.insertedId,
      review: { ...review, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ message: "Error creating review", error: error.message });
  }
});

// Update a review
router.patch("/:reviewId", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    if (!ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const review = await db.collection("reviews").findOne({
      _id: new ObjectId(reviewId),
      userId: req.user.uid,
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found or unauthorized" });
    }

    const updateData = { updatedAt: new Date() };
    if (rating) updateData.rating = parseInt(rating);
    if (comment) updateData.comment = comment.trim();

    const result = await db.collection("reviews").findOneAndUpdate(
      { _id: new ObjectId(reviewId) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    res.json({
      message: "Review updated successfully",
      review: result,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ message: "Error updating review", error: error.message });
  }
});

// Delete a review
router.delete("/:reviewId", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { reviewId } = req.params;

    if (!ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const review = await db.collection("reviews").findOne({
      _id: new ObjectId(reviewId),
      userId: req.user.uid,
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found or unauthorized" });
    }

    await db.collection("reviews").deleteOne({ _id: new ObjectId(reviewId) });

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Error deleting review", error: error.message });
  }
});

module.exports = router;