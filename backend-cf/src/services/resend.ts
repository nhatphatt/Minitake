export interface ResendConfig {
	apiKey: string;
	fromEmail: string;
}

export async function sendEmailOtp(config: ResendConfig, toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify({
				from: config.fromEmail,
				to: toEmail,
				subject: 'Mã OTP đăng ký Minitake',
				html: `
					<div style="font-family:sans-serif;max-width:480px;margin:auto">
						<h2 style="color:#059669">Xác thực tài khoản Minitake</h2>
						<p>Mã OTP của bạn là:</p>
						<div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#059669;padding:16px 0">${otp}</div>
						<p style="color:#6b7280">Có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
					</div>
				`,
			}),
		});

		if (!response.ok) {
			const err: any = await response.json().catch(() => ({}));
			return { success: false, error: err.message || 'Resend API error' };
		}

		return { success: true };
	} catch (e: any) {
		return { success: false, error: e.message || 'Email send failed' };
	}
}
