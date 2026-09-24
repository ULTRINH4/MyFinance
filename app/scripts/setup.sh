#!/bin/sh
# One-shot setup: create the schema, seed accounts/categories/cards and the
# first user. Safe to re-run (everything is idempotent; the user's password is
# reset to $ADMIN_PASSWORD each time).
set -e
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
npx drizzle-kit push --force
node scripts/seed-taxonomy.js
node scripts/seed-user.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
