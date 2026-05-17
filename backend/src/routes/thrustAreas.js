const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM thrust_areas ORDER BY name');
  res.json(rows);
});

module.exports = router;
