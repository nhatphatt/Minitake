export type Env = {
	DB: D1Database;
	AI: any;
	ENVIRONMENT: string;
	FRONTEND_URL: string;
	JWT_SECRET: string;
	GEMINI_API_KEY: string;
	PAYOS_CLIENT_ID: string;
	PAYOS_API_KEY: string;
	PAYOS_CHECKSUM_KEY: string;
	ESMS_API_KEY: string;
	ESMS_SECRET_KEY: string;
	RESEND_API_KEY: string;
	RESEND_FROM_EMAIL: string;
	WEBHOOK_SECRET: string;
	PRO_PLAN_PRICE: string;
	STARTER_MAX_TABLES: string;
	TRIAL_DAYS: string;
};

export interface User {
	id: string;
	email: string;
	phone?: string;
	name: string;
	password_hash: string;
	role: string;
	store_id: string;
	created_at: string;
	updated_at: string;
}

export interface Store {
	id: string;
	name: string;
	slug: string;
	logo: string;
	address: string;
	phone: string;
	plan_id: string;
	created_at: string;
	updated_at: string;
}

export interface Category {
	id: string;
	name: string;
	store_id: string;
	display_order: number;
	created_at: string;
}

export interface MenuItem {
	id: string;
	name: string;
	description: string;
	price: number;
	category_id: string;
	store_id: string;
	image_url: string;
	is_available: boolean;
	created_at: string;
	original_price?: number;
	discounted_price?: number;
	has_promotion?: boolean;
	promotion_label?: string;
}

export interface OrderItem {
	menu_item_id: string;
	name: string;
	price: number;
	quantity: number;
}

export interface Order {
	id: string;
	store_id: string;
	table_number: string;
	customer_name: string;
	customer_phone: string;
	items: string; // JSON stringified OrderItem[]
	total: number;
	status: string;
	payment_status: string;
	note: string;
	created_at: string;
	updated_at: string;
}

export interface Table {
	id: string;
	store_id: string;
	table_number: string;
	capacity: number;
	qr_code_url: string;
	status: string;
	created_at: string;
}

export interface Payment {
	id: string;
	store_id: string;
	order_id: string;
	amount: number;
	method: string;
	status: string;
	transaction_id: string;
	created_at: string;
}

export interface PaymentMethod {
	id: string;
	store_id: string;
	type: string;
	name: string;
	config: string; // JSON
	is_active: boolean;
	created_at: string;
}

export interface Promotion {
	id: string;
	store_id: string;
	name: string;
	description: string;
	discount_type: string;
	discount_value: number;
	min_order_value: number;
	max_discount: number;
	start_date: string;
	end_date: string;
	is_active: boolean;
	applicable_items: string; // JSON
	created_at: string;
}

export interface CustomerProfile {
	id: string;
	store_id: string;
	phone: string;
	name: string;
	email: string;
	total_orders: number;
	total_spent: number;
	last_order_at: string;
	preferences: string; // JSON
	created_at: string;
}

export interface TrendingItem {
	id: string;
	store_id: string;
	menu_item_id: string;
	score: number;
	order_count: number;
	period: string;
	created_at: string;
}

export interface ChatbotConversation {
	id: string;
	store_id: string;
	session_id: string;
	messages: string; // JSON
	created_at: string;
	updated_at: string;
}

export interface DishInventory {
	id: string;
	store_id: string;
	menu_item_id: string;
	quantity: number;
	low_stock_threshold: number;
	updated_at: string;
}

export interface InventoryHistory {
	id: string;
	store_id: string;
	menu_item_id: string;
	change_amount: number;
	reason: string;
	created_by: string;
	created_at: string;
}

export interface Employee {
	id: string;
	store_id: string;
	name: string;
	email: string;
	phone: string;
	role: string;
	is_active: boolean;
	created_at: string;
}

export interface Shift {
	id: string;
	store_id: string;
	name: string;
	start_time: string;
	end_time: string;
	days_of_week: string; // JSON
	created_at: string;
}

export interface AttendanceLog {
	id: string;
	store_id: string;
	employee_id: string;
	shift_id: string;
	check_in: string;
	check_out: string;
	status: string;
	note: string;
	created_at: string;
}

export interface Subscription {
	id: string;
	store_id: string;
	plan_id: string;
	status: string;
	current_period_start: string;
	current_period_end: string;
	trial_end: string;
	created_at: string;
	updated_at: string;
}

export interface SubscriptionPlan {
	id: string;
	name: string;
	slug: string;
	price: number;
	features: string; // JSON
	max_tables: number;
	max_items: number;
	created_at: string;
}

export interface SubscriptionPayment {
	id: string;
	subscription_id: string;
	store_id: string;
	amount: number;
	status: string;
	payment_method: string;
	transaction_id: string;
	created_at: string;
}

export interface PendingRegistration {
	id: string;
	email: string;
	name: string;
	password_hash: string;
	store_name: string;
	store_slug: string;
	plan_id: string;
	verification_token: string;
	expires_at: string;
	created_at: string;
}

export interface SuperAdmin {
	id: string;
	email: string;
	name: string;
	password_hash: string;
	created_at: string;
}

export interface JwtPayload {
	sub: string;
	email: string;
	role: string;
	store_id: string;
	exp: number;
	iat: number;
}
