import type { Env } from '../types';
import { generateId } from '../utils/crypto';
import { generateAIResponse, matchMenuItems } from './gemini';

// ─── Helpers ───

function getTimeOfDay(): string {
	const hour = new Date().getUTCHours() + 7; // Vietnam timezone
	if (hour >= 6 && hour < 11) return 'breakfast';
	if (hour >= 11 && hour < 14) return 'lunch';
	if (hour >= 14 && hour < 17) return 'afternoon';
	if (hour >= 17 && hour < 21) return 'dinner';
	return 'late_night';
}

// ─── Intent Recognition ───

const INTENT_PATTERNS: Record<string, { priority: number; keywords: string[]; patterns: RegExp[] }> = {
	greeting: {
		priority: 1,
		keywords: ['xin chào', 'chào', 'hello', 'hi', 'hey'],
		patterns: [/^(xin\s)?chào/i, /^(hi|hello|hey)/i],
	},
	ask_menu: {
		priority: 2,
		keywords: ['menu', 'xem menu', 'có món gì', 'thực đơn', 'danh sách'],
		patterns: [/(xem|cho\sxem|show)\s(menu|thực\sđơn)/i, /^menu$/i, /có\s(những|các)?\smón/i],
	},
	ask_recommendation: {
		priority: 2,
		keywords: ['gợi ý', 'nên ăn', 'nên uống', 'món gì', 'ngon', 'mát', 'nóng', 'nhẹ', 'no'],
		patterns: [/(nên|có)\s(ăn|uống|gọi)/i, /gợi\sý/i, /hôm\snay\s(ăn|uống)/i, /(trời|thời tiết).*(nóng|lạnh|mát)/i, /uống\s(gì|nước)/i, /ăn\sgì/i, /món\sgì.*(ngon|hay)/i],
	},
	ask_promotion: {
		priority: 4,
		keywords: ['giảm giá', 'khuyến mãi', 'sale', 'ưu đãi', 'combo', 'rẻ', 'đang giảm'],
		patterns: [/giảm\sgiá/i, /khuyến\smãi/i, /sale/i, /ưu\sđãi/i, /(có|đang).*(giảm|khuyến)/i],
	},
	order_item: {
		priority: 3,
		keywords: ['cho tôi', 'gọi', 'đặt', 'thêm', 'lấy', 'mua', 'order', 'một ly', 'hai ly', 'một phần'],
		patterns: [
			/(cho|gọi|đặt|lấy|mua)\s(tôi|mình|em|anh|chị)?\s?(một|hai|ba|\d+)?/i,
			/thêm.*vào/i,
			/(một|hai|ba|\d+)\s?(ly|phần|cái|tô|đĩa|chai)/i,
		],
	},
	remove_from_cart: {
		priority: 5,
		keywords: ['bỏ', 'xóa', 'bớt', 'hủy', 'không lấy', 'bỏ đi', 'remove', 'bỏ món', 'xóa món', 'không cần', 'không muốn'],
		patterns: [/(bỏ|xóa|bớt|hủy|remove)/i, /không\s(lấy|cần|muốn)/i],
	},
	view_cart: {
		priority: 2,
		keywords: ['giỏ hàng', 'đã đặt', 'đơn hàng', 'xem giỏ'],
		patterns: [/(xem|kiểm\stra)\s(giỏ|đơn)/i, /giỏ\shàng/i, /đã\s(gọi|đặt)\sgì/i],
	},
	payment: {
		priority: 5,
		keywords: ['thanh toán', 'trả tiền', 'pay', 'tính tiền', 'checkout'],
		patterns: [/thanh\stoán/i, /trả\stiền/i, /tính\stiền/i, /checkout/i],
	},
	ask_item_info: {
		priority: 2,
		keywords: ['là gì', 'thế nào', 'như thế nào', 'mô tả'],
		patterns: [/(.+)\s(là\sgì|thế\snào)/i, /cho\s(tôi|mình)\sbiết\svề/i],
	},
	thank: {
		priority: 1,
		keywords: ['cảm ơn', 'thanks', 'thank you'],
		patterns: [/cảm\sơn/i, /thanks/i],
	},
	goodbye: {
		priority: 1,
		keywords: ['tạm biệt', 'bye', 'goodbye'],
		patterns: [/tạm\sbiệt/i, /bye/i],
	},
	help: {
		priority: 1,
		keywords: ['giúp', 'help', 'hướng dẫn', 'làm sao'],
		patterns: [/giúp/i, /help/i, /hướng\sdẫn/i, /làm\ssao/i],
	},
};

function recognizeIntent(message: string): { intent: string; confidence: number; entities: Record<string, any> } {
	const lower = message.toLowerCase().trim();
	let best = { intent: 'fallback', confidence: 0, priority: 0 };

	for (const [intent, cfg] of Object.entries(INTENT_PATTERNS)) {
		let score = 0;
		for (const kw of cfg.keywords) {
			if (lower.includes(kw)) score += 0.3;
		}
		for (const pat of cfg.patterns) {
			if (pat.test(lower)) score += 0.5;
		}
		if (score > 0 && (score > best.confidence || (score === best.confidence && cfg.priority > best.priority))) {
			best = { intent, confidence: Math.min(score, 1), priority: cfg.priority };
		}
	}

	return { intent: best.intent, confidence: best.confidence || 0.1, entities: {} };
}

// ─── Templates (fallback when AI unavailable) ───

const TEMPLATES: Record<string, string[]> = {
	greeting: ['Xin chào! 😊 Mình là trợ lý AI của quán. Bạn muốn xem menu hay gợi ý món?'],
	thank: ['Không có gì ạ! Chúc bạn ngon miệng! 😊'],
	goodbye: ['Tạm biệt bạn! Hẹn gặp lại! 👋'],
	help: ['Mình có thể giúp bạn:\n📋 Xem menu\n🍴 Gợi ý món ngon\n🛒 Đặt món\n💰 Xem khuyến mãi\n💳 Thanh toán'],
	fallback: ['Mình chưa hiểu rõ ý bạn. Bạn có thể thử: xem menu, gợi ý món, hoặc đặt món nhé!'],
};

function pickTemplate(intent: string): string {
	const arr = TEMPLATES[intent] || TEMPLATES.fallback;
	return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Carousel Builder ───

function buildMenuCarousel(items: any[]): any {
	return {
		type: 'carousel',
		items: items.map(i => ({
			id: i.id,
			name: i.name,
			price: i.price,
			discounted_price: i.discounted_price,
			has_promotion: i.has_promotion || false,
			promotion_label: i.promotion_label || null,
			image_url: i.image_url,
			description: i.description,
		})),
	};
}

// ─── DB Operations ───

async function getMenuItems(db: D1Database, storeId: string): Promise<any[]> {
	const [menuResult, promoResult] = await Promise.all([
		db.prepare(
			'SELECT mi.*, c.name as category_name FROM menu_items mi LEFT JOIN categories c ON mi.category_id = c.id WHERE mi.store_id = ? AND mi.is_available = 1 ORDER BY c.display_order, mi.name'
		).bind(storeId).all(),
		db.prepare(
			"SELECT * FROM promotions WHERE store_id = ? AND is_active = 1 AND date(start_date) <= date('now') AND date(end_date) >= date('now')"
		).bind(storeId).all(),
	]);

	const items = menuResult.results ?? [];
	const promos = promoResult.results ?? [];

	// Apply promotions to menu items
	for (const item of items) {
		for (const promo of promos) {
			let applies = false;
			if (promo.apply_to === 'all') {
				applies = true;
			} else if (promo.apply_to === 'category') {
				try {
					const catIds = JSON.parse(promo.category_ids as string || '[]');
					applies = catIds.includes(item.category_id);
				} catch {}
			} else if (promo.apply_to === 'item') {
				try {
					const itemIds = JSON.parse(promo.item_ids as string || '[]');
					applies = itemIds.includes(item.id);
				} catch {}
			}

			if (applies) {
				(item as any).has_promotion = true;
				(item as any).promotion_label = promo.name;
				const price = item.price as number;
				if (promo.promotion_type === 'percentage') {
					let discount = price * (promo.discount_value as number) / 100;
					if (promo.max_discount_amount) discount = Math.min(discount, promo.max_discount_amount as number);
					(item as any).discounted_price = price - discount;
					(item as any).original_price = price;
				} else if (promo.promotion_type === 'fixed') {
					(item as any).discounted_price = Math.max(0, price - (promo.discount_value as number));
					(item as any).original_price = price;
				}
				break; // First matching promo wins
			}
		}
		if (!(item as any).has_promotion) {
			(item as any).has_promotion = false;
		}
	}

	return items;
}

async function createSession(db: D1Database, storeId: string, tableId?: string, customerPhone?: string): Promise<string> {
	const sessionId = generateId();
	await db.prepare(
		"INSERT INTO chatbot_conversations (id, store_id, session_id, messages, created_at, updated_at) VALUES (?, ?, ?, '[]', datetime('now'), datetime('now'))"
	).bind(generateId(), storeId, sessionId).run();
	return sessionId;
}

async function getRecentMessages(db: D1Database, sessionId: string, limit: number): Promise<any[]> {
	try {
		const row = await db.prepare(
			'SELECT messages FROM chatbot_conversations WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
		).bind(sessionId).first<{ messages: string }>();
		if (!row?.messages) return [];
		const msgs = JSON.parse(row.messages);
		return Array.isArray(msgs) ? msgs.slice(-limit) : [];
	} catch { return []; }
}

async function addMessage(db: D1Database, sessionId: string, role: string, content: string, meta?: any): Promise<void> {
	try {
		const row = await db.prepare(
			'SELECT id, messages FROM chatbot_conversations WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
		).bind(sessionId).first<{ id: string; messages: string }>();
		if (!row) return;
		const msgs = JSON.parse(row.messages || '[]');
		msgs.push({ role, content, ...meta, timestamp: new Date().toISOString() });
		await db.prepare(
			"UPDATE chatbot_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?"
		).bind(JSON.stringify(msgs), row.id).run();
	} catch {}
}

// ─── Main Process ───

export async function processMessage(
	env: Env,
	message: string,
	sessionId: string | null,
	storeId: string,
	customerPhone?: string,
	tableId?: string,
	cartItems?: any[]
): Promise<any> {
	const db = env.DB;

	if (!sessionId) {
		sessionId = await createSession(db, storeId, tableId, customerPhone);
	}

	const conversationHistory = await getRecentMessages(db, sessionId, 10);
	const intentResult = recognizeIntent(message);

	const context: Record<string, any> = {
		time_of_day: getTimeOfDay(),
	};
	if (cartItems) context.cart_items = cartItems;

	await addMessage(db, sessionId, 'user', message, {
		intent: intentResult.intent,
		confidence: intentResult.confidence,
	});

	// Always fetch menu for AI context
	const menuItems = await getMenuItems(db, storeId);

	let responseText: string;
	let richContent: any = null;
	let suggestedActions: any[] = [];
	let actions: any[] = []; // Client-side actions (add_to_cart, open_checkout, etc.)

	const hasAI = !!env.GEMINI_API_KEY || !!env.AI;

	try {
		const { intent } = intentResult;

		// ─── EMPTY MENU GUARD ───
		const menuIntents = ['order_item', 'ask_menu', 'ask_recommendation', 'ask_promotion', 'ask_item_info'];
		if (menuIntents.includes(intent) && !menuItems.length) {
			responseText = 'Quán hiện chưa có món nào trong menu. Vui lòng quay lại sau nhé! 😊';
			await addMessage(db, sessionId, 'assistant', responseText);
			return { session_id: sessionId, message: responseText, rich_content: null, suggested_actions: [], actions: [], intent, confidence: intentResult.confidence };
		}

		// ─── ORDER ITEM: Parse items and add to cart ───
		if (intent === 'order_item' && hasAI && menuItems.length) {
			const matched = await matchMenuItems(env.GEMINI_API_KEY, message, menuItems, env.AI);

			if (matched.length) {
				const addActions = matched.map(m => {
					const item = menuItems.find(i => i.id === m.id)!;
					return {
						type: 'add_to_cart',
						item: {
							id: item.id,
							name: item.name,
							price: item.has_promotion && item.discounted_price ? item.discounted_price : item.price,
							image_url: item.image_url,
							quantity: m.quantity,
						},
					};
				});
				actions = addActions;

				const summary = matched.map(m => `${m.name} x${m.quantity}`).join(', ');
				responseText = `Mình đã thêm ${summary} vào giỏ hàng! 🛒\nBạn muốn gọi thêm hay thanh toán luôn?`;
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					{ type: 'quick_reply', label: '🛒 Xem giỏ hàng', payload: 'xem giỏ hàng' },
					{ type: 'quick_reply', label: '💳 Thanh toán', payload: 'thanh toán' },
				];
			} else {
				// AI couldn't match any item — let AI respond naturally with menu context
				responseText = await generateAIResponse(
					env.GEMINI_API_KEY, intent, message, context, menuItems, conversationHistory, env.AI
				);
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
				];
			}

		// ─── REMOVE FROM CART ───
		} else if (intent === 'remove_from_cart') {
			if (!cartItems?.length) {
				responseText = 'Giỏ hàng đang trống, không có gì để bỏ 😊';
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
				];
			} else {
				const lower = message.toLowerCase();
				// Try direct name match against cart items
				const toRemove = cartItems.filter((i: any) => lower.includes(i.name.toLowerCase()));

				if (!toRemove.length && hasAI) {
					// Fallback: use AI to parse item names from message, match against cart
					const matched = await matchMenuItems(env.GEMINI_API_KEY, message, menuItems, env.AI);
					const cartNameSet = new Set(cartItems.map((i: any) => i.name.toLowerCase()));
					for (const m of matched) {
						if (cartNameSet.has(m.name.toLowerCase())) {
							toRemove.push({ name: m.name });
						}
					}
				}

				if (toRemove.length) {
					actions = toRemove.map((m: any) => ({
						type: 'remove_from_cart',
						item: { name: m.name },
					}));
					const summary = toRemove.map((m: any) => m.name).join(', ');
					responseText = `Đã bỏ ${summary} khỏi giỏ hàng! 🗑️`;
					suggestedActions = [
						{ type: 'quick_reply', label: '🛒 Xem giỏ hàng', payload: 'xem giỏ hàng' },
						{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					];
				} else {
					const cartList = cartItems.map((i: any) => i.name).join(', ');
					responseText = `Mình không tìm thấy món đó trong giỏ hàng. Giỏ hàng hiện có: ${cartList}. Bạn muốn bỏ món nào?`;
					suggestedActions = cartItems.map((i: any) => ({
						type: 'quick_reply', label: `❌ Bỏ ${i.name}`, payload: `bỏ ${i.name}`,
					}));
				}
			}

		// ─── PAYMENT: Trigger checkout ───
		} else if (intent === 'payment') {
			if (cartItems?.length) {
				const total = cartItems.reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
				responseText = `Giỏ hàng của bạn có ${cartItems.length} món, tổng ${total.toLocaleString()}đ. Nhấn nút bên dưới để thanh toán! 💳`;
				actions = [{ type: 'open_checkout' }];
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					{ type: 'quick_reply', label: '🍴 Gợi ý thêm', payload: 'gợi ý món' },
				];
			} else {
				responseText = 'Giỏ hàng đang trống! Bạn hãy chọn món trước nhé 😊';
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					{ type: 'quick_reply', label: '🍴 Gợi ý món ngon', payload: 'gợi ý món' },
				];
			}

		// ─── VIEW CART ───
		} else if (intent === 'view_cart') {
			if (cartItems?.length) {
				const lines = cartItems.map((i: any) => `• ${i.name} x${i.quantity} — ${(i.price * i.quantity).toLocaleString()}đ`);
				const total = cartItems.reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
				responseText = `🛒 Giỏ hàng của bạn:\n${lines.join('\n')}\n\n💰 Tổng: ${total.toLocaleString()}đ`;
				suggestedActions = [
					{ type: 'quick_reply', label: '💳 Thanh toán', payload: 'thanh toán' },
					{ type: 'quick_reply', label: '🍴 Gợi ý thêm', payload: 'gợi ý món' },
				];
			} else {
				responseText = 'Giỏ hàng đang trống! Hãy xem menu và chọn món nhé 😊';
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					{ type: 'quick_reply', label: '🍴 Gợi ý món', payload: 'gợi ý món' },
				];
			}

		// ─── MENU ───
		} else if (intent === 'ask_menu' && menuItems.length) {
			if (hasAI) {
				responseText = await generateAIResponse(
					env.GEMINI_API_KEY, intent, message, context, menuItems, conversationHistory, env.AI
				);
			} else {
				responseText = `📋 Menu có ${menuItems.length} món! Lướt carousel bên dưới để xem nhé:`;
			}
			richContent = buildMenuCarousel(menuItems.slice(0, 12));
			const hasPromosMenu = menuItems.some(i => i.has_promotion);
			suggestedActions = [
				{ type: 'quick_reply', label: '🍴 Gợi ý món', payload: 'gợi ý món' },
				...(hasPromosMenu ? [{ type: 'quick_reply', label: '💰 Khuyến mãi', payload: 'có khuyến mãi gì' }] : []),
			];

		// ─── RECOMMENDATION ───
		} else if (intent === 'ask_recommendation' && menuItems.length) {
			if (hasAI) {
				responseText = await generateAIResponse(
					env.GEMINI_API_KEY, intent, message, context, menuItems, conversationHistory, env.AI
				);
			} else {
				const names = menuItems.slice(0, 3).map(i => i.name);
				responseText = `🍴 Mình gợi ý bạn thử: ${names.join(', ')}!`;
			}

			// Extract mentioned items from AI response to build matching carousel
			const mentionedItems = menuItems.filter(i =>
				responseText.toLowerCase().includes(i.name.toLowerCase())
			);
			const recs = mentionedItems.length ? mentionedItems.slice(0, 5) : menuItems.slice(0, 3);
			richContent = buildMenuCarousel(recs);
			const hasPromos = menuItems.some(i => i.has_promotion);
			suggestedActions = [
				{ type: 'quick_reply', label: '📋 Xem full menu', payload: 'xem menu' },
				...(hasPromos ? [{ type: 'quick_reply', label: '💰 Khuyến mãi', payload: 'có khuyến mãi gì' }] : []),
				{ type: 'quick_reply', label: '🛒 Xem giỏ hàng', payload: 'xem giỏ hàng' },
			];

		// ─── PROMOTION ───
		} else if (intent === 'ask_promotion' && menuItems.length) {
			const promoItems = menuItems.filter(i => i.has_promotion);
			if (hasAI) {
				responseText = await generateAIResponse(
					env.GEMINI_API_KEY, intent, message, context, menuItems, conversationHistory, env.AI
				);
			} else if (promoItems.length) {
				responseText = `🎉 Đang có ${promoItems.length} món khuyến mãi!`;
			} else {
				responseText = 'Hiện chưa có khuyến mãi nào. Bạn xem menu nhé!';
			}
			if (promoItems.length) {
				richContent = buildMenuCarousel(promoItems.slice(0, 6));
			}
			suggestedActions = [
				{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
				{ type: 'quick_reply', label: '🍴 Gợi ý món', payload: 'gợi ý món' },
			];

		// ─── AI for other intents ───
		} else if (hasAI) {
			responseText = await generateAIResponse(
				env.GEMINI_API_KEY, intent, message, context, menuItems, conversationHistory, env.AI
			);
			if (intent === 'greeting') {
				const hasPromosGreeting = menuItems.some(i => i.has_promotion);
				suggestedActions = [
					{ type: 'quick_reply', label: '📋 Xem menu', payload: 'xem menu' },
					{ type: 'quick_reply', label: '🍴 Gợi ý món', payload: 'gợi ý món' },
					...(hasPromosGreeting ? [{ type: 'quick_reply', label: '💰 Khuyến mãi', payload: 'có khuyến mãi gì' }] : []),
				];
			}
		} else {
			responseText = pickTemplate(intent);
		}
	} catch {
		responseText = pickTemplate(intentResult.intent);
	}

	await addMessage(db, sessionId, 'assistant', responseText);

	return {
		session_id: sessionId,
		message: responseText,
		rich_content: richContent,
		suggested_actions: suggestedActions,
		actions, // NEW: client-side actions
		intent: intentResult.intent,
		confidence: intentResult.confidence,
	};
}


// ─── Action Handler ───

export async function handleAction(
	env: Env,
	actionType: string,
	actionPayload: Record<string, any>,
	sessionId: string,
	storeId: string
): Promise<any> {
	await addMessage(env.DB, sessionId, 'system', JSON.stringify({ action: actionType, payload: actionPayload }));
	return { success: true, action_type: actionType };
}

// ─── Conversation History ───

export async function getConversationHistory(
	db: D1Database,
	sessionId: string,
	limit: number = 20
): Promise<any> {
	const messages = await getRecentMessages(db, sessionId, limit);
	return { session_id: sessionId, messages };
}
