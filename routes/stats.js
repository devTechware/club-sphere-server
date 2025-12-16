const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin, verifyClubManager, verifyMember } = require('../middleware/auth');

// Admin Dashboard Stats
router.get('/admin/overview', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const totalUsers = await db.collection('users').countDocuments();
    const totalClubs = await db.collection('clubs').countDocuments();
    const pendingClubs = await db.collection('clubs').countDocuments({ status: 'pending' });
    const approvedClubs = await db.collection('clubs').countDocuments({ status: 'approved' });
    const rejectedClubs = await db.collection('clubs').countDocuments({ status: 'rejected' });
    const totalMemberships = await db.collection('memberships').countDocuments();
    const activeMemberships = await db.collection('memberships').countDocuments({ status: 'active' });
    const totalEvents = await db.collection('events').countDocuments();
    
    const paymentStats = await db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const totalRevenue = paymentStats.length > 0 ? paymentStats[0].totalRevenue : 0;
    const totalPayments = paymentStats.length > 0 ? paymentStats[0].totalPayments : 0;
    
    const revenueByType = await db.collection('payments').aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$type',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await db.collection('users').countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const recentClubs = await db.collection('clubs').countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    res.status(200).json({
      users: { total: totalUsers, recent: recentUsers },
      clubs: { total: totalClubs, pending: pendingClubs, approved: approvedClubs, rejected: rejectedClubs, recent: recentClubs },
      memberships: { total: totalMemberships, active: activeMemberships },
      events: { total: totalEvents },
      payments: { total: totalPayments, revenue: totalRevenue, byType: revenueByType }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin stats', error: error.message });
  }
});

// Club Manager Dashboard Stats
router.get('/manager/overview', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    const clubs = await db.collection('clubs')
      .find({ managerEmail })
      .toArray();
    
    const clubIds = clubs.map(club => club._id.toString());
    const totalClubs = clubs.length;
    const approvedClubs = clubs.filter(c => c.status === 'approved').length;
    const pendingClubs = clubs.filter(c => c.status === 'pending').length;
    
    const totalMembers = await db.collection('memberships').countDocuments({
      clubId: { $in: clubIds },
      status: 'active'
    });
    
    const totalEvents = await db.collection('events').countDocuments({
      clubId: { $in: clubIds }
    });
    
    const upcomingEvents = await db.collection('events').countDocuments({
      clubId: { $in: clubIds },
      eventDate: { $gte: new Date() }
    });
    
    const revenueStats = await db.collection('payments').aggregate([
      { 
        $match: { 
          clubId: { $in: clubIds },
          status: 'completed'
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalPayments: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
    const totalPaymentsCount = revenueStats.length > 0 ? revenueStats[0].totalPayments : 0;
    
    const membersPerClub = await Promise.all(clubs.map(async (club) => {
      const count = await db.collection('memberships').countDocuments({
        clubId: club._id.toString(),
        status: 'active'
      });
      return {
        clubId: club._id,
        clubName: club.clubName,
        memberCount: count
      };
    }));
    
    res.status(200).json({
      clubs: { total: totalClubs, approved: approvedClubs, pending: pendingClubs },
      members: { total: totalMembers, byClub: membersPerClub },
      events: { total: totalEvents, upcoming: upcomingEvents },
      revenue: { total: totalRevenue, payments: totalPaymentsCount }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching manager stats', error: error.message });
  }
});

// Member Dashboard Stats
router.get('/member/overview', verifyToken, verifyMember, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const totalClubsJoined = await db.collection('memberships').countDocuments({
      userEmail,
      status: 'active'
    });
    
    const totalEventsRegistered = await db.collection('eventRegistrations').countDocuments({
      userEmail,
      status: 'registered'
    });
    
    const paymentStats = await db.collection('payments').aggregate([
      { $match: { userEmail, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalPayments: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const totalSpent = paymentStats.length > 0 ? paymentStats[0].totalSpent : 0;
    const totalPaymentsCount = paymentStats.length > 0 ? paymentStats[0].totalPayments : 0;
    
    res.status(200).json({
      clubs: { joined: totalClubsJoined },
      events: { registered: totalEventsRegistered },
      payments: { totalSpent, totalPayments: totalPaymentsCount }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member stats', error: error.message });
  }
});

// Get featured/popular clubs (for home page)
router.get('/featured-clubs', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const clubs = await db.collection('clubs')
      .find({ status: 'approved' })
      .toArray();
    
    const clubsWithMembers = await Promise.all(clubs.map(async (club) => {
      const memberCount = await db.collection('memberships').countDocuments({
        clubId: club._id.toString(),
        status: 'active'
      });
      return { ...club, memberCount };
    }));
    
    const featuredClubs = clubsWithMembers
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 6);
    
    res.status(200).json(featuredClubs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching featured clubs', error: error.message });
  }
});

// Get upcoming events (for home page)
router.get('/upcoming-events', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const approvedClubs = await db.collection('clubs')
      .find({ status: 'approved' }, { projection: { _id: 1 } })
      .toArray();
    
    const approvedClubIds = approvedClubs.map(club => club._id.toString());
    
    const events = await db.collection('events')
      .find({
        clubId: { $in: approvedClubIds },
        eventDate: { $gte: new Date() }
      })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();
    
    const eventsWithClubs = await Promise.all(events.map(async (event) => {
      const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
      return {
        ...event,
        clubName: club?.clubName || 'Unknown'
      };
    }));
    
    res.status(200).json(eventsWithClubs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching upcoming events', error: error.message });
  }
});

module.exports = router;