require('dotenv').config();
const express = require('express');
const cors = require('cors');
const migrate = require('./db/migrate');
const seed = require('./db/seed');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/checkin-windows', require('./routes/checkinWindows'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/thrust-areas', require('./routes/thrustAreas'));
app.use('/api/goal-sheets', require('./routes/goalSheets'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/shared-goals', require('./routes/sharedGoals'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/analytics', require('./routes/analytics'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await migrate();
  await seed();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    require('./jobs/escalationJob').start();
  });
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
