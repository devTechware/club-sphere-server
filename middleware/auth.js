const admin = require('../config/firebase-admin');

// Verify Firebase Token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Verify Admin Role
const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.user.email;
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    req.userRole = user.role;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying admin role' });
  }
};

// Verify Club Manager Role
const verifyClubManager = async (req, res, next) => {
  try {
    const email = req.user.email;
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ email });
    
    if (!user || (user.role !== 'clubManager' && user.role !== 'admin')) {
      return res.status(403).json({ message: 'Access denied. Club Manager only.' });
    }
    
    req.userRole = user.role;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying club manager role' });
  }
};

// Verify Member Role
const verifyMember = async (req, res, next) => {
  try {
    const email = req.user.email;
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }
    
    req.userRole = user.role;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying user' });
  }
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyClubManager,
  verifyMember
};