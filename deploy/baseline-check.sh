#!/usr/bin/env bash
# Chụp số liệu lương / tài chính / vốn để so sánh trước & sau khi dọn dẹp.
P="docker exec newway-postgres-1 psql -U postgres -d newway -At"
for t in $($P -c "select tablename from pg_tables where schemaname='public' order by 1"); do
  echo "$t|$($P -c "select count(*) from \"$t\"")"
done
for t in salary_records driver_advances finance_entries; do
  $P -c "select '$t', md5(string_agg(x::text, '' order by x::text)) from \"$t\" x" 2>/dev/null
done
