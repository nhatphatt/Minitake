-- Minitake F&B D1 Schema
-- All IDs are UUID v4 strings, dates are ISO 8601 TEXT


-- ============ USERS & AUTH ============

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  store_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS super_admins (
  super_admin_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  pending_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  phone_number TEXT,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  store_name TEXT NOT NULL,
  store_slug TEXT NOT NULL,
  plan_id TEXT NOT NULL DEFAULT 'starter',
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============ STORES ============

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  plan_id TEXT DEFAULT 'starter',
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active',
  max_tables INTEGER DEFAULT 10,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_reason TEXT,
  suspended_at TEXT,
  admin_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- ============ MENU ============

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  store_id TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  category_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ============ ORDERS ============

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  table_number TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]', -- JSON array of order items
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT '',
  inventory_warnings TEXT, -- JSON array
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Normalized order items (optional, for querying)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  qr_code_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ============ PAYMENTS ============

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  confirmed_by TEXT,
  confirmation_note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  method_type TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  config TEXT DEFAULT '{}', -- JSON for method-specific config
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ============ PROMOTIONS ============

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  promotion_type TEXT NOT NULL, -- 'percentage' or 'fixed_amount'
  discount_value REAL NOT NULL,
  max_discount_amount REAL,
  apply_to TEXT NOT NULL DEFAULT 'all', -- 'all', 'category', 'items'
  category_ids TEXT DEFAULT '[]', -- JSON array
  item_ids TEXT DEFAULT '[]', -- JSON array
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ============ CUSTOMERS & AI ============

CREATE TABLE IF NOT EXISTS customer_profiles (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  preferences TEXT DEFAULT '{}', -- JSON
  last_order_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS trending_items (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  menu_item_name TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL, -- e.g. 'daily', 'weekly', 'monthly'
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS chatbot_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id)
);

-- ============ INVENTORY ============

CREATE TABLE IF NOT EXISTS dishes_inventory (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  category_name TEXT DEFAULT '',
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'phần',
  is_low_stock INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS inventory_history (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  adjustment_type TEXT NOT NULL, -- 'add', 'subtract', 'set'
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  quantity_changed INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  reference_order_id TEXT,
  adjusted_by TEXT NOT NULL,
  adjusted_at TEXT NOT NULL,
  FOREIGN KEY (inventory_id) REFERENCES dishes_inventory(id)
);

-- ============ STAFF ============

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT DEFAULT '',
  hire_date TEXT,
  salary REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  hours_worked REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  shift_id TEXT,
  check_in_time TEXT NOT NULL,
  check_out_time TEXT,
  hours_worked REAL,
  status TEXT NOT NULL DEFAULT 'checked_in',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

-- ============ SUBSCRIPTIONS ============

CREATE TABLE IF NOT EXISTS subscription_plans (
  plan_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  price_vat REAL NOT NULL DEFAULT 0,
  max_tables INTEGER,
  features TEXT DEFAULT '{}', -- JSON object
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, trial, cancelled, pending_payment
  trial_ends_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  max_tables INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id)
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  payment_id TEXT PRIMARY KEY,
  subscription_id TEXT,
  store_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  amount_vat REAL,
  amount_without_vat REAL,
  payment_method TEXT DEFAULT 'payos',
  status TEXT NOT NULL DEFAULT 'pending',
  payos_order_id INTEGER,
  payos_payment_link TEXT,
  payos_transaction_id TEXT,
  pending_registration_id TEXT,
  metadata TEXT DEFAULT '{}', -- JSON
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id)
);

-- ============ INDEXES ============

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

-- Stores
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_order ON categories(store_id, display_order);

-- Menu Items
CREATE INDEX IF NOT EXISTS idx_menu_items_store_id ON menu_items(store_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_store_available ON menu_items(store_id, is_available);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_store_payment ON orders(store_id, payment_status);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Tables
CREATE INDEX IF NOT EXISTS idx_tables_store_id ON tables(store_id);
CREATE INDEX IF NOT EXISTS idx_tables_store_status ON tables(store_id, status);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON payments(store_id);

-- Payment Methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_store_id ON payment_methods(store_id);

-- Promotions
CREATE INDEX IF NOT EXISTS idx_promotions_store_id ON promotions(store_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(store_id, is_active, start_date, end_date);

-- Customer Profiles
CREATE INDEX IF NOT EXISTS idx_customer_profiles_store_id ON customer_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(store_id, customer_phone);

-- Trending Items
CREATE INDEX IF NOT EXISTS idx_trending_items_store_id ON trending_items(store_id);

-- Chatbot
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_store_id ON chatbot_conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation ON chatbot_messages(conversation_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_dishes_inventory_store_id ON dishes_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_dishes_inventory_store_dish ON dishes_inventory(store_id, dish_name);
CREATE INDEX IF NOT EXISTS idx_dishes_inventory_low_stock ON dishes_inventory(store_id, is_low_stock);
CREATE INDEX IF NOT EXISTS idx_inventory_history_inventory_id ON inventory_history(inventory_id);

-- Employees
CREATE INDEX IF NOT EXISTS idx_employees_store_id ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_store_phone ON employees(store_id, phone_number);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_date ON shifts(store_id, shift_date);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_store_id ON attendance_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin ON attendance_logs(employee_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_attendance_active ON attendance_logs(store_id, status, check_out_time);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_store_id ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Subscription Payments
CREATE INDEX IF NOT EXISTS idx_sub_payments_store_id ON subscription_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_payos ON subscription_payments(payos_order_id);

-- Pending Registrations
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_reg_payment ON pending_registrations(payment_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_reg_phone ON pending_registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_registration_otps_phone ON registration_otps(phone);

-- Super Admins
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

