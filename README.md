# 🔧 ClubSphere Server - Backend API

RESTful API for the ClubSphere club management platform built with Node.js, Express, and MongoDB.

## 🌐 Live API URL

**Production:** https://club-sphere-server-eight.vercel.app

----

## 📌 Purpose

Provides backend services for ClubSphere including:
- User authentication and authorization
- Club and event management
- Membership tracking
- Payment processing
- Statistics and analytics

---

## 🛠️ Technologies Used

### Core
- **Node.js 22.x** - Runtime environment
- **Express 4.21.2** - Web framework
- **MongoDB 6.12.0** - Database driver

### Authentication & Security
- **Firebase Admin SDK 13.0.2** - Token verification
- **CORS 2.8.5** - Cross-origin resource sharing
- **Dotenv 16.4.7** - Environment variable management

### Payment Processing
- **Stripe 17.4.0** - Payment gateway integration

### Development
- **Nodemon 3.1.10** - Auto-restart during development

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account
- Firebase Admin SDK credentials
- Stripe account (test mode)

### Environment Variables

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/clubSphere?retryWrites=true&w=majority

# Server
PORT=5000

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"

# Stripe
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

### Installation Steps
```bash
# Clone the repository
git clone https://github.com/devTechware/club-sphere-server.git
cd club-sphere-server

# Install dependencies
npm install

# Run development server
npm run dev

# Run production server
npm start
```

---

## 🗂️ Project Structure
```
club-sphere-server/
├── config/
│   └── firebase-admin.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── clubs.js
│   ├── eventRegistrations.js
│   ├── events.js
│   ├── memberships.js
│   ├── payments.js
│   ├── stats.js
│   ├── stripe.js
│   └── users.js
├── .env
├── .gitignore
├── index.js
├── package-lock.json
├── package.json
├── README.md
└── vercel.json

```

---

## 🔌 API Endpoints

### Authentication & Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | Token | Register/update user after Firebase auth |
| GET | `/api/users/profile` | Token | Get current user profile |
| PATCH | `/api/users/profile` | Token | Update user profile |
| GET | `/api/users` | Admin | Get all users |
| PATCH | `/api/users/role/:email` | Admin | Update user role |

### Clubs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/clubs` | Public | Get all approved clubs (with search/filter) |
| GET | `/api/clubs/:id` | Public | Get single club details |
| POST | `/api/clubs` | Token | Create new club |
| GET | `/api/clubs/admin/all` | Admin | Get all clubs (including pending) |
| PATCH | `/api/clubs/admin/:id/status` | Admin | Approve/reject club |

### Events

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events` | Public | Get all events (with search/sort) |
| GET | `/api/events/:id` | Public | Get single event details |
| POST | `/api/events` | Token | Create new event |

### Memberships

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/memberships/my-memberships` | Token | Get user's memberships |
| POST | `/api/memberships` | Token | Join a club |
| GET | `/api/memberships` | Token | Get all memberships |

### Event Registrations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/event-registrations/my-registrations` | Token | Get user's event registrations |
| POST | `/api/event-registrations` | Token | Register for event |

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/payments/my-payments` | Token | Get user's payment history |
| GET | `/api/payments/all` | Admin | Get all payments |
| POST | `/api/payments` | Token | Record a payment |

### Stripe

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/stripe/create-payment-intent` | Token | Create payment intent for membership |
| POST | `/api/stripe/create-event-payment-intent` | Token | Create payment intent for event |
| GET | `/api/stripe/config` | Public | Get Stripe publishable key |

### Statistics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/stats/featured-clubs` | Public | Get 6 featured clubs for homepage |
| GET | `/api/stats/upcoming-events` | Public | Get 6 upcoming events |
| GET | `/api/stats/admin` | Admin | Get admin dashboard statistics |
| GET | `/api/stats/manager` | Manager | Get manager dashboard statistics |
| GET | `/api/stats/member` | Token | Get member dashboard statistics |

---

## 🔐 Authentication & Authorization

### Middleware

1. **verifyToken** - Verifies Firebase JWT token
2. **verifyAdmin** - Checks if user has admin role
3. **verifyClubManager** - Checks if user has manager or admin role

### Request Flow
```
Client Request
    ↓
Authorization Header (Bearer token)
    ↓
Middleware verifies Firebase token
    ↓
Middleware checks user role in MongoDB
    ↓
Request proceeds to route handler
```

---

## 💾 Database Collections

### users
```javascript
{
  email: String,
  name: String,
  photoURL: String,
  role: String, // "member" | "clubManager" | "admin"
  createdAt: Date
}
```

### clubs
```javascript
{
  clubName: String,
  description: String,
  category: String,
  location: String,
  bannerImage: String,
  membershipFee: Number,
  status: String, // "pending" | "approved" | "rejected"
  managerEmail: String,
  createdAt: Date
}
```

### events
```javascript
{
  title: String,
  description: String,
  eventDate: Date,
  location: String,
  isPaid: Boolean,
  eventFee: Number,
  maxAttendees: Number,
  clubId: ObjectId,
  clubName: String,
  createdAt: Date
}
```

### memberships
```javascript
{
  clubId: ObjectId,
  userEmail: String,
  status: String, // "active" | "inactive"
  joinedAt: Date
}
```

### eventRegistrations
```javascript
{
  eventId: ObjectId,
  userEmail: String,
  registeredAt: Date
}
```

### payments
```javascript
{
  userEmail: String,
  type: String, // "membership" | "event"
  amount: Number,
  status: String, // "completed" | "pending" | "failed"
  stripePaymentIntentId: String,
  clubId: ObjectId,
  eventId: ObjectId,
  createdAt: Date
}
```

---

## 🚀 Deployment

### Deploy to Vercel

The project is configured for Vercel deployment with `vercel.json`.
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Environment Variables in Vercel:**
- Add all variables from `.env` in Vercel dashboard
- Go to Settings → Environment Variables

---

## 🧪 Testing

### Stripe Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Succeeds |
| 4000 0000 0000 9995 | Declined |
| 4000 0025 0000 3155 | Requires authentication |

---

## 🔒 Security Best Practices

- ✅ Environment variables for all sensitive data
- ✅ Firebase token verification on protected routes
- ✅ Role-based access control
- ✅ Input validation and sanitization
- ✅ MongoDB injection prevention
- ✅ CORS configuration
- ✅ Stripe secure payment handling

---

## 📝 License

MIT License - see LICENSE file for details.

---

## 👨‍💻 Author

**Rabin Khandakar**  
GitHub: [@devTechware](https://github.com/devTechware)

---

## 🔗 Related Links

- **Frontend Repository:** [https://github.com/devTechware/club-sphere](https://github.com/devTechware/club-sphere)
- **Live Frontend:** [https://club-sphere-psi.vercel.app](https://club-sphere-psi.vercel.app)

---

**🌟 Star this repo if you find it helpful!**