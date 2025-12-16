const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin, verifyClubManager } = require('../middleware/auth');

// Get all approved clubs (public) with search/filter/sort
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, category, sort } = req.query;
    
    let query = { status: 'approved' };
    
    // Search by club name
    if (search) {
      query.clubName = { $regex: search, $options: 'i' };
    }
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Sorting
    let sortOption = {};
    if (sort === 'newest') {
      sortOption.createdAt = -1;
    } else if (sort === 'oldest') {
      sortOption.createdAt = 1;
    } else if (sort === 'highestFee') {
      sortOption.membershipFee = -1;
    } else if (sort === 'lowestFee') {
      sortOption.membershipFee = 1;
    } else {
      sortOption.createdAt = -1;
    }
    
    const clubs = await db.collection('clubs')
      .find(query)
      .sort(sortOption)
      .toArray();
    
    res.status(200).json(clubs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clubs', error: error.message });
  }
});

// Get single club by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(id) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    const memberCount = await db.collection('memberships').countDocuments({
      clubId: id,
      status: 'active'
    });
    
    const eventCount = await db.collection('events').countDocuments({
      clubId: id
    });
    
    res.status(200).json({ ...club, memberCount, eventCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching club', error: error.message });
  }
});

// Create a new club (Club Manager only)
router.post('/', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { clubName, description, category, location, bannerImage, membershipFee } = req.body;
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    if (!clubName || !description || !category || !location) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const newClub = {
      clubName,
      description,
      category,
      location,
      bannerImage: bannerImage || '',
      membershipFee: membershipFee || 0,
      status: 'pending',
      managerEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('clubs').insertOne(newClub);
    res.status(201).json({ message: 'Club created successfully. Waiting for admin approval.', clubId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: 'Error creating club', error: error.message });
  }
});

// Update club (Club Manager - own clubs only)
router.patch('/:id', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(id) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.managerEmail !== userEmail && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const updateData = {};
    const allowedFields = ['clubName', 'description', 'category', 'location', 'bannerImage', 'membershipFee'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    updateData.updatedAt = new Date();
    
    await db.collection('clubs').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.status(200).json({ message: 'Club updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating club', error: error.message });
  }
});

// Delete club (Club Manager - own clubs only)
router.delete('/:id', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(id) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.managerEmail !== userEmail && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await db.collection('clubs').deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: 'Club deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting club', error: error.message });
  }
});

// Get clubs by manager (Club Manager)
router.get('/manager/my-clubs', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    const clubs = await db.collection('clubs')
      .find({ managerEmail })
      .sort({ createdAt: -1 })
      .toArray();
    
    const clubsWithCounts = await Promise.all(clubs.map(async (club) => {
      const memberCount = await db.collection('memberships').countDocuments({
        clubId: club._id.toString(),
        status: 'active'
      });
      
      const eventCount = await db.collection('events').countDocuments({
        clubId: club._id.toString()
      });
      
      return { ...club, memberCount, eventCount };
    }));
    
    res.status(200).json(clubsWithCounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clubs', error: error.message });
  }
});

// Get all clubs with any status (Admin only)
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const clubs = await db.collection('clubs').find({}).sort({ createdAt: -1 }).toArray();
    
    const clubsWithCounts = await Promise.all(clubs.map(async (club) => {
      const memberCount = await db.collection('memberships').countDocuments({
        clubId: club._id.toString(),
        status: 'active'
      });
      
      const eventCount = await db.collection('events').countDocuments({
        clubId: club._id.toString()
      });
      
      return { ...club, memberCount, eventCount };
    }));
    
    res.status(200).json(clubsWithCounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clubs', error: error.message });
  }
});

// Approve or reject club (Admin only)
router.patch('/admin/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const db = req.app.locals.db;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const result = await db.collection('clubs').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    res.status(200).json({ message: `Club ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error updating club status', error: error.message });
  }
});

module.exports = router;