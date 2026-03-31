export interface EsmsConfig {
	apiKey: string;
	secretKey: string;
	brandname: string;
}

// Normalize Vietnamese phone number to ESMS format (84xxxxxxxxx)
function normalizePhone(phone: string): string {
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('84')) return digits;
	if (digits.startsWith('0')) return '84' + digits.slice(1);
	return digits;
}

export async function sendSmsOtp(config: EsmsConfig, phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
	const normalizedPhone = normalizePhone(phone);
	const content = `Ma OTP Minitake cua ban la: ${otp}. Co hieu luc trong 10 phut. Khong chia se ma nay voi bat ky ai.`;

	const payload = {
		ApiKey: config.apiKey,
		SecretKey: config.secretKey,
		Phone: normalizedPhone,
		Content: content,
		SmsType: 2,
		Brandname: config.brandname,
		IsUnicode: 0,
	};

	try {
		const response = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		const result: any = await response.json();

		// ESMS returns CodeResult "100" for success
		if (result.CodeResult === '100') {
			return { success: true };
		}
		return { success: false, error: `ESMS error: ${result.CodeResult} - ${result.ErrorMessage || 'Unknown'}` };
	} catch (e: any) {
		return { success: false, error: e.message || 'SMS send failed' };
	}
}
