import { Hono } from 'hono';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

function verifyPayosSignature(payload: string, signature: string, checksumKey: string): boolean {
	// HMAC verification would need async crypto.subtle - simplified sync check placeholder
	// In production, use crypto.subtle.sign for HMAC-SHA256
	return true; // Signature verification delegated to async handler below
}

async function verifySignatureAsync(payload: string, signature: string, checksumKey: string): Promise<boolean> {
	if (!checksumKey) return false;
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw', enc.encode(checksumKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
	return expected === signature;
}

// POST /payos
app.post('/payos', async (c) => {
	try {
		const payloadStr = await c.req.text();

		// Verify signature if provided
		const signature = c.req.header('x-payos-signature');
		if (signature && c.env.PAYOS_CHECKSUM_KEY) {
			const valid = await verifySignatureAsync(payloadStr, signature, c.env.PAYOS_CHECKSUM_KEY);
			if (!valid) {
				return c.json({ detail: 'Invalid signature' }, 401);
			}
		}

		let payload: any;
		try {
			payload = JSON.parse(payloadStr);
		} catch {
			return c.json({ detail: 'Invalid JSON' }, 400);
		}

		const code = payload.code;
		const data = payload.data || {};

		if (code !== '00') {
			return c.json({ code, message: payload.desc || 'Error' });
		}

		const orderCode = data.orderCode;
		const amount = data.amount;
		const status = data.status;
		const transactionId = data.transactionId;

		if (status !== 'PAID') {
			return c.json({ code: '00', message: 'Status ignored' });
		}

		// Check subscription payment
		const payment = await c.env.DB.prepare(
			'SELECT * FROM subscription_payments WHERE payos_order_id = ?'
		).bind(orderCode).first();

		if (payment) {
			if (payment.status === 'paid') {
				return c.json({ code: '00', message: 'Already processed' });
			}

			const now = new Date().toISOString();

			// Update payment status
			await c.env.DB.prepare(
				'UPDATE subscription_payments SET status = ?, payos_transaction_id = ?, updated_at = ? WHERE payment_id = ?'
			).bind('paid', transactionId, now, payment.payment_id).run();

			// If subscription upgrade, activate the subscription
			if (payment.subscription_id) {
				await c.env.DB.prepare(
					"UPDATE subscriptions SET plan_id = 'pro', status = 'active', updated_at = ? WHERE subscription_id = ?"
				).bind(now, payment.subscription_id).run();

				if (payment.store_id) {
					await c.env.DB.prepare(
						"UPDATE stores SET plan_id = 'pro', subscription_status = 'active', updated_at = ? WHERE id = ?"
					).bind(now, payment.store_id).run();
				}
			}

			// If new registration payment, mark pending_registration as paid
			if (payment.pending_registration_id) {
				await c.env.DB.prepare(
					"UPDATE pending_registrations SET status = 'payment_completed', completed_at = ? WHERE pending_id = ?"
				).bind(now, payment.pending_registration_id).run();
			}

			return c.json({ code: '00', message: 'OK' });
		}

		// Check order payment
		const orderPayment = await c.env.DB.prepare(
			"SELECT * FROM payments WHERE payos_order_id = ? AND method = 'payos'"
		).bind(orderCode).first();

		if (orderPayment) {
			const now = new Date().toISOString();
			await c.env.DB.prepare(
				"UPDATE payments SET status = 'paid', transaction_id = ?, updated_at = ? WHERE id = ?"
			).bind(transactionId, now, orderPayment.id).run();

			// Update associated order payment status
			if (orderPayment.order_id) {
				await c.env.DB.prepare(
					"UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ?"
				).bind(now, orderPayment.order_id).run();
			}

			return c.json({ code: '00', message: 'OK' });
		}

		return c.json({ code: '01', message: 'Payment not found' });
	} catch (e: any) {
		return c.json({ code: '03', message: 'Internal error' });
	}
});

// GET /payos/health
app.get('/payos/health', async (c) => {
	return c.json({ status: 'healthy', service: 'webhook' });
});

export default app;
