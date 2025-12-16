const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyMember, verifyClubManager } = require('../middleware/auth');

// Join a club
router.post('/join', verifyToken, verifyMember, async (req, res) => {
  try {
    const { clubId, paymentId } = req.body;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!clubId) {
      return res.status(400).json({ message: 'Club ID is required' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(clubId) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.status !== 'approved') {
      return res.status(403).json({ message: 'Cannot join unapproved club' });
    }
    
    const existingMembership = await db.collection('memberships').findOne({
      userEmail,
      clubId,
      status: 'active'
    });
    
    if (existingMembership) {
      return res.status(400).json({ message: 'You are already a member of this club' });
    }
    
    if (club.membershipFee > 0 && !paymentId) {
      return res.status(400).json({ message: 'Payment required for this club' });
    }
    
    const newMembership = {
      userEmail,
      clubId,
      status: club.membershipFee > 0 ? (paymentId ? 'active' : 'pendingPayment') : 'active',
      paymentId: paymentId || null,
      joinedAt: new Date(),
      expiresAt: null
    };
    
    const result = await db.collection('memberships').insertOne(newMembership);
    
    res.status(201).json({
      message: 'Successfully joined the club',
      membershipId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error joining club', error: error.message });
  }
});

// Get user's memberships
router.get('/my-memberships', verifyToken, verifyMember, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const memberships = await db.collection('memberships')
      .find({ userEmail })
      .sort({ joinedAt: -1 })
      .toArray();
    
    const membershipsWithClubs = await Promise.all(memberships.map(async (membership) => {
      const club = await db.collection('clubs').findOne({ _id: new ObjectId(membership.clubId) });
      return {
        ...membership,
        club: club || null
      };
    }));
    
    res.status(200).json(membershipsWithClubs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching memberships', error: error.message });
  }
});

// Get members of a specific club
router.get('/club/:clubId', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { clubId } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(clubId) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.managerEmail !== userEmail && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const memberships = await db.collection('memberships')
      .find({ clubId })
      .sort({ joinedAt: -1 })
      .toArray();
    
    const membershipsWithUsers = await Promise.all(memberships.map(async (membership) => {
      const user = await db.collection('users').findOne({ email: membership.userEmail });
      return {
        ...membership,
        userName: user?.name || 'Unknown',
        userPhoto: user?.photoURL || ''
      };
    }));
    
    res.status(200).json(membershipsWithUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching club members', error: error.message });
  }
});

// Update membership status
router.patch('/:id/status', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid membership ID' });
    }
    
    if (!['active', 'expired', 'pendingPayment'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const membership = await db.collection('memberships').findOne({ _id: new ObjectId(id) });
    
    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(membership.clubId) });
    
    if (!club || (club.managerEmail !== userEmail && req.userRole !== 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await db.collection('memberships').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );
    
    res.status(200).json({ message: 'Membership status updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating membership status', error: error.message });
  }
});

// Check if user is member
router.get('/check/:clubId', verifyToken, async (req, res) => {
  try {
    const { clubId } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const membership = await db.collection('memberships').findOne({
      userEmail,
      clubId,
      status: 'active'
    });
    
    res.status(200).json({ isMember: !!membership });
  } catch (error) {
    res.status(500).json({ message: 'Error checking membership', error: error.message });
  }
});

// Cancel membership
router.delete('/:id', verifyToken, verifyMember, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid membership ID' });
    }
    
    const membership = await db.collection('memberships').findOne({ _id: new ObjectId(id) });
    
    if (!membership) {
      return res.status(404).json({ message: 'Membership not found' });
    }
    
    if (membership.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await db.collection('memberships').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled', cancelledAt: new Date() } }
    );
    
    res.status(200).json({ message: 'Membership cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling membership', error: error.message });
  }
});

module.exports = router;