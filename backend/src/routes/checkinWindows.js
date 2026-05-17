const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const CYCLE_YEAR = new Date().getFullYear();

// GET /api/checkin-windows/active — any authenticated user
router.get('/active', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM check_in_windows
     WHERE cycle_year=$1 AND opens_at <= CURRENT_DATE AND closes_at >= CURRENT_DATE
     ORDER BY opens_at DESC LIMIT 1`,
    [CYCLE_YEAR]
  );
  res.json(rows[0] || null);
});

// GET /api/checkin-windows — admin: all windows for current cycle
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM check_in_windows WHERE cycle_year=$1 ORDER BY opens_at`,
    [CYCLE_YEAR]
  );
  res.json(rows);
});

// PUT /api/checkin-windows/:id — admin: update opens_at / closes_at
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { opens_at, closes_at, label } = req.body;
  if (!opens_at || !closes_at) {
    return res.status(400).json({ error: 'opens_at and closes_at are required' });
  }
  if (new Date(opens_at) > new Date(closes_at)) {
    return res.status(400).json({ error: 'opens_at must be before closes_at' });
  }
  const { rows } = await pool.query(
    `UPDATE check_in_windows SET
       opens_at=$1, closes_at=$2, label=COALESCE($3, label)
     WHERE id=$4 AND cycle_year=$5 RETURNING *`,
    [opens_at, closes_at, label || null, req.params.id, CYCLE_YEAR]
  );
  if (!rows.length) return res.status(404).json({ error: 'Window not found' });
  res.json(rows[0]);
});

// PUT /api/checkin-windows/:id/activate — admin: set window as active now (demo shortcut)
router.put('/:id/activate', authenticate, requireRole('admin'), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const farFuture = `${CYCLE_YEAR + 2}-12-31`;
  const { rows } = await pool.query(
    `UPDATE check_in_windows SET opens_at=$1, closes_at=$2
     WHERE id=$3 AND cycle_year=$4 RETURNING *`,
    [today, farFuture, req.params.id, CYCLE_YEAR]
  );
  if (!rows.length) return res.status(404).json({ error: 'Window not found' });
  res.json(rows[0]);
});

module.exports = router;
