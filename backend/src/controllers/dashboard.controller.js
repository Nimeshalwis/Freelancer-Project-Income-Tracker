import Client from '../models/Client.js';
import Project from '../models/Project.js';
import Payment from '../models/Payment.js';
import { ApiError } from '../utils/ApiError.js';
import { centsExpression, fromCents } from '../utils/money.js';
import { PROJECT_STATUSES } from '../utils/projectFilters.js';

export async function getSummary(req, res) {
  const user = req.user._id;
  const [projectTotals, incomeTotals, totalClients] = await Promise.all([
    Project.aggregate([
      { $match: { user } },
      { $lookup: {
        from: Payment.collection.name,
        let: { projectId: '$_id' },
        pipeline: [
          { $match: { user, $expr: { $eq: ['$project', '$$projectId'] } } },
          { $group: { _id: null, paid: { $sum: centsExpression('$amount') } } },
        ],
        as: 'payments',
      } },
      { $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        activeProjects: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        value: { $sum: centsExpression('$fee') },
        pending: { $sum: { $max: [0, { $subtract: [centsExpression('$fee'), { $ifNull: [{ $arrayElemAt: ['$payments.paid', 0] }, 0] }] }] } },
      } },
    ]),
    Payment.aggregate([{ $match: { user } }, { $group: { _id: null, income: { $sum: centsExpression('$amount') } } }]),
    Client.countDocuments({ user }),
  ]);
  const projects = projectTotals[0];
  res.json({ success: true, data: {
    totalIncome: fromCents(incomeTotals[0]?.income || 0),
    totalProjectValue: fromCents(projects?.value || 0),
    pendingPayments: fromCents(projects?.pending || 0),
    activeProjects: projects?.activeProjects || 0,
    totalClients,
    totalProjects: projects?.totalProjects || 0,
  } });
}

export async function getMonthlyIncome(req, res) {
  const { year } = req.query;
  if (Object.keys(req.query).some((key) => key !== 'year') || (year !== undefined && (typeof year !== 'string' || !/^[1-9]\d{3}$/.test(year) || Number(year) > 9998))) {
    throw new ApiError(400, 'Use an optional single year parameter between 1000 and 9998.');
  }
  const pipeline = [{ $match: { user: req.user._id } }];
  if (year !== undefined) pipeline.push({ $match: { paymentDate: { $gte: new Date(`${year}-01-01T00:00:00.000Z`), $lt: new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`) } } });
  pipeline.push(
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'UTC' } },
      income: { $sum: centsExpression('$amount') },
      paymentCount: { $sum: 1 },
    } },
    { $sort: { _id: 1 } },
  );
  const rows = (await Payment.aggregate(pipeline)).map((row) => ({ month: row._id, totalIncome: fromCents(row.income), paymentCount: row.paymentCount }));
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  const data = year === undefined ? rows : Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    return byMonth.get(month) || { month, totalIncome: 0, paymentCount: 0 };
  });
  res.json({ success: true, data });
}

export async function getProjectStatus(req, res) {
  const rows = await Project.aggregate([{ $match: { user: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  res.json({ success: true, data: PROJECT_STATUSES.map((status) => ({ status, count: counts.get(status) || 0 })) });
}
