-- Migration 0189 — Rename billing_history.amount_naira → amount_kobo
-- The column stores INTEGER kobo but was named "amount_naira" — misleading.
-- No value transformation needed (values are already correct kobo integers).

ALTER TABLE billing_history RENAME COLUMN amount_naira TO amount_kobo;
