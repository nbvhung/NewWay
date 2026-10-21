#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nhat ky thay doi (changelog) cho DB newway - chay tren VPS moi 30 phut.

Moi lan chay: doc toan bo du lieu, so voi snapshot lan truoc (theo khoa chinh),
chi ghi phan THAY DOI vao /opt/backups/changelog/YYYY-MM/<timestamp>.jsonl:
  - ADD    : dong moi (kem toan bo noi dung)
  - UPDATE : dong doi gia tri (chi cac cot doi, kem gia tri cu va moi)
  - DELETE : dong bi xoa (kem toan bo noi dung cu)
Lan chay dau tien chi tao snapshot goc (khong sinh file thay doi).
Khoi phuc: ban day du (pg_dump) + ap dung cac file jsonl theo thu tu thoi gian.
"""
import gzip, json, os, subprocess, sys, time

BASE = "/opt/backups/changelog"
STATE = os.path.join(BASE, "state.json.gz")
PSQL = ["docker", "exec", "-i", "newway-postgres-1", "psql", "-U", "postgres", "-d", "newway", "-At"]


def psql(sql):
    r = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True, check=True)
    return r.stdout


def tables_and_pks():
    out = psql("""
      select c.relname,
             coalesce((select string_agg(a.attname, ',' order by array_position(i.indkey::int[], a.attnum::int))
                       from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey)
                       where i.indrelid=c.oid and i.indisprimary), '')
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by 1""")
    res = {}
    for line in out.splitlines():
        if not line.strip():
            continue
        name, pk = line.split("|", 1)
        res[name] = [p for p in pk.split(",") if p]
    return res


def snapshot_table(name, pk):
    out = psql('select row_to_json(t)::text from "%s" t' % name)
    rows = {}
    for line in out.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if pk:
            key = "|".join(str(row.get(p)) for p in pk)
        else:  # bang khong co khoa chinh: dung noi dung lam khoa (chi ADD/DELETE)
            key = line
        rows[key] = row
    return rows


def main():
    os.makedirs(BASE, exist_ok=True)
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    tp = tables_and_pks()
    new_state = {t: snapshot_table(t, pk) for t, pk in tp.items()}

    first = not os.path.exists(STATE)
    events = []
    if not first:
        with gzip.open(STATE, "rt", encoding="utf-8") as f:
            old_state = json.load(f)
        for t, rows in new_state.items():
            old_rows = old_state.get(t, {})
            for k, row in rows.items():
                if k not in old_rows:
                    events.append({"ts": now, "table": t, "op": "ADD", "key": k, "row": row})
                elif old_rows[k] != row:
                    ch = {c: {"old": old_rows[k].get(c), "new": row.get(c)}
                          for c in set(row) | set(old_rows[k]) if old_rows[k].get(c) != row.get(c)}
                    events.append({"ts": now, "table": t, "op": "UPDATE", "key": k, "changes": ch})
            for k, row in old_rows.items():
                if k not in rows:
                    events.append({"ts": now, "table": t, "op": "DELETE", "key": k, "row": row})
        for t in old_state:
            if t not in new_state:
                events.append({"ts": now, "table": t, "op": "DROP_TABLE", "key": "", "row": None})

    if events:
        d = os.path.join(BASE, time.strftime("%Y-%m"))
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, time.strftime("%Y%m%d_%H%M%S") + ".jsonl")
        tmp = path + ".part"
        with open(tmp, "w", encoding="utf-8") as f:
            for e in events:
                f.write(json.dumps(e, ensure_ascii=False, default=str) + "\n")
        os.rename(tmp, path)  # chi hien ten .jsonl khi da ghi xong

    tmp = STATE + ".tmp"
    with gzip.open(tmp, "wt", encoding="utf-8") as f:
        json.dump(new_state, f, ensure_ascii=False, default=str)
    os.replace(tmp, STATE)
    print("%s %s events=%d" % (now, "BASELINE" if first else "OK", len(events)))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR", e)
        sys.exit(1)
