import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId, hashPassword, verifyPassword, generateOtp, hashOtp } from '../utils/crypto';
import { createToken } from '../middleware/auth';
import { getPaymentStatus } from '../services/payos';
import { sendSmsOtp } from '../services/esms';
import { sendEmailOtp } from '../services/resend';

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// POST /auth/send-otp
app.post('/auth/send-otp', async (c) => {
	const body = await c.req.json();
	const { identifier, method } = body;

	if (!identifier || !method) return c.json({ detail: 'Missing identifier or method' }, 400);
	if (method !== 'email' && method !== 'sms') return c.json({ detail: 'Method must be email or sms' }, 400);

	// Basic format validation
	if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
		return c.json({ detail: 'Invalid email format' }, 400);
	}
	if (method === 'sms' && !/^(0|\+84|84)\d{9}$/.test(identifier.replace(/\s/g, ''))) {
		return c.json({ detail: 'Invalid Vietnamese phone number' }, 400);
	}

	try {
		const env = c.env;
		const now = new Date();

		// Rate limit: block if a valid OTP was sent within the last 60 seconds
		const recent = await env.DB.prepare(
			`SELECT created_at FROM otp_verifications
			 WHERE identifier = ? AND method = ? AND is_verified = 0
			 ORDER BY created_at DESC LIMIT 1`
		).bind(identifier, method).first() as any;

		if (recent) {
			const sentAt = new Date(recent.created_at);
			const secondsAgo = (now.getTime() - sentAt.getTime()) / 1000;
			if (secondsAgo < 60) {
				return c.json({ detail: `Vui lòng chờ ${Math.ceil(60 - secondsAgo)} giây trước khi gửi lại` }, 429);
			}
		}

		const otp = generateOtp();
		const otpHash = await hashOtp(otp);
		const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
		const id = generateId();

		await env.DB.prepare(
			`INSERT INTO otp_verifications (id, identifier, method, otp_hash, is_verified, expires_at, created_at)
			 VALUES (?, ?, ?, ?, 0, ?, ?)`
		).bind(id, identifier, method, otpHash, expiresAt, now.toISOString()).run();

		let sendError: string | undefined;
		if (method === 'email') {
			const emailResult = await sendEmailOtp(
				{ apiKey: env.RESEND_API_KEY, fromEmail: env.RESEND_FROM_EMAIL },
				identifier,
				otp
			);
			sendError = emailResult.success ? undefined : 'Gửi email thất bại, vui lòng thử lại';
		} else {
			const smsResult = await sendSmsOtp(
				{ apiKey: env.ESMS_API_KEY, secretKey: env.ESMS_SECRET_KEY, brandname: env.ESMS_BRANDNAME },
				identifier,
				otp
			);
			sendError = smsResult.success ? undefined : 'Gửi SMS thất bại, vui lòng thử lại';
		}

		if (sendError) {
			await env.DB.prepare('DELETE FROM otp_verifications WHERE id = ?').bind(id).run();
			return c.json({ detail: sendError }, 500);
		}

		return c.json({ success: true, expires_in: 600 });
	} catch (e: any) {
		return c.json({ detail: e.message || 'Send OTP failed' }, 500);
	}
});

// POST /auth/verify-otp
app.post('/auth/verify-otp', async (c) => {
	const body = await c.req.json();
	const { identifier, method, otp_code } = body;

	if (!identifier || !method || !otp_code) return c.json({ detail: 'Missing required fields' }, 400);

	try {
		const env = c.env;
		const now = new Date().toISOString();

		const record = await env.DB.prepare(
			`SELECT * FROM otp_verifications
			 WHERE identifier = ? AND method = ? AND is_verified = 0 AND expires_at > ?
			 ORDER BY created_at DESC LIMIT 1`
		).bind(identifier, method, now).first() as any;

		if (!record) return c.json({ detail: 'Mã OTP không hợp lệ hoặc đã hết hạn' }, 400);

		const inputHash = await hashOtp(otp_code.trim());
		if (inputHash !== record.otp_hash) {
			return c.json({ detail: 'Mã OTP không đúng' }, 400);
		}

		await env.DB.prepare(
			`UPDATE otp_verifications SET is_verified = 1 WHERE id = ?`
		).bind(record.id).run();

		return c.json({ verified_token: record.id });
	} catch (e: any) {
		return c.json({ detail: e.message || 'Verify OTP failed' }, 500);
	}
});

// POST /auth/register
app.post('/auth/register', async (c) => {
	const body = await c.req.json();
	const { email, password, phone, name, store_name, store_slug, plan_id = 'starter', verified_token } = body;

	if (!email || !password || !phone || !name || !store_name || !store_slug) {
		return c.json({ detail: 'Missing required fields' }, 400);
	}

	if (!verified_token) {
		return c.json({ detail: 'OTP verification required' }, 400);
	}

	// Validate password strength
	if (password.length < 8) return c.json({ detail: 'Mật khẩu phải có ít nhất 8 ký tự' }, 400);
	if (!/[A-Z]/.test(password)) return c.json({ detail: 'Mật khẩu phải chứa ít nhất 1 chữ hoa' }, 400);
	if (!/[a-z]/.test(password)) return c.json({ detail: 'Mật khẩu phải chứa ít nhất 1 chữ thường' }, 400);
	if (!/[0-9]/.test(password)) return c.json({ detail: 'Mật khẩu phải chứa ít nhất 1 số' }, 400);
	if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return c.json({ detail: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)' }, 400);

	// Validate slug
	if (!/^[a-z0-9-]+$/.test(store_slug)) return c.json({ detail: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang' }, 400);
	if (store_slug.length < 3) return c.json({ detail: 'Slug phải có ít nhất 3 ký tự' }, 400);

	try {
		const env = c.env;
		const now = new Date().toISOString();

		// Validate verified_token against DB
		const otpRecord = await env.DB.prepare(
			`SELECT * FROM otp_verifications WHERE id = ? AND is_verified = 1 AND expires_at > ?`
		).bind(verified_token, now).first() as any;

		if (!otpRecord) {
			return c.json({ detail: 'OTP verification invalid or expired' }, 400);
		}
		if (otpRecord.identifier !== email && otpRecord.identifier !== phone) {
			return c.json({ detail: 'OTP was not issued for this email or phone' }, 400);
		}

		// Consume the token so it cannot be reused
		await env.DB.prepare('DELETE FROM otp_verifications WHERE id = ?').bind(verified_token).run();

		// Check email exists
		const existingUserEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
		if (existingUserEmail) return c.json({ detail: 'Email already registered' }, 400);

		const existingUserPhone = await env.DB.prepare('SELECT id FROM users WHERE phone_number = ?').bind(phone).first();
		if (existingUserPhone) return c.json({ detail: 'Phone number already registered'}, 400)

		// Check slug exists
		const existingStore = await env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(store_slug).first();
		if (existingStore) return c.json({ detail: 'Store slug already taken' }, 400);

		const storeId = generateId();
		const userId = generateId();
		const passwordHash = await hashPassword(password);

		// Create store
		await env.DB.prepare(
			`INSERT INTO stores (id, name, slug, logo, address, phone, plan_id, subscription_status, max_tables, is_suspended, created_at)
			 VALUES (?, ?, ?, '', '', '', ?, ?, ?, 0, ?)`
		).bind(
			storeId, store_name, store_slug, plan_id,
			plan_id === 'starter' ? 'active' : 'pending_payment',
			plan_id === 'starter' ? 10 : null,
			now
		).run();

		// Seed default payment methods
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'cash', 'Tiền mặt', 1, '{}', ?)").bind(generateId(), storeId, now).run();
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'bank_qr', 'Chuyển khoản QR', 0, '{\"bank_name\":\"\",\"bank_bin\":\"\",\"account_number\":\"\",\"account_name\":\"\"}', ?)").bind(generateId(), storeId, now).run();
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'momo', 'MoMo', 0, '{\"phone\":\"\"}', ?)").bind(generateId(), storeId, now).run();

		// Create subscription for PRO plan
		let subscriptionId: string | null = null;
		if (plan_id === 'pro') {
			const plan = await env.DB.prepare('SELECT * FROM subscription_plans WHERE slug = ?').bind('pro').first();
			if (!plan) return c.json({ detail: 'PRO plan not available' }, 400);

			subscriptionId = `sub_${generateId().replace(/-/g, '').slice(0, 12)}`;
			const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

			await env.DB.prepare(
				`INSERT INTO subscriptions (id, store_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
				 VALUES (?, ?, 'pro', 'pending_payment', ?, ?, ?, ?)`
			).bind(subscriptionId, storeId, now, periodEnd, now, now).run();

			await env.DB.prepare('UPDATE stores SET subscription_id = ? WHERE id = ?').bind(subscriptionId, storeId).run();
		}

		// Create user
		await env.DB.prepare(
			`INSERT INTO users (id, email, password_hash, phone_number, name, role, store_id, created_at)
			 VALUES (?, ?, ?, ?, 'admin', ?, ?)`
		).bind(userId, email, passwordHash, phone, name, storeId, now).run();

		// Create token
		const token = await createToken({ sub: userId, email, role: 'admin', store_id: storeId }, env.JWT_SECRET);

		return c.json({
			access_token: token,
			token_type: 'bearer',
			user: { id: userId, email, name, role: 'admin', store_id: storeId },
		});
	} catch (e: any) {
		return c.json({ detail: e.message || 'Registration failed' }, 500);
	}
});

// POST /auth/register/initiate - Initiate pro registration with payment
app.post('/auth/register/initiate', async (c) => {
	const body = await c.req.json();
	const { plan_id = 'pro', store_name, store_slug, buyer_email, buyer_name, password } = body;

	if (!store_name || !store_slug || !buyer_email || !buyer_name || !password) {
		return c.json({ detail: 'Missing required fields' }, 400);
	}

	if (plan_id !== 'pro') {
		return c.json({ detail: 'Only PRO plan requires payment' }, 400);
	}

	if (!/^[a-z0-9-]{3,50}$/.test(store_slug)) {
		return c.json({ detail: 'Slug must be 3-50 characters with lowercase letters, numbers, and hyphens' }, 400);
	}

	try {
		const env = c.env;

		// Check email and slug
		const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(buyer_email).first();
		if (existingUser) return c.json({ detail: 'Email already registered' }, 400);

		const existingStore = await env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(store_slug).first();
		if (existingStore) return c.json({ detail: 'Store slug already taken' }, 400);

		// Get PRO plan
		const plan = await env.DB.prepare('SELECT * FROM subscription_plans WHERE slug = ?').bind('pro').first();
		if (!plan) return c.json({ detail: 'PRO plan not available' }, 400);

		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
		const pendingId = `pending_${generateId().replace(/-/g, '').slice(0, 12)}`;
		const paymentId = `pay_${generateId().replace(/-/g, '').slice(0, 12)}`;
		const passwordHash = await hashPassword(password);

		// Create pending registration
		await env.DB.prepare(
			`INSERT INTO pending_registrations (pending_id, email, password_hash, name, store_name, store_slug, plan_id, payment_id, status, created_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'pro', ?, 'pending_payment', ?, ?)`
		).bind(pendingId, buyer_email, passwordHash, buyer_name, store_name, store_slug, paymentId, now, expiresAt).run();

		// Create subscription payment record
		const amount = (plan as any).price || parseInt(env.PRO_PLAN_PRICE || '0');
		await env.DB.prepare(
			`INSERT INTO subscription_payments (id, subscription_id, store_id, amount, status, payment_method, transaction_id, created_at)
			 VALUES (?, '', '', ?, 'pending', 'payos', '', ?)`
		).bind(paymentId, amount, now).run();

		// Return pending_id and payment info for frontend to create PayOS checkout
		return c.json({
			pending_id: pendingId,
			payment_id: paymentId,
			amount,
			plan_id: 'pro',
			store_name,
			store_slug,
			expires_at: expiresAt,
		});
	} catch (e: any) {
		return c.json({ detail: e.message || 'Registration initiation failed' }, 500);
	}
});

// POST /auth/register/complete - Complete registration after payment
app.post('/auth/register/complete', async (c) => {
	const body = await c.req.json();
	const { pending_id, payment_id } = body;

	if (!pending_id && !payment_id) {
		return c.json({ detail: 'Missing pending_id or payment_id' }, 400);
	}

	try {
		const env = c.env;
		let pendingReg: any = null;

		if (pending_id) {
			pendingReg = await env.DB.prepare('SELECT * FROM pending_registrations WHERE pending_id = ?').bind(pending_id).first();
		} else {
			const payment = await env.DB.prepare('SELECT * FROM subscription_payments WHERE id = ?').bind(payment_id).first();
			if (payment) {
				pendingReg = await env.DB.prepare('SELECT * FROM pending_registrations WHERE payment_id = ?').bind(payment_id).first();
			}
		}

		if (!pendingReg) return c.json({ detail: 'Pending registration not found' }, 404);

		// Check expiry
		if (pendingReg.expires_at && new Date(pendingReg.expires_at) < new Date()) {
			return c.json({ detail: 'Pending registration has expired' }, 400);
		}

		if (pendingReg.status === 'completed') return c.json({ detail: 'Registration already completed' }, 400);
		if (pendingReg.status === 'cancelled') return c.json({ detail: 'Registration was cancelled' }, 400);

		// Check payment status
		const payment = await env.DB.prepare('SELECT * FROM subscription_payments WHERE payment_id = ?').bind(pendingReg.payment_id).first() as any;
		if (!payment) {
			return c.json({ detail: 'Payment record not found' }, 400);
		}

		// If webhook hasn't arrived yet, verify payment directly with PayOS
		if (payment.status !== 'paid' && payment.payos_order_id) {
			const payosStatus = await getPaymentStatus(
				{ clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY, checksumKey: env.PAYOS_CHECKSUM_KEY },
				payment.payos_order_id
			);
			if (payosStatus.paid) {
				await env.DB.prepare(
					'UPDATE subscription_payments SET status = ?, payos_transaction_id = ?, updated_at = ? WHERE payment_id = ?'
				).bind('paid', payosStatus.transactionId || '', new Date().toISOString(), payment.payment_id).run();
				payment.status = 'paid';
			}
		}

		if (payment.status !== 'paid') {
			return c.json({ detail: 'Payment not completed' }, 400);
		}

		const now = new Date().toISOString();
		const storeId = generateId();
		const userId = generateId();
		const subscriptionId = `sub_${generateId().replace(/-/g, '').slice(0, 12)}`;
		const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

		// Create store
		await env.DB.prepare(
			`INSERT INTO stores (id, name, slug, logo, address, phone, plan_id, subscription_status, max_tables, is_suspended, created_at)
			 VALUES (?, ?, ?, '', '', '', 'pro', 'active', NULL, 0, ?)`
		).bind(storeId, pendingReg.store_name, pendingReg.store_slug, now).run();

		// Seed default payment methods
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'cash', 'Tiền mặt', 1, '{}', ?)").bind(generateId(), storeId, now).run();
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'bank_qr', 'Chuyển khoản QR', 0, '{\"bank_name\":\"\",\"bank_bin\":\"\",\"account_number\":\"\",\"account_name\":\"\"}', ?)").bind(generateId(), storeId, now).run();
		await env.DB.prepare("INSERT INTO payment_methods (id, store_id, method_type, name, is_active, config, created_at) VALUES (?, ?, 'momo', 'MoMo', 0, '{\"phone\":\"\"}', ?)").bind(generateId(), storeId, now).run();

		// Create subscription
		await env.DB.prepare(
			`INSERT INTO subscriptions (subscription_id, store_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
			 VALUES (?, ?, 'pro', 'active', ?, ?, ?, ?)`
		).bind(subscriptionId, storeId, now, periodEnd, now, now).run();

		// Update store with subscription_id
		await env.DB.prepare('UPDATE stores SET subscription_id = ? WHERE id = ?').bind(subscriptionId, storeId).run();

		// Update payment with store_id
		await env.DB.prepare('UPDATE subscription_payments SET store_id = ? WHERE payment_id = ?').bind(storeId, pendingReg.payment_id).run();

		// Create user
		await env.DB.prepare(
			`INSERT INTO users (id, email, password_hash, name, role, store_id, created_at)
			 VALUES (?, ?, ?, ?, 'admin', ?, ?)`
		).bind(userId, pendingReg.email, pendingReg.password_hash, pendingReg.name, storeId, now).run();

		// Mark pending registration as completed
		await env.DB.prepare(
			`UPDATE pending_registrations SET status = 'completed', completed_at = ? WHERE pending_id = ?`
		).bind(now, pendingReg.pending_id).run();

		// Create token
		const token = await createToken(
			{ sub: userId, email: pendingReg.email, role: 'admin', store_id: storeId },
			env.JWT_SECRET
		);

		return c.json({
			access_token: token,
			token_type: 'bearer',
			user: { id: userId, email: pendingReg.email, name: pendingReg.name, role: 'admin', store_id: storeId },
		});
	} catch (e: any) {
		return c.json({ detail: e.message || 'Registration completion failed' }, 500);
	}
});

// POST /auth/login
app.post('/auth/login', async (c) => {
	const body = await c.req.json();
	const { email, password } = body;

	if (!email || !password) {
		return c.json({ detail: 'Email and password are required' }, 400);
	}

	try {
		const env = c.env;

		// Check super admin first
		const superAdmin = await env.DB.prepare('SELECT * FROM super_admins WHERE email = ?').bind(email).first() as any;

		if (superAdmin) {
			const valid = await verifyPassword(password, superAdmin.password_hash);
			if (!valid) return c.json({ detail: 'Invalid email or password' }, 401);

			if (!superAdmin.is_active) return c.json({ detail: 'Account is deactivated' }, 401);

			// Update last login
			await env.DB.prepare('UPDATE super_admins SET last_login_at = ? WHERE super_admin_id = ?')
				.bind(new Date().toISOString(), superAdmin.super_admin_id).run();

			const token = await createToken(
				{ sub: superAdmin.super_admin_id, email: superAdmin.email, role: 'super_admin', store_id: '' },
				env.JWT_SECRET
			);

			return c.json({
				access_token: token,
				token_type: 'bearer',
				user: {
					id: superAdmin.super_admin_id,
					email: superAdmin.email,
					name: superAdmin.name,
					role: 'super_admin',
					store_id: '',
				},
			});
		}

		// Regular user login
		const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first() as any;
		if (!user || !(await verifyPassword(password, user.password_hash))) {
			return c.json({ detail: 'Invalid email or password' }, 401);
		}

		const token = await createToken(
			{ sub: user.id, email: user.email, role: user.role, store_id: user.store_id },
			env.JWT_SECRET
		);

		return c.json({
			access_token: token,
			token_type: 'bearer',
			user: { id: user.id, email: user.email, name: user.name, role: user.role, store_id: user.store_id },
		});
	} catch (e: any) {
		return c.json({ detail: e.message || 'Login failed' }, 500);
	}
});

// POST /auth/super-admin/login
app.post('/auth/super-admin/login', async (c) => {
	const body = await c.req.json();
	const { email, password } = body;

	if (!email || !password) {
		return c.json({ detail: 'Email and password are required' }, 400);
	}

	try {
		const env = c.env;
		const superAdmin = await env.DB.prepare('SELECT * FROM super_admins WHERE email = ?').bind(email).first() as any;

		if (!superAdmin) return c.json({ detail: 'Invalid email or password' }, 401);

		const valid = await verifyPassword(password, superAdmin.password_hash);
		if (!valid) return c.json({ detail: 'Invalid email or password' }, 401);

		if (!superAdmin.is_active) return c.json({ detail: 'Account is deactivated' }, 401);

		// Update last login
		await env.DB.prepare('UPDATE super_admins SET last_login_at = ? WHERE super_admin_id = ?')
			.bind(new Date().toISOString(), superAdmin.super_admin_id).run();

		const token = await createToken(
			{ sub: superAdmin.super_admin_id, email: superAdmin.email, role: 'super_admin', store_id: '' },
			env.JWT_SECRET
		);

		return c.json({
			access_token: token,
			token_type: 'bearer',
			user: {
				id: superAdmin.super_admin_id,
				email: superAdmin.email,
				name: superAdmin.name,
				role: 'super_admin',
				store_id: '',
			},
		});
	} catch (e: any) {
		return c.json({ detail: e.message || 'Login failed' }, 500);
	}
});

// POST /auth/check-availability
app.post('/auth/check-availability', async (c) => {
	const body = await c.req.json();
	const { email, store_slug } = body;

	try {
		const env = c.env;
		const errors: string[] = [];

		if (email) {
			const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
			if (existing) errors.push('Email already registered');
		}

		if (store_slug) {
			const existing = await env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(store_slug).first();
			if (existing) errors.push('Store slug already taken');
		}

		if (errors.length > 0) return c.json({ detail: errors[0] }, 400);

		return c.json({ available: true });
	} catch (e: any) {
		return c.json({ detail: e.message || 'Check failed' }, 500);
	}
});

// Alias for frontend compatibility
app.post('/auth/complete-registration', async (c) => {
	const body = await c.req.json();
	const url = new (globalThis as any).URL(c.req.url);
	url.pathname = '/auth/register/complete';
	const newReq = new Request(url.toString(), {
		method: 'POST',
		headers: c.req.raw.headers,
		body: JSON.stringify(body),
	});
	return app.fetch(newReq, c.env, c.executionCtx);
});

// GET /auth/me
app.get('/auth/me', authMiddleware, async (c) => {
	const user = c.get('user');
	return c.json({
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		store_id: user.store_id,
	});
});

export default app;
