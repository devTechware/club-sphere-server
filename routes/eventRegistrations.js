const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyMember, verifyClubManager } = require('../middleware/auth');

// Register for an event
router.post('/register', verifyToken, verifyMember, async (req, res) => {
  try {
    const { eventId, paymentId } = req.body;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
    if (!club || club.status !== 'approved') {
      return res.status(403).json({ message: 'Cannot register for events of unapproved clubs' });
    }
    
    const existingRegistration = await db.collection('eventRegistrations').findOne({
      userEmail,
      eventId: eventId,
      status: 'registered'
    });
    
    if (existingRegistration) {
      return res.status(400).json({ message: 'You are already registered for this event' });
    }
    
    if (event.maxAttendees) {
      const registrationCount = await db.collection('eventRegistrations').countDocuments({
        eventId: eventId,
        status: 'registered'
      });
      
      if (registrationCount >= event.maxAttendees) {
        return res.status(400).json({ message: 'Event has reached maximum attendees' });
      }
    }
    
    if (event.isPaid && event.eventFee > 0 && !paymentId) {
      return res.status(400).json({ message: 'Payment required for this event' });
    }
    
    const newRegistration = {
      eventId: eventId,
      userEmail,
      clubId: event.clubId,
      status: 'registered',
      paymentId: paymentId || null,
      registeredAt: new Date()
    };
    
    const result = await db.collection('eventRegistrations').insertOne(newRegistration);
    
    res.status(201).json({
      message: 'Successfully registered for the event',
      registrationId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering for event', error: error.message });
  }
});

// Get user's event registrations
router.get('/my-registrations', verifyToken, verifyMember, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const registrations = await db.collection('eventRegistrations')
      .find({ userEmail })
      .sort({ registeredAt: -1 })
      .toArray();
    
    const registrationsWithDetails = await Promise.all(registrations.map(async (registration) => {
      const event = await db.collection('events').findOne({ _id: new ObjectId(registration.eventId) });
      const club = event ? await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) }) : null;
      
      return {
        ...registration,
        event: event || null,
        clubName: club?.clubName || 'Unknown'
      };
    }));
    
    res.status(200).json(registrationsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching registrations', error: error.message });
  }
});

// Get registrations for a specific event (Club Manager)
router.get('/event/:eventId', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const { eventId } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) });
    
    if (!club || (club.managerEmail !== userEmail && req.userRole !== 'admin')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const registrations = await db.collection('eventRegistrations')
      .find({ eventId: eventId })
      .sort({ registeredAt: -1 })
      .toArray();
    
    const registrationsWithUsers = await Promise.all(registrations.map(async (registration) => {
      const user = await db.collection('users').findOne({ email: registration.userEmail });
      return {
        ...registration,
        userName: user?.name || 'Unknown',
        userPhoto: user?.photoURL || ''
      };
    }));
    
    res.status(200).json(registrationsWithUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event registrations', error: error.message });
  }
});

// Cancel event registration
router.delete('/:id', verifyToken, verifyMember, async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid registration ID' });
    }
    
    const registration = await db.collection('eventRegistrations').findOne({ _id: new ObjectId(id) });
    
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    if (registration.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await db.collection('eventRegistrations').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled', cancelledAt: new Date() } }
    );
    
    res.status(200).json({ message: 'Registration cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling registration', error: error.message });
  }
});

// Check if user is registered for an event
router.get('/check/:eventId', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const registration = await db.collection('eventRegistrations').findOne({
      userEmail,
      eventId: eventId,
      status: 'registered'
    });
    
    res.status(200).json({ isRegistered: !!registration });
  } catch (error) {
    res.status(500).json({ message: 'Error checking registration', error: error.message });
  }
});

module.exports = router;