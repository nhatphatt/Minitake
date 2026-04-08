import type { Env } from '../types';

interface ConvMessage {
	role: string;
	content: string;
}

// ─── AI Providers ───

async function callWorkersAI(ai: any, system: string, prompt: string): Promise<string> {
	const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: prompt },
		],
		max_tokens: 512,
		temperature: 0.5,
	});
	const text = result?.response;
	if (!text) throw new Error('Empty Workers AI response');
	return text.trim();
}

async function callGeminiAPI(apiKey: string, system: string, prompt: string): Promise<string> {
	const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];
	const fullPrompt = system + '\n\n' + prompt;

	for (const model of models) {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
		const res = await fetch(`${url}?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: fullPrompt }] }],
				generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
			}),
		});
		if (res.status === 429) continue;
		if (!res.ok) throw new Error(`Gemini ${model}: ${res.status}`);
		const data = (await res.json()) as any;
		const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) throw new Error('Empty Gemini response');
		return text.trim();
	}
	throw new Error('All Gemini models rate limited');
}

async function callAI(apiKey: string, ai: any | undefined, system: string, prompt: string): Promise<string> {
	if (ai) {
		try { return await callWorkersAI(ai, system, prompt); } catch {}
	}
	if (apiKey) {
		return await callGeminiAPI(apiKey, system, prompt);
	}
	throw new Error('No AI provider');
}

// ─── Menu Formatting ───

function formatMenuForPrompt(menuItems: any[]): string {
	if (!menuItems?.length) return 'Menu hiện đang trống.';
	return menuItems.map(i => {
		let price = `${Math.round(i.price).toLocaleString()}đ`;
		if (i.has_promotion && i.discounted_price) {
			price = `${Math.round(i.discounted_price).toLocaleString()}đ (giảm từ ${Math.round(i.price).toLocaleString()}đ)`;
		}
		const promo = i.has_promotion && i.promotion_label ? ` [KM: ${i.promotion_label}]` : '';
		return `- ${i.name}: ${price}${promo}`;
	}).join('\n');
}

// ─── System Prompt ───

function buildSystemPrompt(menuItems: any[], context?: Record<string, any>): string {
	const menuText = formatMenuForPrompt(menuItems);
	const timeOfDay = context?.time_of_day || 'unknown';
	const timeLabels: Record<string, string> = {
		breakfast: 'Buổi sáng (6h-11h)',
		lunch: 'Buổi trưa (11h-14h)',
		afternoon: 'Buổi chiều (14h-17h)',
		dinner: 'Buổi tối (17h-21h)',
		late_night: 'Đêm khuya (21h-6h)',
	};
	const timeHint: Record<string, string> = {
		breakfast: 'Ưu tiên gợi ý món trong menu phù hợp buổi sáng (đồ uống, đồ ăn nhẹ).',
		lunch: 'Ưu tiên gợi ý món trong menu phù hợp buổi trưa (món chính, no bụng).',
		afternoon: 'Ưu tiên gợi ý món trong menu phù hợp buổi chiều (đồ uống giải khát, ăn vặt).',
		dinner: 'Ưu tiên gợi ý món trong menu phù hợp buổi tối (món chính, đồ uống đi kèm).',
		late_night: 'Ưu tiên gợi ý món trong menu phù hợp đêm khuya (nhẹ nhàng, ấm).',
	};

	return `Bạn là Minitake Bot — trợ lý đặt món AI của quán.

⏰ THỜI GIAN HIỆN TẠI: ${timeLabels[timeOfDay] || timeOfDay}
${timeHint[timeOfDay] ? `💡 GỢI Ý THEO THỜI GIAN: ${timeHint[timeOfDay]}` : ''}

═══ MENU CỦA QUÁN (ĐÂY LÀ TOÀN BỘ MENU) ═══
${menuText}
═══ HẾT MENU ═══

QUY TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC nhắc đến các món CÓ TRONG MENU ở trên. TUYỆT ĐỐI KHÔNG được tự bịa, tưởng tượng, hay nhắc bất kỳ món nào không có trong danh sách. Nếu menu trống, nói "Quán hiện chưa có món nào trong menu".
2. Khi khách hỏi gợi ý → ưu tiên gợi ý món PHÙ HỢP VỚI THỜI GIAN hiện tại từ menu trên. Nếu khách muốn món không có → nói "Xin lỗi, quán hiện chưa có món đó" và gợi ý món tương tự từ menu.
3. Khi khách muốn đặt món → xác nhận tên món chính xác từ menu, hỏi số lượng, rồi nói "Mình đã thêm [món] vào giỏ hàng!"
3b. Khi khách muốn bỏ/xóa món khỏi giỏ hàng → xác nhận tên món và nói "Đã bỏ [món] khỏi giỏ hàng!"
4. Khi khách muốn thanh toán → xác nhận giỏ hàng và hướng dẫn nhấn nút "Thanh toán" bên dưới.
5. Trả lời ngắn gọn (tối đa 3-4 câu). Dùng emoji vừa phải.
6. Giao tiếp tiếng Việt tự nhiên, thân thiện.
7. Khi liệt kê món, LUÔN kèm giá.
8. CHỈ nhắc đến khuyến mãi nếu trong menu ở trên CÓ tag [KM:...]. Nếu KHÔNG có món nào có tag [KM:...] thì TUYỆT ĐỐI KHÔNG được nhắc đến khuyến mãi, ưu đãi, hay giảm giá.
9. Khi chào khách hoặc khách hỏi gợi ý mà KHÔNG nói rõ muốn gì, hãy tự nhiên gợi ý 2-3 món phù hợp thời gian hiện tại. CHỈ ĐƯỢC chọn từ MENU ở trên, TUYỆT ĐỐI KHÔNG bịa tên món.`;
}

// ─── Public API ───

export async function generateAIResponse(
	apiKey: string,
	intent: string,
	userMessage: string,
	context: Record<string, any>,
	menuItems: any[],
	conversationHistory: ConvMessage[],
	ai?: any
): Promise<string> {
	const system = buildSystemPrompt(menuItems, context);

	let userPrompt = '';

	if (conversationHistory?.length) {
		const recent = conversationHistory.slice(-6);
		userPrompt += recent.map(m => `${m.role === 'user' ? 'Khách' : 'Bot'}: ${m.content}`).join('\n') + '\n\n';
	}

	if (context.cart_items?.length) {
		const cartSummary = context.cart_items.map((i: any) => `${i.name} x${i.quantity}`).join(', ');
		userPrompt += `[Giỏ hàng hiện tại: ${cartSummary}]\n`;
	} else {
		userPrompt += '[Giỏ hàng trống]\n';
	}

	if (context.recommended_items?.length) {
		userPrompt += `[Gợi ý cho khách: ${context.recommended_items.join(', ')}]\n`;
	}

	userPrompt += `Khách: ${userMessage}\nBot:`;

	return await callAI(apiKey, ai, system, userPrompt);
}

export async function generateRecommendationIds(
	apiKey: string,
	context: Record<string, any>,
	menuItems: any[],
	count: number = 3,
	ai?: any
): Promise<string[]> {
	const itemList = menuItems.map(i => `${i.id}|${i.name}|${Math.round(i.price)}đ${i.has_promotion ? '|KM' : ''}`).join('\n');
	const cartInfo = context.cart_items?.length
		? `Khách đã có: ${context.cart_items.map((i: any) => i.name).join(', ')}. Gợi ý món bổ sung.`
		: 'Giỏ hàng trống.';

	const system = `Bạn là hệ thống gợi ý món. CHỈ trả về ${count} ID món, mỗi dòng 1 ID. KHÔNG giải thích.`;
	const prompt = `Menu:\n${itemList}\n\n${cartInfo}\nThời điểm: ${context.time_of_day || 'không rõ'}`;

	const response = await callAI(apiKey, ai, system, prompt);
	const ids = response.split('\n').map(l => l.trim()).filter(l => menuItems.some(i => i.id === l));
	return ids.slice(0, count);
}

export async function matchMenuItems(
	apiKey: string,
	userMessage: string,
	menuItems: any[],
	ai?: any
): Promise<{ id: string; name: string; quantity: number }[]> {
	const nameList = menuItems.map(i => i.name).join(', ');
	const system = 'Bạn là parser đặt món. Trích xuất tên món và số lượng từ tin nhắn khách. CHỈ trả về format: TÊN_MÓN|SỐ_LƯỢNG (mỗi dòng 1 món, tên món phải CHÍNH XÁC như trong menu). Nếu không rõ số lượng thì mặc định 1. Nếu không tìm thấy món nào thì trả về NONE.';
	const prompt = `Menu: ${nameList}\n\nKhách nói: "${userMessage}"`;

	const response = await callAI(apiKey, ai, system, prompt);
	if (response.includes('NONE')) return [];

	const results: { id: string; name: string; quantity: number }[] = [];
	for (const line of response.split('\n')) {
		const parts = line.trim().split('|');
		if (parts.length >= 2) {
			const name = parts[0].trim();
			// Fuzzy match: exact or includes
			const item = menuItems.find(i =>
				i.name.toLowerCase() === name.toLowerCase() ||
				i.name.toLowerCase().includes(name.toLowerCase()) ||
				name.toLowerCase().includes(i.name.toLowerCase())
			);
			if (item && !results.find(r => r.id === item.id)) {
				results.push({ id: item.id, name: item.name, quantity: parseInt(parts[1]) || 1 });
			}
		}
	}
	return results;
}
