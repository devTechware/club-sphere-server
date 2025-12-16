const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyClubManager } = require('../middleware/auth');

// Get all events from approved clubs (public)
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { search, sort } = req.query;
    
    const approvedClubs = await db.collection('clubs')
      .find({ status: 'approved' }, { projection: { _id: 1 } })
      .toArray();
    
    const approvedClubIds = approvedClubs.map(club => club._id.toString());
    
    let query = { clubId: { $in: approvedClubIds } };
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    let sortOption = {};
    if (sort === 'newest') {
      sortOption.createdAt = -1;
    } else if (sort === 'oldest') {
      sortOption.createdAt = 1;
    } else if (sort === 'eventDate') {
      sortOption.eventDate = 1;
    } else {
      sortOption.eventDate = 1;
    }
    
    const events = await db.collection('events')
      .find(query)
      .sort(sortOption)
      .toArray();
    
    const eventsWithClubs = await Promise.all(events.map(async (event) => {
      const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
      const registrationCount = await db.collection('eventRegistrations').countDocuments({
        eventId: event._id.toString(),
        status: 'registered'
      });
      
      return {
        ...event,
        clubName: club?.clubName || 'Unknown',
        registrationCount
      };
    }));
    
    res.status(200).json(eventsWithClubs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

// Get single event by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
    
    const registrationCount = await db.collection('eventRegistrations').countDocuments({
      eventId: id,
      status: 'registered'
    });
    
    res.status(200).json({
      ...event,
      clubName: club?.clubName || 'Unknown',
      registrationCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', error: error.message });
  }
});

// Create a new event (Club Manager only)
router.post('/', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { clubId, title, description, eventDate, location, isPaid, eventFee, maxAttendees } = req.body;
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    if (!clubId || !title || !description || !eventDate || !location) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(clubId) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.managerEmail !== managerEmail && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'You can only create events for your own clubs' });
    }
    
    if (club.status !== 'approved') {
      return res.status(403).json({ message: 'Cannot create events for unapproved clubs' });
    }
    
    const newEvent = {
      clubId,
      title,
      description,
      eventDate: new Date(eventDate),
      location,
      isPaid: isPaid || false,
      eventFee: isPaid ? (eventFee || 0) : 0,
      maxAttendees: maxAttendees || null,
      createdAt: new Date()
    };
    
    const result = await db.collection('events').insertOne(newEvent);
    res.status(201).json({ message: 'Event created successfully', eventId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
});

// Update event
router.patch('/:id', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
    
    if (!club || (club.managerEmail !== userEmail && req.userRole !== 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const updateData = {};
    const allowedFields = ['title', 'description', 'eventDate', 'location', 'isPaid', 'eventFee', 'maxAttendees'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'eventDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });
    
    updateData.updatedAt = new Date();
    
    await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.status(200).json({ message: 'Event updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
});

// Delete event
router.delete('/:id', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
    
    if (!club || (club.managerEmail !== userEmail && req.userRole !== 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await db.collection('events').deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});

// Get events by club ID
router.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    const db = req.app.locals.db;
    
    const events = await db.collection('events')
      .find({ clubId })
      .sort({ eventDate: 1 })
      .toArray();
    
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const registrationCount = await db.collection('eventRegistrations').countDocuments({
        eventId: event._id.toString(),
        status: 'registered'
      });
      
      return { ...event, registrationCount };
    }));
    
    res.status(200).json(eventsWithCounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching club events', error: error.message });
  }
});

// Get events for manager's clubs
router.get('/manager/my-events', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    const clubs = await db.collection('clubs')
      .find({ managerEmail })
      .toArray();
    
    const clubIds = clubs.map(club => club._id.toString());
    
    const events = await db.collection('events')
      .find({ clubId: { $in: clubIds } })
      .sort({ eventDate: 1 })
      .toArray();
    
    const eventsWithDetails = await Promise.all(events.map(async (event) => {
      const club = clubs.find(c => c._id.toString() === event.clubId);
      const registrationCount = await db.collection('eventRegistrations').countDocuments({
        eventId: event._id.toString(),
        status: 'registered'
      });
      
      return {
        ...event,
        clubName: club?.clubName || 'Unknown',
        registrationCount
      };
    }));
    
    res.status(200).json(eventsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

module.exports = router;