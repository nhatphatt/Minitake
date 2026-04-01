import { Hono } from 'hono';
import type { Env } from '../types';
import { verifyToken, createToken } from '../middleware/auth';
import { verifyPassword, generateId } from '../utils/crypto';

const app = new Hono<{ Bindings: Env; Variables: { superAdmin: any } }>();

// Super admin auth middleware
async function superAdminAuth(c: any, next: any) {
	const authHeader = c.req.header('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ detail: 'Missing or invalid authorization header' }, 401);
	}
	try {
		const decoded = await verifyToken(authHeader.slice(7), c.env.JWT_SECRET);
		if (decoded.role !== 'super_admin') {
			return c.json({ detail: 'Invalid token type' }, 401);
		}
		const admin = await c.env.DB.prepare(
			'SELECT super_admin_id, email, name, is_active, last_login_at, created_at FROM super_admins WHERE super_admin_id = ?'
		).bind(decoded.sub).first();
		if (!admin) return c.json({ detail: 'Super Admin not found' }, 401);
		if (!admin.is_active) return c.json({ detail: 'Account is deactivated' }, 401);
		c.set('superAdmin', admin);
		await next();
	} catch (e: any) {
		const msg = e.message?.includes('expired') ? 'Token expired' : 'Invalid token';
		return c.json({ detail: msg }, 401);
	}
}

// POST /login
app.post('/login', async (c) => {
	try {
		const { email, password } = await c.req.json();
		const admin = await c.env.DB.prepare('SELECT * FROM super_admins WHERE email = ?').bind(email).first();
		if (!admin) return c.json({ detail: 'Invalid email or password' }, 401);
		if (!admin.is_active) return c.json({ detail: 'Account is deactivated' }, 401);

		const valid = await verifyPassword(password, admin.password_hash as string);
		if (!valid) return c.json({ detail: 'Invalid email or password' }, 401);

		const now = new Date().toISOString();
		await c.env.DB.prepare('UPDATE super_admins SET last_login_at = ? WHERE super_admin_id = ?').bind(now, admin.super_admin_id).run();

		const token = await createToken(
			{ sub: admin.super_admin_id as string, email: admin.email as string, role: 'super_admin', store_id: '' },
			c.env.JWT_SECRET
		);

		return c.json({
			access_token: token,
			token_type: 'bearer',
			user: {
				super_admin_id: admin.super_admin_id,
				email: admin.email,
				name: admin.name,
				is_active: admin.is_active,
				last_login_at: now,
				created_at: admin.created_at,
			},
		});
	} catch (e: any) {
		return c.json({ detail: 'Login failed' }, 500);
	}
});

// GET /dashboard
app.get('/dashboard', superAdminAuth, async (c) => {
	try {
		const db = c.env.DB;

		const [
			storeCount, userCount, activeSubCount, revenueRow,
			proStores, starterStores,
			orderCount, todayOrders, todayRevenue,
			recentStores, topStores,
			menuItemCount,
		] = await Promise.all([
			db.prepare('SELECT COUNT(*) as cnt FROM stores').first<{ cnt: number }>(),
			db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>(),
			db.prepare("SELECT COUNT(*) as cnt FROM subscriptions WHERE status IN ('active','trial')").first<{ cnt: number }>(),
			db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM subscription_payments WHERE status = 'paid'").first<{ total: number }>(),
			db.prepare("SELECT COUNT(*) as cnt FROM stores WHERE plan_id = 'pro'").first<{ cnt: number }>(),
			db.prepare("SELECT COUNT(*) as cnt FROM stores WHERE plan_id = 'starter' OR plan_id IS NULL").first<{ cnt: number }>(),
			db.prepare('SELECT COUNT(*) as cnt FROM orders').first<{ cnt: number }>(),
			db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now')").first<{ cnt: number }>(),
			db.prepare("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE date(created_at) = date('now')").first<{ total: number }>(),
			db.prepare("SELECT s.id, s.name, s.slug, s.plan_id, s.created_at, u.email as owner_email, (SELECT COUNT(*) FROM menu_items WHERE store_id = s.id) as menu_count, (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as order_count FROM stores s LEFT JOIN users u ON u.store_id = s.id ORDER BY s.created_at DESC LIMIT 10").all(),
			db.prepare("SELECT s.id, s.name, s.slug, s.plan_id, COUNT(o.id) as order_count, COALESCE(SUM(o.total),0) as revenue FROM stores s LEFT JOIN orders o ON o.store_id = s.id GROUP BY s.id ORDER BY revenue DESC LIMIT 5").all(),
			db.prepare('SELECT COUNT(*) as cnt FROM menu_items').first<{ cnt: number }>(),
		]);

		// Orders by day (last 7 days)
		const ordersByDay = await db.prepare(
			"SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(total),0) as revenue FROM orders WHERE created_at >= datetime('now', '-7 days') GROUP BY date(created_at) ORDER BY day ASC"
		).all();

		// Stores created by day (last 30 days)
		const storesByDay = await db.prepare(
			"SELECT date(created_at) as day, COUNT(*) as count FROM stores WHERE created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY day ASC"
		).all();

		return c.json({
			total_stores: storeCount?.cnt || 0,
			total_users: userCount?.cnt || 0,
			active_subscriptions: activeSubCount?.cnt || 0,
			total_revenue: revenueRow?.total || 0,
			pro_stores: proStores?.cnt || 0,
			starter_stores: starterStores?.cnt || 0,
			total_orders: orderCount?.cnt || 0,
			today_orders: todayOrders?.cnt || 0,
			today_revenue: todayRevenue?.total || 0,
			total_menu_items: menuItemCount?.cnt || 0,
			recent_stores: recentStores.results ?? [],
			top_stores: topStores.results ?? [],
			orders_by_day: ordersByDay.results ?? [],
			stores_by_day: storesByDay.results ?? [],
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get dashboard data: ' + e.message }, 500);
	}
});

// GET /stores
app.get('/stores', superAdminAuth, async (c) => {
	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;

		const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM stores').first<{ cnt: number }>();
		const total = totalRow?.cnt || 0;

		const { results } = await c.env.DB.prepare(
			'SELECT * FROM stores ORDER BY created_at DESC LIMIT ? OFFSET ?'
		).bind(limit, offset).all();

		return c.json({
			stores: results || [],
			total,
			page,
			limit,
			total_pages: Math.ceil(total / limit),
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get stores' }, 500);
	}
});

// GET /stores/:store_id — full detail
app.get('/stores/:store_id', superAdminAuth, async (c) => {
	try {
		const db = c.env.DB;
		const storeId = c.req.param('store_id');
		const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first();
		if (!store) return c.json({ detail: 'Store not found' }, 404);

		const [owner, subscription, menuCount, categoryCount, tableCount, orderCount, totalRevenue, recentOrders, tables, promotionCount, settings] = await Promise.all([
			db.prepare('SELECT id, email, name, role, created_at FROM users WHERE store_id = ?').bind(storeId).first(),
			db.prepare("SELECT * FROM subscriptions WHERE store_id = ? AND status IN ('active','trial') LIMIT 1").bind(storeId).first(),
			db.prepare('SELECT COUNT(*) as cnt FROM menu_items WHERE store_id = ?').bind(storeId).first<{cnt:number}>(),
			db.prepare('SELECT COUNT(*) as cnt FROM categories WHERE store_id = ?').bind(storeId).first<{cnt:number}>(),
			db.prepare('SELECT COUNT(*) as cnt FROM tables WHERE store_id = ?').bind(storeId).first<{cnt:number}>(),
			db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE store_id = ?').bind(storeId).first<{cnt:number}>(),
			db.prepare("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE store_id = ?").bind(storeId).first<{total:number}>(),
			db.prepare('SELECT id, table_number, customer_name, total, status, payment_status, created_at FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 5').bind(storeId).all(),
			db.prepare('SELECT id, table_number, capacity, status FROM tables WHERE store_id = ? ORDER BY CAST(table_number AS INTEGER) ASC').bind(storeId).all(),
			db.prepare('SELECT COUNT(*) as cnt FROM promotions WHERE store_id = ?').bind(storeId).first<{cnt:number}>(),
			db.prepare('SELECT * FROM store_settings WHERE store_id = ?').bind(storeId).first().catch(() => null),
		]);

		return c.json({
			...store,
			owner: owner || null,
			subscription: subscription || null,
			stats: {
				menu_items: menuCount?.cnt || 0,
				categories: categoryCount?.cnt || 0,
				tables: tableCount?.cnt || 0,
				orders: orderCount?.cnt || 0,
				total_revenue: totalRevenue?.total || 0,
				promotions: promotionCount?.cnt || 0,
			},
			recent_orders: recentOrders.results ?? [],
			tables: tables.results ?? [],
			settings: settings || null,
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get store details: ' + e.message }, 500);
	}
});

// PUT /stores/:store_id/suspend
app.put('/stores/:store_id/suspend', superAdminAuth, async (c) => {
	try {
		const storeId = c.req.param('store_id');
		const body = await c.req.json().catch(() => ({}));
		const reason = body.reason || null;
		const now = new Date().toISOString();

		const store = await c.env.DB.prepare('SELECT id FROM stores WHERE id = ?').bind(storeId).first();
		if (!store) return c.json({ detail: 'Store not found' }, 404);

		await c.env.DB.prepare(
			'UPDATE stores SET is_suspended = 1, suspended_reason = ?, suspended_at = ?, updated_at = ? WHERE id = ?'
		).bind(reason, now, now, storeId).run();

		return c.json({ success: true, message: 'Store suspended successfully' });
	} catch (e: any) {
		return c.json({ detail: 'Failed to suspend store' }, 500);
	}
});

// PUT /stores/:store_id/activate
app.put('/stores/:store_id/activate', superAdminAuth, async (c) => {
	try {
		const storeId = c.req.param('store_id');
		const now = new Date().toISOString();

		const store = await c.env.DB.prepare('SELECT id FROM stores WHERE id = ?').bind(storeId).first();
		if (!store) return c.json({ detail: 'Store not found' }, 404);

		await c.env.DB.prepare(
			'UPDATE stores SET is_suspended = 0, suspended_reason = NULL, suspended_at = NULL, updated_at = ? WHERE id = ?'
		).bind(now, storeId).run();

		return c.json({ success: true, message: 'Store activated successfully' });
	} catch (e: any) {
		return c.json({ detail: 'Failed to activate store' }, 500);
	}
});

// GET /subscriptions
app.get('/subscriptions', superAdminAuth, async (c) => {
	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;

		const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM subscriptions').first<{ cnt: number }>();
		const total = totalRow?.cnt || 0;

		const { results } = await c.env.DB.prepare(
			'SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT ? OFFSET ?'
		).bind(limit, offset).all();

		return c.json({ subscriptions: results || [], total, page, limit, total_pages: Math.ceil(total / limit) });
	} catch (e: any) {
		return c.json({ detail: 'Failed to get subscriptions' }, 500);
	}
});

// GET /payments
app.get('/payments', superAdminAuth, async (c) => {
	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;
		const status = c.req.query('status');

		let countSql = 'SELECT COUNT(*) as cnt FROM subscription_payments';
		let dataSql = 'SELECT * FROM subscription_payments';
		const binds: any[] = [];

		if (status) {
			countSql += ' WHERE status = ?';
			dataSql += ' WHERE status = ?';
			binds.push(status);
		}

		dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

		const totalRow = await c.env.DB.prepare(countSql).bind(...binds).first<{ cnt: number }>();
		const total = totalRow?.cnt || 0;

		const { results } = await c.env.DB.prepare(dataSql).bind(...binds, limit, offset).all();

		return c.json({ payments: results || [], total, page, limit, total_pages: Math.ceil(total / limit) });
	} catch (e: any) {
		return c.json({ detail: 'Failed to get payments' }, 500);
	}
});

// GET /finance/revenue
app.get('/finance/revenue', superAdminAuth, async (c) => {
	try {
		const db = c.env.DB;
		const period = c.req.query('period') || 'month';
		const startParam = c.req.query('start');
		const endParam = c.req.query('end');

		// Build time-series grouping and window
		let groupBy: string;
		let windowFilter: string;
		let windowFilterPrev: string;
		let limit = 12;
		const now = new Date();

		if (period === 'day') {
			groupBy = "strftime('%Y-%m-%d', created_at)";
			const from = new Date(now); from.setUTCDate(from.getUTCDate() - 29); from.setUTCHours(0,0,0,0);
			const prevFrom = new Date(from); prevFrom.setUTCDate(prevFrom.getUTCDate() - 30);
			windowFilter = `created_at >= '${from.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevFrom.toISOString()}' AND created_at < '${from.toISOString()}'`;
			limit = 30;
		} else if (period === 'week') {
			groupBy = "strftime('%Y-W%W', created_at)";
			const from = new Date(now); from.setUTCDate(from.getUTCDate() - 83); from.setUTCHours(0,0,0,0);
			const prevFrom = new Date(from); prevFrom.setUTCDate(prevFrom.getUTCDate() - 84);
			windowFilter = `created_at >= '${from.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevFrom.toISOString()}' AND created_at < '${from.toISOString()}'`;
			limit = 12;
		} else if (period === 'month') {
			groupBy = "strftime('%Y-%m', created_at)";
			const from = new Date(now); from.setUTCMonth(from.getUTCMonth() - 11); from.setUTCDate(1); from.setUTCHours(0,0,0,0);
			const prevFrom = new Date(from); prevFrom.setUTCMonth(prevFrom.getUTCMonth() - 12);
			windowFilter = `created_at >= '${from.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevFrom.toISOString()}' AND created_at < '${from.toISOString()}'`;
			limit = 12;
		} else if (period === 'quarter') {
			groupBy = "strftime('%Y', created_at) || '-Q' || CAST((CAST(strftime('%m', created_at) AS INTEGER) + 2) / 3 AS TEXT)";
			const from = new Date(now); from.setUTCMonth(from.getUTCMonth() - 23); from.setUTCDate(1); from.setUTCHours(0,0,0,0);
			const prevFrom = new Date(from); prevFrom.setUTCMonth(prevFrom.getUTCMonth() - 24);
			windowFilter = `created_at >= '${from.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevFrom.toISOString()}' AND created_at < '${from.toISOString()}'`;
			limit = 8;
		} else if (period === 'year') {
			groupBy = "strftime('%Y', created_at)";
			const from = new Date(now); from.setUTCFullYear(from.getUTCFullYear() - 4); from.setUTCMonth(0); from.setUTCDate(1); from.setUTCHours(0,0,0,0);
			const prevFrom = new Date(from); prevFrom.setUTCFullYear(prevFrom.getUTCFullYear() - 5);
			windowFilter = `created_at >= '${from.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevFrom.toISOString()}' AND created_at < '${from.toISOString()}'`;
			limit = 5;
		} else if (period === 'range' && startParam && endParam) {
			groupBy = "strftime('%Y-%m-%d', created_at)";
			const start = new Date(startParam); start.setUTCHours(0,0,0,0);
			const end = new Date(endParam); end.setUTCHours(23,59,59,999);
			const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
			const prevStart = new Date(start.getTime() - rangeDays * 86400000);
			windowFilter = `created_at >= '${start.toISOString()}' AND created_at <= '${end.toISOString()}'`;
			windowFilterPrev = `created_at >= '${prevStart.toISOString()}' AND created_at < '${start.toISOString()}'`;
			limit = 366;
		} else {
			return c.json({ detail: 'Invalid period. Use: day, week, month, quarter, year, range' }, 400);
		}

		const [timeSeries, summary, summaryPrev, byPlan] = await Promise.all([
			db.prepare(
				`SELECT ${groupBy} as period_key, SUM(amount) as total_amount, COUNT(*) as payment_count
				 FROM subscription_payments WHERE ${windowFilter}
				 GROUP BY period_key ORDER BY period_key ASC LIMIT ${limit}`
			).all(),
			db.prepare(
				`SELECT
					COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_revenue,
					COUNT(*) as total_transactions,
					SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
					SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
					SUM(CASE WHEN status NOT IN ('paid','pending') THEN 1 ELSE 0 END) as failed_count
				 FROM subscription_payments WHERE ${windowFilter}`
			).first<any>(),
			db.prepare(
				`SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_revenue
				 FROM subscription_payments WHERE ${windowFilterPrev}`
			).first<any>(),
			db.prepare(
				`SELECT sp.plan_id, COALESCE(SUM(sub.amount), 0) as total, COUNT(*) as count
				 FROM subscription_payments sub
				 LEFT JOIN subscriptions sp ON sp.subscription_id = sub.subscription_id
				 WHERE sub.status = 'paid' AND sub.${windowFilter}
				 GROUP BY sp.plan_id`
			).all().catch(() => ({ results: [] })),
		]);

		const currentRevenue = summary?.total_revenue || 0;
		const prevRevenue = summaryPrev?.total_revenue || 0;
		const growthPct = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : null;

		return c.json({
			period,
			summary: {
				total_revenue: currentRevenue,
				total_transactions: summary?.total_transactions || 0,
				paid_count: summary?.paid_count || 0,
				pending_count: summary?.pending_count || 0,
				failed_count: summary?.failed_count || 0,
				growth_pct: growthPct !== null ? Math.round(growthPct * 10) / 10 : null,
			},
			breakdown_by_plan: byPlan.results || [],
			data: timeSeries.results || [],
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get revenue data: ' + e.message }, 500);
	}
});

// GET /finance/transactions
app.get('/finance/transactions', superAdminAuth, async (c) => {
	try {
		const db = c.env.DB;
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;
		const status = c.req.query('status');
		const search = c.req.query('search');
		const sort = c.req.query('sort') === 'asc' ? 'ASC' : 'DESC';

		const conditions: string[] = [];
		const binds: any[] = [];

		if (status) {
			conditions.push('sp.status = ?');
			binds.push(status);
		}
		if (search) {
			conditions.push('(s.name LIKE ? OR u.email LIKE ?)');
			binds.push(`%${search}%`, `%${search}%`);
		}

		const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

		const baseJoin = `FROM subscription_payments sp
			LEFT JOIN stores s ON s.id = sp.store_id
			LEFT JOIN users u ON u.store_id = sp.store_id`;

		const [totalRow, rows] = await Promise.all([
			db.prepare(`SELECT COUNT(*) as cnt ${baseJoin} ${where}`).bind(...binds).first<{ cnt: number }>(),
			db.prepare(
				`SELECT sp.*,
					s.name as store_name,
					s.slug as store_slug,
					s.plan_id,
					u.email as owner_email
				 ${baseJoin} ${where}
				 ORDER BY sp.created_at ${sort}
				 LIMIT ? OFFSET ?`
			).bind(...binds, limit, offset).all(),
		]);

		return c.json({
			transactions: rows.results || [],
			total: totalRow?.cnt || 0,
			page,
			limit,
			total_pages: Math.ceil((totalRow?.cnt || 0) / limit),
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get transactions: ' + e.message }, 500);
	}
});

// GET /users
app.get('/users', superAdminAuth, async (c) => {
	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;
		const search = c.req.query('search');
		const role = c.req.query('role');

		let where = "WHERE role != 'super_admin'";
		const binds: any[] = [];

		if (role) {
			where = 'WHERE role = ?';
			binds.push(role);
		}
		if (search) {
			where += ' AND (email LIKE ? OR name LIKE ?)';
			binds.push(`%${search}%`, `%${search}%`);
		}

		const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM users ${where}`).bind(...binds).first<{ cnt: number }>();
		const total = totalRow?.cnt || 0;

		const { results } = await c.env.DB.prepare(
			`SELECT id, email, name, role, store_id, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
		).bind(...binds, limit, offset).all();

		// Get store names
		const users = [];
		for (const u of (results || [])) {
			const user: any = { ...u };
			if (user.store_id) {
				const store = await c.env.DB.prepare('SELECT name, plan_id FROM stores WHERE id = ?').bind(user.store_id).first();
				user.store_name = store?.name || null;
				user.plan_id = store?.plan_id || 'starter';
			}
			users.push(user);
		}

		return c.json({ users, total, page, limit, total_pages: Math.ceil(total / limit) });
	} catch (e: any) {
		return c.json({ detail: 'Failed to get users' }, 500);
	}
});

// GET /users/:user_id
app.get('/users/:user_id', superAdminAuth, async (c) => {
	try {
		const userId = c.req.param('user_id');
		const user: any = await c.env.DB.prepare(
			'SELECT id, email, name, role, store_id, created_at FROM users WHERE id = ?'
		).bind(userId).first();
		if (!user) return c.json({ detail: 'User not found' }, 404);

		if (user.store_id) {
			const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(user.store_id).first();
			user.store = store || null;
		}
		return c.json(user);
	} catch (e: any) {
		return c.json({ detail: 'Failed to get user details' }, 500);
	}
});

// PUT /users/:user_id/status
app.put('/users/:user_id/status', superAdminAuth, async (c) => {
	try {
		const userId = c.req.param('user_id');
		const body = await c.req.json();
		const newStatus = body.status;

		if (!['active', 'inactive'].includes(newStatus)) {
			return c.json({ detail: 'Invalid status' }, 400);
		}

		const existing = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
		if (!existing) return c.json({ detail: 'User not found' }, 404);
		if (existing.role === 'super_admin') return c.json({ detail: 'Cannot change super admin status' }, 403);

		const now = new Date().toISOString();
		await c.env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(newStatus, now, userId).run();

		return c.json({ message: 'User status updated successfully', status: newStatus });
	} catch (e: any) {
		return c.json({ detail: 'Failed to update user status' }, 500);
	}
});

// DELETE /users/:user_id
app.delete('/users/:user_id', superAdminAuth, async (c) => {
	try {
		const userId = c.req.param('user_id');
		const existing = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
		if (!existing) return c.json({ detail: 'User not found' }, 404);
		if (existing.role === 'super_admin') return c.json({ detail: 'Cannot delete super admin' }, 403);

		await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
		return c.json({ message: 'User deleted successfully' });
	} catch (e: any) {
		return c.json({ detail: 'Failed to delete user' }, 500);
	}
});

// PUT /stores/:store_id/upgrade-pro - Upgrade store to PRO plan
app.put('/stores/:store_id/upgrade-pro', superAdminAuth, async (c) => {
	try {
		const storeId = c.req.param('store_id');
		const now = new Date().toISOString();

		const store = await c.env.DB.prepare('SELECT id, plan_id FROM stores WHERE id = ?').bind(storeId).first() as any;
		if (!store) return c.json({ detail: 'Store not found' }, 404);
		if (store.plan_id === 'pro') return c.json({ detail: 'Store is already on PRO plan' }, 400);

		// Update store to PRO
		await c.env.DB.prepare(
			'UPDATE stores SET plan_id = ?, max_tables = 999, updated_at = ? WHERE id = ?'
		).bind('pro', now, storeId).run();

		// Create or update subscription
		const existingSub = await c.env.DB.prepare(
			'SELECT subscription_id FROM subscriptions WHERE store_id = ?'
		).bind(storeId).first();

		if (existingSub) {
			await c.env.DB.prepare(
				"UPDATE subscriptions SET plan_id = 'pro', status = 'active', updated_at = ? WHERE store_id = ?"
			).bind(now, storeId).run();
		} else {
			const { generateId } = await import('../utils/crypto');
			const subId = generateId();
			await c.env.DB.prepare(
				"INSERT INTO subscriptions (subscription_id, store_id, plan_id, status, created_at, updated_at) VALUES (?, ?, 'pro', 'active', ?, ?)"
			).bind(subId, storeId, now, now).run();
		}

		return c.json({ success: true, message: 'Store upgraded to PRO successfully' });
	} catch (e: any) {
		return c.json({ detail: e.message || 'Failed to upgrade store' }, 500);
	}
});

// PUT /stores/:store_id/downgrade-starter - Downgrade store to STARTER plan
app.put('/stores/:store_id/downgrade-starter', superAdminAuth, async (c) => {
	try {
		const storeId = c.req.param('store_id');
		const now = new Date().toISOString();

		const store = await c.env.DB.prepare('SELECT id, plan_id FROM stores WHERE id = ?').bind(storeId).first() as any;
		if (!store) return c.json({ detail: 'Store not found' }, 404);
		if (store.plan_id === 'starter') return c.json({ detail: 'Store is already on STARTER plan' }, 400);

		await c.env.DB.prepare(
			'UPDATE stores SET plan_id = ?, max_tables = 10, updated_at = ? WHERE id = ?'
		).bind('starter', now, storeId).run();

		await c.env.DB.prepare(
			"UPDATE subscriptions SET plan_id = 'starter', status = 'active', updated_at = ? WHERE store_id = ?"
		).bind(now, storeId).run();

		return c.json({ success: true, message: 'Store downgraded to STARTER successfully' });
	} catch (e: any) {
		return c.json({ detail: e.message || 'Failed to downgrade store' }, 500);
	}
});


export default app;
