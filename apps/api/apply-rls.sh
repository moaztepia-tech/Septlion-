#!/usr/bin/env sh
set -eu
psql "$DATABASE_URL" -f prisma/rls.sql
