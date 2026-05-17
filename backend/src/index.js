require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/checkin-windows', require('./routes/checkinWindows'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/thrust-areas', require('./routes/thrustAreas'));
app.use('/api/goal-sheets', require('./routes/goalSheets'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/shared-goals', require('./routes/sharedGoals'));
app.use('/api/admin', require('./routes/admin'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
