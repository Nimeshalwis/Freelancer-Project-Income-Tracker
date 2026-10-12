import mongoose from 'mongoose';

export function getHealth(_req, res) {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ success: true, data: { status: 'ok', service: 'freelancer-project-income-tracker-api', database } });
}
