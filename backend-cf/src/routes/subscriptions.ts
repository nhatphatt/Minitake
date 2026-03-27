import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware, createToken, verifyToken } from '../middleware/auth';
import { generateId } from '../utils/crypto';
import { createPaymentLink } from '../services/payos';

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// GET /plans
app.get('/plans', async (c) => {
	try {
		const { results } = await c.env.DB.prepare(
			'SELECT * FROM subscription_plans WHERE is_active = 1'
		).all();
		const plans = (results || []).map((p: any) => ({
			...p,
			features: p.features ? JSON.parse(p.features) : {},
		}));
		return c.json(plans);
	} catch (e: any) {
		return c.json({ detail: 'Failed to get subscription plans' }, 500);
	}
});

// GET /current
app.get('/current', authMiddleware, async (c) => {
	const user = c.get('user');
	const storeId = user.store_id;

	if (!storeId) {
		return c.json({
			has_subscription: false,
			plan_id: 'starter',
			plan_name: 'Gói STARTER',
			status: 'active',
			features: { qr_menu: true, basic_reports: true, online_payment: true, ai_chatbot: false, ai_reports: false, unlimited_tables: false },
			max_tables: 10,
			table_usage: { current: 0, limit: 10, remaining: 10 },
		});
	}

	const subscription = await c.env.DB.prepare(
		"SELECT * FROM subscriptions WHERE store_id = ? AND status IN ('active', 'trial') LIMIT 1"
	).bind(storeId).first();

	if (!subscription) {
		return c.json({
			has_subscription: false,
			plan_id: 'starter',
			plan_name: 'Gói STARTER',
			status: 'active',
			features: { qr_menu: true, basic_reports: true, online_payment: true, ai_chatbot: false, ai_reports: false, unlimited_tables: false },
			max_tables: 10,
			table_usage: { current: 0, limit: 10, remaining: 10 },
		});
	}

	const plan = await c.env.DB.prepare(
		'SELECT * FROM subscription_plans WHERE plan_id = ?'
	).bind(subscription.plan_id || 'starter').first();

	const tableCount = await c.env.DB.prepare(
		'SELECT COUNT(*) as cnt FROM tables WHERE store_id = ?'
	).bind(storeId).first<{ cnt: number }>();

	const isPro = subscription.plan_id === 'pro';
	const maxTables = isPro ? null : ((subscription.max_tables as number) || 10);
	const current = tableCount?.cnt || 0;
	const features = plan?.features ? JSON.parse(plan.features as string) : {};

	return c.json({
		has_subscription: true,
		subscription_id: subscription.subscription_id,
		plan_id: subscription.plan_id,
		plan_name: plan?.name || 'Unknown',
		status: subscription.status,
		trial_ends_at: subscription.trial_ends_at,
		current_period_end: subscription.current_period_end,
		cancel_at_period_end: !!subscription.cancel_at_period_end,
		features,
		max_tables: maxTables,
		table_usage: {
			current,
			limit: maxTables,
			remaining: maxTables ? Math.max(0, maxTables - current) : null,
		},
	});
});

// POST /activate-trial
app.post('/activate-trial', authMiddleware, async (c) => {
	const user = c.get('user');
	const storeId = user.store_id;
	if (!storeId) return c.json({ detail: 'No store associated' }, 400);

	try {
		const existing = await c.env.DB.prepare(
			"SELECT * FROM subscriptions WHERE store_id = ? AND status IN ('active', 'trial') LIMIT 1"
		).bind(storeId).first();

		if (existing) {
			if (existing.status === 'trial') return c.json({ detail: 'Store already has active trial' }, 400);
			if (existing.status === 'active') return c.json({ detail: 'Store already has active subscription' }, 400);
		}

		const plan = await c.env.DB.prepare('SELECT * FROM subscription_plans WHERE plan_id = ?').bind('pro').first();
		if (!plan) return c.json({ detail: 'PRO plan not found' }, 400);

		const now = new Date().toISOString();
		const trialDays = parseInt(c.env.TRIAL_DAYS || '14');
		const trialEndsAt = new Date(Date.now() + trialDays * 86400000).toISOString();
		const subscriptionId = 'sub_' + generateId().replace(/-/g, '').slice(0, 12);
		const maxTables = (plan.max_tables as number) || 999;

		await c.env.DB.prepare(
			'INSERT INTO subscriptions (subscription_id, store_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, max_tables, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
		).bind(subscriptionId, storeId, 'pro', 'trial', trialEndsAt, now, trialEndsAt, 0, maxTables, now, now).run();

		await c.env.DB.prepare(
			'UPDATE stores SET subscription_id = ?, plan_id = ?, subscription_status = ?, max_tables = ?, updated_at = ? WHERE id = ?'
		).bind(subscriptionId, 'pro', 'trial', maxTables, now, storeId).run();

		return c.json({
			success: true,
			message: '14-day PRO trial activated successfully!',
			trial_ends_at: trialEndsAt,
			features: ['AI Chatbot', 'AI Reports', 'Unlimited Tables'],
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to activate trial' }, 500);
	}
});

// POST /create-checkout-for-registration
app.post('/create-checkout-for-registration', async (c) => {
	try {
		const body = await c.req.json();
		const { plan_id = 'pro', store_name, store_slug, buyer_email, buyer_name, password } = body;

		if (!store_name || !store_slug || !buyer_email || !buyer_name || !password) {
			return c.json({ detail: 'Missing required fields' }, 400);
		}
		if (plan_id !== 'pro') return c.json({ detail: 'Only PRO plan requires payment' }, 400);
		if (!/^[a-z0-9-]{3,50}$/.test(store_slug)) {
			return c.json({ detail: 'Slug must be 3-50 characters with lowercase letters, numbers, and hyphens' }, 400);
		}

		const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(buyer_email).first();
		if (existingUser) return c.json({ detail: 'Email already registered' }, 400);

		const existingStore = await c.env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(store_slug).first();
		if (existingStore) return c.json({ detail: 'Store slug already taken' }, 400);

		const plan = await c.env.DB.prepare('SELECT * FROM subscription_plans WHERE plan_id = ?').bind('pro').first();
		if (!plan) return c.json({ detail: 'PRO plan not available' }, 400);

		const { hashPassword } = await import('../utils/crypto');
		const pendingId = 'pending_' + generateId().replace(/-/g, '').slice(0, 12);
		const paymentId = 'pay_' + generateId().replace(/-/g, '').slice(0, 12);
		const orderCode = 'reg_' + store_slug + '_' + Date.now();
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 3600000).toISOString();
		const passwordHash = await hashPassword(password);

		await c.env.DB.prepare(
			'INSERT INTO pending_registrations (pending_id, email, password_hash, name, store_name, store_slug, plan_id, payment_id, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
		).bind(pendingId, buyer_email, passwordHash, buyer_name, store_name, store_slug, 'pro', paymentId, 'pending_payment', now, expiresAt).run();

		const priceVat = (plan.price as number) || 218900;
		await c.env.DB.prepare(
			'INSERT INTO subscription_payments (payment_id, pending_registration_id, store_id, amount, status, payos_order_id, payment_method, created_at) VALUES (?,?,?,?,?,?,?,?)'
		).bind(paymentId, pendingId, null, priceVat, 'pending', orderCode, 'payos', now).run();

		const orderCodeNum = Date.now() % 2147483647;
		const payosResult = await createPaymentLink(
			{ clientId: c.env.PAYOS_CLIENT_ID, apiKey: c.env.PAYOS_API_KEY, checksumKey: c.env.PAYOS_CHECKSUM_KEY },
			{
				orderCode: orderCodeNum,
				amount: priceVat,
				description: 'Dang ky PRO ' + store_slug,
				buyerName: buyer_name,
				buyerEmail: buyer_email,
				returnUrl: c.env.FRONTEND_URL + '/admin/register?payment=success&pending_id=' + pendingId,
				cancelUrl: c.env.FRONTEND_URL + '/admin/register?payment=cancelled',
			}
		);

		if (!payosResult.success) {
			return c.json({ detail: 'PayOS error: ' + payosResult.error }, 500);
		}

		// Update payment record with PayOS order code
		await c.env.DB.prepare('UPDATE subscription_payments SET payos_order_id = ? WHERE payment_id = ?')
			.bind(String(orderCodeNum), paymentId).run();

		return c.json({
			success: true,
			pending_id: pendingId,
			payment_id: paymentId,
			checkout_url: payosResult.checkout_url,
		});
	} catch (e: any) {
		if (e instanceof Response) throw e;
		return c.json({ detail: 'Failed to create checkout: ' + e.message }, 500);
	}
});

// POST /create-checkout
app.post('/create-checkout', authMiddleware, async (c) => {
	const user = c.get('user');
	const storeId = user.store_id;
	if (!storeId) return c.json({ detail: 'No store associated' }, 400);

	try {
		const body = await c.req.json();
		const planId = body.plan_id || 'pro';
		if (planId !== 'pro') return c.json({ detail: 'Only PRO plan requires payment' }, 400);

		const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first();
		if (!store) return c.json({ detail: 'Store not found' }, 400);

		const plan = await c.env.DB.prepare('SELECT * FROM subscription_plans WHERE plan_id = ?').bind('pro').first();
		if (!plan) return c.json({ detail: 'PRO plan not found' }, 400);

		const now = new Date().toISOString();
		let subscriptionId = store.subscription_id as string;
		if (!subscriptionId) {
			subscriptionId = 'sub_' + generateId().replace(/-/g, '').slice(0, 12);
			await c.env.DB.prepare(
				'INSERT INTO subscriptions (subscription_id, store_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, max_tables, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
			).bind(subscriptionId, storeId, 'starter', 'active', now, new Date(Date.now() + 30 * 86400000).toISOString(), 0, 10, now, now).run();
			await c.env.DB.prepare('UPDATE stores SET subscription_id = ? WHERE id = ?').bind(subscriptionId, storeId).run();
		}

		const paymentId = 'pay_' + generateId().replace(/-/g, '').slice(0, 12);
		const orderCodeNum = Date.now() % 2147483647;
		const priceVat = (plan.price as number) || 218900;

		await c.env.DB.prepare(
			'INSERT INTO subscription_payments (payment_id, subscription_id, store_id, amount, status, payos_order_id, payment_method, created_at) VALUES (?,?,?,?,?,?,?,?)'
		).bind(paymentId, subscriptionId, storeId, priceVat, 'pending', String(orderCodeNum), 'payos', now).run();

		const payosResult = await createPaymentLink(
			{ clientId: c.env.PAYOS_CLIENT_ID, apiKey: c.env.PAYOS_API_KEY, checksumKey: c.env.PAYOS_CHECKSUM_KEY },
			{
				orderCode: orderCodeNum,
				amount: priceVat,
				description: 'Nang cap PRO 1 thang',
				buyerName: user.name || user.email,
				buyerEmail: user.email,
				returnUrl: c.env.FRONTEND_URL + '/admin/dashboard?payment=success',
				cancelUrl: c.env.FRONTEND_URL + '/admin/subscription?payment=cancelled',
			}
		);

		if (!payosResult.success) {
			return c.json({ detail: 'PayOS error: ' + payosResult.error }, 500);
		}

		return c.json({
			success: true,
			payment_id: paymentId,
			checkout_url: payosResult.checkout_url,
			amount: priceVat,
			description: 'Nâng cấp lên gói PRO - 1 tháng',
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to create checkout: ' + e.message }, 500);
	}
});

// POST /cancel
app.post('/cancel', authMiddleware, async (c) => {
	const user = c.get('user');
	const storeId = user.store_id;
	if (!storeId) return c.json({ detail: 'No store associated' }, 400);

	try {
		const { immediate } = c.req.query();
		const cancelImmediate = immediate === 'true';
		const now = new Date().toISOString();

		const subscription = await c.env.DB.prepare(
			"SELECT * FROM subscriptions WHERE store_id = ? AND status IN ('active', 'trial') LIMIT 1"
		).bind(storeId).first();

		if (!subscription) return c.json({ detail: 'No active subscription found' }, 400);

		if (cancelImmediate) {
			await c.env.DB.prepare(
				'UPDATE subscriptions SET status = ?, updated_at = ? WHERE subscription_id = ?'
			).bind('cancelled', now, subscription.subscription_id).run();
			await c.env.DB.prepare(
				"UPDATE stores SET plan_id = 'starter', subscription_status = 'cancelled', updated_at = ? WHERE id = ?"
			).bind(now, storeId).run();
		} else {
			await c.env.DB.prepare(
				'UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE subscription_id = ?'
			).bind(now, subscription.subscription_id).run();
		}

		return c.json({
			success: true,
			message: cancelImmediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at period end',
			cancel_at_period_end: !cancelImmediate,
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to cancel subscription' }, 500);
	}
});

// GET /invoices
app.get('/invoices', authMiddleware, async (c) => {
	const user = c.get('user');
	const storeId = user.store_id;
	if (!storeId) return c.json({ detail: 'No store associated' }, 400);

	try {
		const page = parseInt(c.req.query('page') || '1');
		const limit = parseInt(c.req.query('limit') || '20');
		const offset = (page - 1) * limit;

		const totalRow = await c.env.DB.prepare(
			'SELECT COUNT(*) as cnt FROM subscription_payments WHERE store_id = ?'
		).bind(storeId).first<{ cnt: number }>();
		const total = totalRow?.cnt || 0;

		const { results } = await c.env.DB.prepare(
			'SELECT * FROM subscription_payments WHERE store_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
		).bind(storeId, limit, offset).all();

		return c.json({
			invoices: results || [],
			total,
			page,
			limit,
			total_pages: Math.ceil(total / limit),
		});
	} catch (e: any) {
		return c.json({ detail: 'Failed to get invoices' }, 500);
	}
});

export default app;
