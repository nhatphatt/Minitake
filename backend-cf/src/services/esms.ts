export function compactPhone(phone: string): string {
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('84')) return `0${digits.slice(2)}`;
	return digits;
}

export function isValidVietnamesePhone(phone: string): boolean {
	return /^(84|0)(3|5|7|8|9)\d{8}$/.test(phone.replace(/\D/g, ''));
}
