# Setup
## Server
cd server && npm i && cp .env.example .env   # edit MONGO_URI / JWT_SECRET
npm run seed    # creates admin@hms.com / Admin@123
npm run dev
## Client
cd client && npm i && npm run dev   # http://localhost:5173
