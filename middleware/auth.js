const admin = require("firebase-admin");

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };

    console.log("🔥 Initializing Firebase Admin...");
    console.log("Project ID:", serviceAccount.projectId);
    console.log("Client Email:", serviceAccount.clientEmail);
    console.log("Private Key:", serviceAccount.privateKey ? "✓ Present" : "✗ Missing");

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error);
    throw error;
  }
}

// Verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No token provided or invalid format");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split("Bearer ")[1];
    
    console.log("🔐 Verifying token...");
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("✅ Token verified for:", decodedToken.email);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);
    return res.status(401).json({ 
      message: "Invalid or expired token",
      error: error.message 
    });
  }
};

// Verify user is admin
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No token provided");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split("Bearer ")[1];

    console.log("🔐 Verifying admin token...");
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log("✅ Token verified for:", decodedToken.email);
    req.user = decodedToken;

    // Check if user is admin in database
    const db = req.app.locals.db;
    
    if (!db) {
      console.error("❌ Database not available in verifyAdmin");
      return res.status(500).json({ message: "Database connection error" });
    }

    console.log("🔍 Checking admin status in database...");
    const user = await db.collection("users").findOne({ email: decodedToken.email });

    if (!user) {
      console.log("❌ User not found in database:", decodedToken.email);
      return res.status(404).json({ message: "User not found in database" });
    }

    console.log("👤 User found:", user.email, "Role:", user.role);

    if (user.role !== "admin") {
      console.log("❌ Access denied - user is not admin");
      return res.status(403).json({ 
        message: "Access denied. Admin role required.",
        currentRole: user.role 
      });
    }

    console.log("✅ Admin access granted");
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error("❌ Admin verification error:", error);
    console.error("Error stack:", error.stack);
    return res.status(401).json({ 
      message: "Authorization failed",
      error: error.message 
    });
  }
};

// Verify user is club manager or admin
const verifyClubManager = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;

    const db = req.app.locals.db;
    const user = await db.collection("users").findOne({ email: decodedToken.email });

    if (!user) {
      return res.status(404).json({ message: "User not found in database" });
    }

    if (user.role !== "clubManager" && user.role !== "admin") {
      return res.status(403).json({ 
        message: "Access denied. Club Manager or Admin role required.",
        currentRole: user.role 
      });
    }

    req.userRole = user.role;
    next();
  } catch (error) {
    console.error("Club manager verification error:", error);
    return res.status(401).json({ 
      message: "Authorization failed",
      error: error.message 
    });
  }
};

module.exports = { verifyToken, verifyAdmin, verifyClubManager };