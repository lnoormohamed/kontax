-- P34F-01: dual-ownership invariant for org-anchored billing.
--
-- Prisma does not generate CHECK constraints, so these are applied manually
-- AFTER `prisma db push`. Each billing row must belong to exactly one owner:
-- a User (personal plans) or a Group (Teams). Existing rows all have userId set
-- and groupId null, so the constraint holds for them immediately.
--
-- DEPLOY NOTE (P34F-DB01 §09): the deploy runs `prisma db push` on startup and
-- schema drift crash-loops the site. Prisma db push does NOT manage CHECK
-- constraints, so it leaves these alone — but this script must run as a
-- post-push deploy step so the constraints exist in every environment. Re-running
-- is safe: the IF NOT EXISTS guards make it idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_customer_one_owner'
  ) THEN
    ALTER TABLE "SubscriptionCustomer"
      ADD CONSTRAINT subscription_customer_one_owner
      CHECK ((("userId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int) = 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_one_owner'
  ) THEN
    ALTER TABLE "Subscription"
      ADD CONSTRAINT subscription_one_owner
      CHECK ((("userId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int) = 1);
  END IF;
END $$;
