const express = require("express");
const router = express.Router();
const { verifyToken, verifyAdmin, verifyClubManager } = require("../middleware/auth");

// Get featured clubs (for homepage - public)
router.get("/featured-clubs", async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const clubs = await db
      .collection("clubs")
      .find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

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
    console.error("Error fetching featured clubs:", error);
    res.status(500).json({ message: "Error fetching featured clubs", error: error.message });
  }
});

// Get upcoming events (for homepage - public)
router.get("/upcoming-events", async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const events = await db
      .collection("events")
      .find({ eventDate: { $gte: new Date() } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    // Get registration counts
    for (let event of events) {
      const registrationCount = await db.collection("eventRegistrations").countDocuments({
        eventId: event._id,
      });
      event.registrationCount = registrationCount;
    }

    res.json(events);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ message: "Error fetching upcoming events", error: error.message });
  }
});

// Admin stats
router.get("/admin", verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [
      totalUsers,
      totalClubs,
      approvedClubs,
      pendingClubs,
      totalEvents,
      totalMemberships,
      activeMemberships,
      payments,
    ] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("clubs").countDocuments(),
      db.collection("clubs").countDocuments({ status: "approved" }),
      db.collection("clubs").countDocuments({ status: "pending" }),
      db.collection("events").countDocuments(),
      db.collection("memberships").countDocuments(),
      db.collection("memberships").countDocuments({ status: "active" }),
      db.collection("payments").find({}).toArray(),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const paymentsByType = await db.collection("payments").aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
    ]).toArray();

    res.json({
      users: { total: totalUsers, recent: 0 },
      clubs: { total: totalClubs, approved: approvedClubs, pending: pendingClubs },
      events: { total: totalEvents },
      memberships: { total: totalMemberships, active: activeMemberships },
      payments: {
        total: payments.length,
        revenue: totalRevenue,
        byType: paymentsByType,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
});

// Manager stats
router.get("/manager", verifyClubManager, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const managerEmail = req.user.email;

    const clubs = await db.collection("clubs").find({ managerEmail }).toArray();
    const clubIds = clubs.map((c) => c._id);

    const [totalEvents, upcomingEvents, totalPayments] = await Promise.all([
      db.collection("events").countDocuments({ clubId: { $in: clubIds } }),
      db.collection("events").countDocuments({
        clubId: { $in: clubIds },
        eventDate: { $gte: new Date() },
      }),
      db.collection("payments").find({ clubId: { $in: clubIds.map(String) } }).toArray(),
    ]);

    const membersByClub = await db.collection("memberships").aggregate([
      { $match: { clubId: { $in: clubIds } } },
      {
        $group: {
          _id: "$clubId",
          memberCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "clubs",
          localField: "_id",
          foreignField: "_id",
          as: "club",
        },
      },
      { $unwind: "$club" },
      {
        $project: {
          clubId: "$_id",
          clubName: "$club.clubName",
          memberCount: 1,
        },
      },
    ]).toArray();

    const totalRevenue = totalPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalMembers = membersByClub.reduce((sum, m) => sum + m.memberCount, 0);

    res.json({
      clubs: {
        total: clubs.length,
        approved: clubs.filter((c) => c.status === "approved").length,
      },
      members: { total: totalMembers, byClub: membersByClub },
      events: { total: totalEvents, upcoming: upcomingEvents },
      revenue: { total: totalRevenue, payments: totalPayments.length },
    });
  } catch (error) {
    console.error("Error fetching manager stats:", error);
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
});

// Member stats
router.get("/member", verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;

    const [clubsJoined, eventsRegistered, payments] = await Promise.all([
      db.collection("memberships").countDocuments({ userEmail }),
      db.collection("eventRegistrations").countDocuments({ userEmail }),
      db.collection("payments").find({ userEmail }).toArray(),
    ]);

    const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      clubs: { joined: clubsJoined },
      events: { registered: eventsRegistered },
      payments: { totalPayments: payments.length, totalSpent },
    });
  } catch (error) {
    console.error("Error fetching member stats:", error);
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
});

module.exports = router;