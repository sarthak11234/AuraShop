# DATABASE_BACKUP_RESTORE

**Project:** AuraShop / VEXO
**Phase:** 14 — Release Candidate & Functional Stabilization

This document covers database backup and restore procedures for the PostgreSQL database used by AuraShop.

---

## 1. Database Overview

- **Database:** PostgreSQL
- **ORM:** Prisma v7 with `@prisma/adapter-pg` (node-postgres)
- **Migrations:** Additive only (in `prisma/migrations/`)
- **No resets/truncates:** Migrations never reset or truncate existing data
- **Preserved tables:** users, orders, payments, addresses, products, and all Phase 12–13 tables

---

## 2. Backup Procedures

### Option A: `pg_dump` (Recommended)

```bash
# Full database backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Schema-only backup
pg_dump --schema-only "$DATABASE_URL" > schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Data-only backup
pg_dump --data-only "$DATABASE_URL" > data_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Option B: Provider-native Backup

If using **Neon Free:**
- Neon provides automatic backups and point-in-time recovery
- Neon Free tier: 1 GB storage, backup retention per Neon's free tier limits
- Restore via Neon dashboard or API

---

## 3. Restore Procedures

### Option A: `psql` restore from `pg_dump`

```bash
# Create the database first (if it doesn't exist)
createdb aurashop

# Restore from backup
psql "$DATABASE_URL" < backup_20261105_*.sql
```

### Option B: Prisma Migrate (Schema Only)

```bash
# Deploy migrations to a fresh database
npx prisma migrate deploy

# This creates all tables but does NOT restore data
```

### Option C: Neon Point-in-Time Recovery

If using Neon:
1. Go to Neon dashboard
2. Select the project
3. Choose "Branches" → "Restore from backup"
4. Select the desired point in time
5. Create a new branch from the restored point

---

## 4. Backup Schedule Recommendations

| Frequency | Type | Purpose |
|-----------|------|---------|
| Daily | Full `pg_dump` | Disaster recovery |
| Before migrations | Schema + data | Migration rollback point |
| Before deployment | Full backup | Pre-deployment safety |

---

## 5. Data Integrity Notes

- **No destructive migrations:** All migrations are additive. Existing users, orders, payments, addresses, and products are preserved.
- **Partial unique indexes:** `Address_default_shipping_per_user` and `Address_default_billing_per_user` ensure one default per category per user.
- **FK constraints with onDelete: Restrict:** Admin audit logs cannot be deleted if referenced by orders.
- **Test database isolation:** E2E tests use `aurashop_checkout_test_cba2a23f` — never the development database.

---

## 6. Backup Validation

After restoring a backup, verify:

```bash
# Check table counts
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"User\";"
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Order\";"
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Product\";"

# Verify migrations are up to date
npx prisma migrate status

# Verify Prisma client works
npx prisma validate
```

---

## 7. Zero-Cost Constraints

- No paid backup services
- No external backup accounts
- Backups stored locally (filesystem)
- No automated backup scheduling configured

Manual backup must be initiated before any production deployment or migration.
