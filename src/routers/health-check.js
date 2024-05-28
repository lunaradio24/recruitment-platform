import express from 'express';

const router = express.Router();

router.get('/health-check', (req, res, next) => {
  return res.status(200).json({ statusCode: 200 });
});

export default router;
