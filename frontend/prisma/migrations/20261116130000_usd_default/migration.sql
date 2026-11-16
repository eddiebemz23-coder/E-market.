-- US dollars are the platform's default pricing currency for new accounts.
ALTER TABLE "users" ALTER COLUMN "preferredCurrency" SET DEFAULT 'USD';