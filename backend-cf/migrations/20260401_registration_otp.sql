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

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_reg_phone ON pending_registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_registration_otps_phone ON registration_otps(phone);
