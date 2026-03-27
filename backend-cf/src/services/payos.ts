const PAYOS_API_URL = 'https://api-merchant.payos.vn';

interface PayOSConfig {
	clientId: string;
	apiKey: string;
	checksumKey: string;
}

interface CreatePaymentParams {
	orderCode: number;
	amount: number;
	description: string;
	buyerName: string;
	buyerEmail: string;
	buyerPhone?: string;
	returnUrl: string;
	cancelUrl: string;
	items?: { name: string; quantity: number; price: number }[];
}

async function signData(data: Record<string, any>, checksumKey: string): Promise<string> {
	const sortedKeys = Object.keys(data).sort();
	const signStr = sortedKeys
		.filter(k => data[k] !== null && data[k] !== undefined)
		.map(k => `${k}=${data[k]}`)
		.join('&');

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(checksumKey),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signStr));
	return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createPaymentLink(config: PayOSConfig, params: CreatePaymentParams) {
	const items = params.items || [{ name: params.description, quantity: 1, price: params.amount }];
	const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes

	const data: Record<string, any> = {
		orderCode: params.orderCode,
		amount: params.amount,
		description: params.description,
		buyerName: params.buyerName,
		buyerEmail: params.buyerEmail,
		buyerPhone: params.buyerPhone || '',
		items,
		returnUrl: params.returnUrl,
		cancelUrl: params.cancelUrl,
		expiredAt,
	};

	// Sign only the required fields for signature
	const signFields: Record<string, any> = {
		amount: params.amount,
		cancelUrl: params.cancelUrl,
		description: params.description,
		orderCode: params.orderCode,
		returnUrl: params.returnUrl,
	};
	data.signature = await signData(signFields, config.checksumKey);

	const response = await fetch(`${PAYOS_API_URL}/v2/payment-requests`, {
		method: 'POST',
		headers: {
			'x-client-id': config.clientId,
			'x-api-key': config.apiKey,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	});

	const result = await response.json() as any;

	if (result.code === '00') {
		return {
			success: true,
			order_code: params.orderCode,
			payment_link_id: result.data?.id,
			checkout_url: result.data?.checkoutUrl,
			qr_code_url: result.data?.qrCode,
		};
	}

	return {
		success: false,
		error: result.message || result.desc || 'Failed to create payment link',
	};
}

export async function verifyWebhookSignature(body: Record<string, any>, checksumKey: string): Promise<boolean> {
	const { signature, ...data } = body;
	if (!signature) return false;
	const computed = await signData(data, checksumKey);
	return computed === signature;
}

export async function getPaymentStatus(config: PayOSConfig, orderCode: number | string): Promise<{ paid: boolean; transactionId?: string }> {
	try {
		const response = await fetch(`${PAYOS_API_URL}/v2/payment-requests/${orderCode}`, {
			method: 'GET',
			headers: {
				'x-client-id': config.clientId,
				'x-api-key': config.apiKey,
			},
		});
		const result = await response.json() as any;
		if (result.code === '00' && result.data?.status === 'PAID') {
			return { paid: true, transactionId: result.data?.transactionId };
		}
		return { paid: false };
	} catch {
		return { paid: false };
	}
}
