-- Add new notification email columns to settings table
ALTER TABLE settings ADD COLUMN notify_pm_email text;
ALTER TABLE settings ADD COLUMN notify_accounts_email text;