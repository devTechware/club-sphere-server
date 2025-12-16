const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ObjectId } = require('mongodb');
const { verifyToken, verifyMember, verifyClubManager, verifyAdmin } = require('../middleware/auth');

// Create payment intent for club membership
router.post('/create-membership-payment', verifyToken, verifyMember, async (req, res) => {
  try {
    const { clubId } = req.body;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!clubId) {
      return res.status(400).json({ message: 'Club ID is required' });
    }
    
    const club = await db.collection('clubs').findOne({ _id: new ObjectId(clubId) });
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    if (club.membershipFee === 0) {
      return res.status(400).json({ message: 'This club has free membership' });
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(club.membershipFee * 100),
      currency: 'usd',
      metadata: {
        type: 'membership',
        clubId: clubId,
        clubName: club.clubName,
        userEmail: userEmail
      }
    });
    
    const paymentRecord = {
      userEmail,
      amount: club.membershipFee,
      type: 'membership',
      clubId,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
      createdAt: new Date()
    };
    
    await db.collection('payments').insertOne(paymentRecord);
    
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ message: 'Error creating payment intent', error: error.message });
  }
});

// Create payment intent for event registration
router.post('/create-event-payment', verifyToken, verifyMember, async (req, res) => {
  try {
    const { eventId } = req.body;
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }
    
    const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    if (!event.isPaid || event.eventFee === 0) {
      return res.status(400).json({ message: 'This event is free' });
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(event.eventFee * 100),
      currency: 'usd',
      metadata: {
        type: 'event',
        eventId: eventId,
        eventTitle: event.title,
        clubId: event.clubId,
        userEmail: userEmail
      }
    });
    
    const paymentRecord = {
      userEmail,
      amount: event.eventFee,
      type: 'event',
      eventId,
      clubId: event.clubId,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
      createdAt: new Date()
    };
    
    await db.collection('payments').insertOne(paymentRecord);
    
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ message: 'Error creating payment intent', error: error.message });
  }
});

// Confirm payment
router.post('/confirm-payment', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const db = req.app.locals.db;
    
    if (!paymentIntentId) {
      return res.status(400).json({ message: 'Payment intent ID is required' });
    }
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      await db.collection('payments').updateOne(
        { stripePaymentIntentId: paymentIntentId },
        { 
          $set: { 
            status: 'completed',
            completedAt: new Date()
          } 
        }
      );
      
      res.status(200).json({ 
        message: 'Payment confirmed successfully',
        status: 'succeeded'
      });
    } else {
      res.status(400).json({ 
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ message: 'Error confirming payment', error: error.message });
  }
});

// Get user's payment history
router.get('/my-payments', verifyToken, verifyMember, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userEmail = req.user.email;
    
    const payments = await db.collection('payments')
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();
    
    const paymentsWithDetails = await Promise.all(payments.map(async (payment) => {
      let details = {};
      
      if (payment.type === 'membership' && payment.clubId) {
        const club = await db.collection('clubs').findOne({ _id: new ObjectId(payment.clubId) });
        details.clubName = club?.clubName || 'Unknown';
      }
      
      if (payment.type === 'event' && payment.eventId) {
        const event = await db.collection('events').findOne({ _id: new ObjectId(payment.eventId) });
        const club = event ? await db.collection('clubs').findOne({ _id: new ObjectId(event.clubId) }) : null;
        details.eventTitle = event?.title || 'Unknown';
        details.clubName = club?.clubName || 'Unknown';
      }
      
      return { ...payment, ...details };
    }));
    
    res.status(200).json(paymentsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
});

// Get all payments (Admin only)
router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const payments = await db.collection('payments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    const paymentsWithDetails = await Promise.all(payments.map(async (payment) => {
      let details = {};
      
      if (payment.clubId) {
        const club = await db.collection('clubs').findOne({ _id: new ObjectId(payment.clubId) });
        details.clubName = club?.clubName || 'Unknown';
      }
      
      if (payment.eventId) {
        const event = await db.collection('events').findOne({ _id: new ObjectId(payment.eventId) });
        details.eventTitle = event?.title || 'Unknown';
      }
      
      return { ...payment, ...details };
    }));
    
    res.status(200).json(paymentsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
});

// Get payments for club manager's clubs
router.get('/my-clubs-payments', verifyToken, verifyClubManager, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const managerEmail = req.user.email;
    
    const clubs = await db.collection('clubs')
      .find({ managerEmail })
      .toArray();
    
    const clubIds = clubs.map(club => club._id.toString());
    
    const payments = await db.collection('payments')
      .find({ clubId: { $in: clubIds } })
      .sort({ createdAt: -1 })
      .toArray();
    
    const paymentsWithDetails = await Promise.all(payments.map(async (payment) => {
      const club = clubs.find(c => c._id.toString() === payment.clubId);
      let details = { clubName: club?.clubName || 'Unknown' };
      
      if (payment.eventId) {
        const event = await db.collection('events').findOne({ _id: new ObjectId(payment.eventId) });
        details.eventTitle = event?.title || 'Unknown';
      }
      
      return { ...payment, ...details };
    }));
    
    res.status(200).json(paymentsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
});

module.exports = router;