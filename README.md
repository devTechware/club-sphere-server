# ClubSphere Backend API

Backend server for ClubSphere - A membership and event management platform for local clubs.

## 🚀 Features

- **User Authentication**: Firebase Auth with JWT
- **Role-Based Access**: Admin, Club Manager, Member
- **Club Management**: CRUD with approval workflow
- **Event System**: Create and manage events
- **Membership Management**: Join clubs with payments
- **Stripe Integration**: Secure payment processing
- **Dashboard Stats**: Analytics for all user roles
- **Search & Filter**: Server-side search and sorting

## 🛠️ Tech Stack

- Node.js & Express
- MongoDB
- Firebase Admin SDK
- Stripe API
- JWT Authentication

## 📦 Installation
```bash
npm install
```

## 🔧 Configuration

Create a `.env` file:
```env
DATABASE_URL=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

## 🚀 Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/users/register` - Register new user

### Clubs
- `GET /api/clubs` - Get clubs (with search/filter/sort)
- `POST /api/clubs` - Create club
- `PATCH /api/clubs/:id` - Update club
- `DELETE /api/clubs/:id` - Delete club

### Events
- `GET /api/events` - Get events
- `POST /api/events` - Create event
- `PATCH /api/events/:id` - Update event

### Memberships
- `POST /api/memberships/join` - Join club
- `GET /api/memberships/my-memberships` - Get user memberships

### Payments
- `POST /api/payments/create-membership-payment` - Create payment
- `GET /api/payments/my-payments` - Get payment history

### Statistics
- `GET /api/stats/admin/overview` - Admin dashboard
- `GET /api/stats/manager/overview` - Manager dashboard
- `GET /api/stats/member/overview` - Member dashboard

## 📝 Project Structure
```
club-sphere-server/
├── config/
│   └── firebase-admin.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── users.js
│   ├── clubs.js
│   ├── events.js
│   ├── memberships.js
│   ├── eventRegistrations.js
│   ├── payments.js
│   └── stats.js
├── index.js
└── package.json
```

## 🔒 Security Features

- Firebase token verification
- Role-based access control
- Environment variable protection
- Secure payment processing

## 📄 License

MIT