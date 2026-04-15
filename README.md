# NotURL Authentication Service

Production-ready authentication backend using Node.js, Express, MongoDB, OTP email verification, JWT, and Google login.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- dotenv
- bcryptjs
- jsonwebtoken
- Resend
- google-auth-library

## Folder Structure

```text
.
|-- config/
|   |-- db.js
|   |-- env.js
|-- controllers/
|   |-- authController.js
|   |-- userController.js
|-- middleware/
|   |-- authMiddleware.js
|   |-- errorMiddleware.js
|   |-- rateLimiter.js
|   |-- validateRequest.js
|-- models/
|   |-- OTP.js
|   |-- User.js
|-- routes/
|   |-- authRoutes.js
|   |-- userRoutes.js
|-- utils/
|   |-- apiError.js
|   |-- asyncHandler.js
|   |-- emailService.js
|   |-- generateToken.js
|   |-- otp.js
|-- app.js
|-- server.js
|-- .env.example
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill values.

3. Start in development mode:

```bash
npm run dev
```

4. Start in production mode:

```bash
npm start
```

## API Endpoints

### Auth

- `POST /api/auth/send-otp`
  - Body: `{ "email": "user@example.com" }`
- `POST /api/auth/verify-otp`
  - Body: `{ "email": "user@example.com", "otp": "123456" }`
- `POST /api/auth/signup`
  - Body: `{ "name": "Surya Vikas", "email": "user@example.com", "phone": "+919876543210", "password": "strongPassword123", "acceptedTerms": true }`
- `POST /api/auth/login`
  - Body: `{ "email": "user@example.com", "password": "strongPassword123" }`
- `POST /api/auth/google-login`
  - Body: `{ "token": "google_id_token" }` (also accepts `idToken`)

### Protected

- `GET /api/profile`
  - Header: `Authorization: Bearer <jwt_token>`

### Health

- `GET /api/health`

## Security Features

- Password hashing with `bcryptjs`
- JWT-based authentication
- Route protection middleware
- OTP expiration (5 minutes)
- OTP hash stored in DB
- Basic auth rate limiting
- Helmet security headers
- Centralized input validation and error handling
