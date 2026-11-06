# -*- coding: utf-8 -*-
"""
Đối chiếu sản lượng tháng giữa file bảng kê khách hàng và dữ liệu VPS.

Nguyên tắc:
  - VPS = container_imports (đã claim: submission_id IS NOT NULL) của khách hàng trong tháng.
  - FILE = các sheet tàu + sheet TỔNG của file bảng kê khách hàng.
  - Kéo về (KV) và KD2 là các LƯỢT THÊM, tách riêng khỏi số cont chính.
  - Mã cont chỉ được so khớp trong đúng kế hoạch (sheet tàu), tránh nhầm mã trùng giữa 2 kế hoạch.
  - MEDLOG để trạng thái riêng, chưa kiểm tra.

Chạy:
  $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"; python reconcile.py
"""

import os
import glob
import json
import datetime
import collections
import psycopg2
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ─────────────────────────── CẤU HÌNH ───────────────────────────
DB = dict(host='localhost', port=5432, dbname='newway_check', user='postgres', password='123456')
MONTH, YEAR = 10, 2026

# Mỗi khách hàng: danh sách glob file bảng kê của tháng.
# Khách không có trong dict = chưa có file -> xuất dữ liệu VPS với trạng thái CHƯA CÓ FILE.
CUSTOMER_FILES = {
    2: [os.path.expanduser('~/Downloads/*T10.2026 HPH-NW*.xlsx')],
    # 1: [os.path.expanduser('~/Downloads/*T10.2026 HECHUN*.xlsx')],
}

OUTPUT = os.path.expanduser('~/Downloads/HPH_T10_kiem_tra_cont_theo_tuyen.xlsx')
EXTRA_CLAIMS = {'KV': 'THÊM: KÉO VỀ', 'KD2': 'THÊM: KD2'}
SHORT = {1: 'HE CHUN', 2: 'HPH', 3: 'CIMC', 4: 'WAN HAI', 5: 'AESC', 6: 'HAVICO', 13: 'P&N'}

CATS = ['20F', '40F', '20E', '40E']
FRT = {'V20FR', 'V40FR'}
CATMAP = {'H20': '20F', 'H40': '40F', 'V20': '20E', 'V40': '40E', 'V20FR': '20E', 'V40FR': '40E'}

STATUS_ORDER = {
    'THIẾU: FILE': 0, 'THIẾU: VPS': 1, 'SAI LOẠI': 2,
    'THÊM: KÉO VỀ': 3, 'THÊM: KD2': 4, 'VPS CHƯA CLAIM': 5,
    'OK': 6, 'MEDLOG: CHỜ FILE': 7, 'CHƯA CÓ FILE': 8,
}

# ─────────────────────────── KẾT NỐI DB ───────────────────────────
conn = psycopg2.connect(**DB)
cur = conn.cursor()


def q(sql, params=None):
    cur.execute(sql, params or ())
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


customers = q("select id, name from customers order by id")
custs = {c['id']: c for c in customers}
month_start = f'{YEAR:04d}-{MONTH:02d}-01'
last_day = (datetime.date(YEAR + (MONTH == 12), (MONTH % 12) + 1, 1) - datetime.timedelta(days=1)).isoformat()

plans = {p['id']: p for p in q(
    "select id, name, ngay, route_name, customer_id from shipping_lines where ngay between %s and %s",
    (month_start, last_day))}

conts = q("""
    select ci.id, ci.container_code, ci.type, ci.shipping_line_id, ci.submission_id, ci.bundle_id, ci.vehicle_id,
           s.user_id, s.actual_vehicle_id, u.home_vehicle_id
      from container_imports ci
      join shipping_lines sl on sl.id = ci.shipping_line_id
      left join submissions s on s.id = ci.submission_id
      left join users u on u.id = s.user_id
     where sl.ngay between %s and %s
""", (month_start, last_day))
cbyplan = collections.defaultdict(list)
for c in conts:
    cbyplan[c['shipping_line_id']].append(c)

claims = q("""
    select cl.id, cl.container_import_id, cl.submission_id, cl.claim_type, cl.created_at
      from container_claims cl
      join container_imports ci on ci.id = cl.container_import_id
      join shipping_lines sl on sl.id = ci.shipping_line_id
     where sl.ngay between %s and %s
     order by cl.created_at, cl.id
""", (month_start, last_day))
claims_by_c = collections.defaultdict(list)
for cl in claims:
    claims_by_c[cl['container_import_id']].append(cl)

veh = {v['id']: v['so_xe'] for v in q("select id, so_xe from vehicles")}


def cveh(c):
    for vid in (c.get('vehicle_id'), c.get('actual_vehicle_id'), c.get('home_vehicle_id')):
        if vid and vid in veh:
            return veh[vid]
    return ''


def catok(c, cat):
    """Loại trên file có khớp loại VPS không (bó FR: chỉ dòng đầu có loại)."""
    if cat == CATMAP.get(c['type']):
        return True
    if c['type'] in FRT and c['bundle_id'] and cat is None:
        return True
    return False


# ─────────────────────────── ĐỌC FILE BẢNG KÊ ───────────────────────────
def parse_customer_files(cid, patterns):
    """Trả về (plan_sheet, file_rows) cho 1 khách hàng."""
    files = []
    for pat in patterns:
        files.extend(glob.glob(pat))
    files = sorted(set(files))
    cust_plan_ids = {pid for pid, p in plans.items() if p['customer_id'] == cid}
    if not files or not cust_plan_ids:
        return {}, []

    sheets, tong = [], []
    for f in files:
        wb = openpyxl.load_workbook(f, data_only=True)
        for ws in wb.worksheets:
            rows = []
            for r in range(5, ws.max_row + 1):
                code = ws.cell(r, 2).value
                if not code:
                    continue
                cat = None
                for ci, name in zip(range(4, 8), CATS):
                    v = ws.cell(r, ci).value
                    if v not in (None, '', 0):
                        cat = name
                d = ws.cell(r, 3).value
                if isinstance(d, datetime.datetime):
                    d = d.date().isoformat()
                elif d is not None:
                    d = str(d)[:10]
                rows.append(dict(file=os.path.basename(f), sheet=ws.title, row=r,
                                 code=str(code).strip().upper(), cat=cat, date=d,
                                 route=str(ws.cell(r, 8).value or '').strip(),
                                 vendor=str(ws.cell(r, 11).value or '').strip(),
                                 vehicle=str(ws.cell(r, 10).value or '').strip()))
            if ws.title == 'TỔNG':
                tong += rows
            elif ws.title not in ('QT', 'số xe', 'PPNL'):
                sheets.append((ws.title, rows))
        wb.close()

    # Sheet tàu -> kế hoạch: chọn kế hoạch có nhiều mã cont trùng nhất
    sheet_plan = {}
    for title, rows in sheets:
        codes = {x['code'] for x in rows}
        cnt = collections.Counter()
        for pid in cust_plan_ids:
            n = sum(1 for c in cbyplan[pid] if c['container_code'].upper() in codes)
            if n:
                cnt[pid] = n
        if cnt:
            sheet_plan[title] = cnt.most_common(1)[0][0]
    plan_sheet = {}
    for t, p in sheet_plan.items():
        plan_sheet.setdefault(p, t)

    file_rows = []
    for title, rows in sheets:
        pid = sheet_plan.get(title)
        for x in rows:
            y = dict(x)
            y['plan_guess'] = pid
            y['source'] = 'sheet'
            file_rows.append(y)

    # Sheet TỔNG: chỉ dùng cho kế hoạch KHÔNG có sheet tàu
    for x in tong:
        code = x['code']
        cand = []
        for c in conts:
            if c['container_code'].upper() != code:
                continue
            pid = c['shipping_line_id']
            if pid not in cust_plan_ids:
                continue
            try:
                d = abs((datetime.date.fromisoformat(x['date']) -
                         datetime.date.fromisoformat(str(plans[pid]['ngay']))).days)
            except Exception:
                d = 99
            if d <= 3:
                cand.append((pid, d))
        if not cand:
            continue
        pid = min(cand, key=lambda t: t[1])[0]
        if pid in plan_sheet:
            continue
        y = dict(x)
        y['plan_guess'] = pid
        y['source'] = 'tong'
        file_rows.append(y)

    return plan_sheet, file_rows


def file_matches(code, pid, plan_sheet, file_rows):
    """Các dòng file khớp cont trong ĐÚNG kế hoạch pid."""
    if pid in plan_sheet:
        title = plan_sheet[pid]
        return [x for x in file_rows
                if x.get('source') == 'sheet' and x.get('sheet') == title and x['code'] == code]
    return [x for x in file_rows
            if x.get('source') == 'tong' and x.get('plan_guess') == pid and x['code'] == code]


# ─────────────────────────── ĐỐI CHIẾU ───────────────────────────
data_by_cust = collections.defaultdict(list)
summary = []

for cid, cu in custs.items():
    pids = [pid for pid, p in plans.items() if p['customer_id'] == cid]
    if not pids:
        continue

    patterns = CUSTOMER_FILES.get(cid, [])
    plan_sheet, file_rows = parse_customer_files(cid, patterns) if patterns else ({}, [])
    has_file = bool(file_rows)

    rows = []
    for pid in pids:
        pl = plans[pid]
        for c in cbyplan[pid]:
            code = c['container_code'].upper()
            cl = claims_by_c.get(c['id'], [])
            claimed = c['submission_id'] is not None
            base = dict(route=pl['route_name'], plan_id=pid, plan=pl['name'], ngay=str(pl['ngay']),
                        code=c['container_code'], type=c['type'], file_type='', plate=cveh(c),
                        status='', note='')

            if claimed:
                if not has_file:
                    base['status'] = 'CHƯA CÓ FILE'
                    base['note'] = 'VPS có, chưa có file bảng kê'
                    rows.append(base)
                elif 'MEDLOG' in pl['route_name']:
                    base['status'] = 'MEDLOG: CHỜ FILE'
                    base['note'] = 'Chưa kiểm tra MEDLOG (sẽ xem sau)'
                    rows.append(base)
                else:
                    fm = file_matches(code, pid, plan_sheet, file_rows)
                    if not fm:
                        base['status'] = 'THIẾU: FILE'
                        base['note'] = 'VPS có, file không có'
                        rows.append(base)
                    else:
                        cats = sorted({str(x['cat']) for x in fm})
                        base['file_type'] = '/'.join([x for x in cats if x != 'None'])
                        if any(catok(c, x['cat']) for x in fm):
                            base['status'] = 'OK'
                            base['note'] = ''
                        else:
                            base['status'] = 'SAI LOẠI'
                            base['note'] = 'File loại: ' + base['file_type']
                        rows.append(base)

            # KÉO VỀ / KD2 = lượt thêm, tách riêng
            for clm in cl:
                if clm['claim_type'] not in EXTRA_CLAIMS:
                    continue
                ex = dict(base)
                ex['status'] = EXTRA_CLAIMS[clm['claim_type']]
                if cid in CUSTOMER_FILES and has_file and 'MEDLOG' not in pl['route_name']:
                    fm = file_matches(code, pid, plan_sheet, file_rows)
                    ex['note'] = 'có trong file' if len(fm) > 1 else 'KHÔNG có trong file'
                    ex['file_type'] = '/'.join(sorted({str(x['cat']) for x in fm if x['cat']}))
                elif 'MEDLOG' in pl['route_name']:
                    ex['note'] = 'MEDLOG - chờ file'
                else:
                    ex['note'] = 'chưa có file'
                rows.append(ex)

    # FILE có nhưng VPS không có / VPS có nhưng chưa claim
    if has_file:
        seen = set()
        for x in file_rows:
            key = (x['code'], x['date'], x['cat'], x['vendor'], x['vehicle'])
            if key in seen:
                continue
            seen.add(key)
            pid = x.get('plan_guess')
            plan_codes = {c['container_code'].upper(): c for c in cbyplan.get(pid, [])} if pid else {}
            if pid and x['code'] not in plan_codes:
                pl = plans[pid]
                rows.append(dict(route=pl['route_name'], plan_id=pid, plan=pl['name'], ngay=x['date'],
                                 code=x['code'], type='', file_type=str(x['cat'] or ''), plate=x['vehicle'],
                                 status='THIẾU: VPS', note='File có, VPS không có'))
            elif pid:
                c = plan_codes[x['code']]
                if c['submission_id'] is None:
                    pl = plans[pid]
                    note = 'File có, VPS có cont nhưng chưa claim'
                    if x['vendor'] and x['vendor'] != 'NW':
                        note += f" ({x['vendor']})"
                    rows.append(dict(route=pl['route_name'], plan_id=pid, plan=pl['name'], ngay=x['date'],
                                     code=x['code'], type=c['type'], file_type=str(x['cat'] or ''),
                                     plate=x['vehicle'], status='VPS CHƯA CLAIM', note=note))

    rows.sort(key=lambda r: (str(r.get('route') or ''), str(r.get('ngay') or ''),
                             str(r.get('plan_id') or ''), STATUS_ORDER.get(r['status'], 9),
                             str(r.get('code') or '')))
    data_by_cust[cid] = rows
    summary.append((cid, cu['name'], len(rows), dict(collections.Counter(r['status'] for r in rows))))

# ─────────────────────────── XUẤT EXCEL ───────────────────────────
wb = openpyxl.Workbook()
thin = Side(style='thin', color='CCCCCC')
border = Border(left=thin, right=thin, top=thin, bottom=thin)
hdr_fill = PatternFill('solid', fgColor='1E3A5F')
hdr_font = Font(bold=True, color='FFFFFF', name='Times New Roman', size=11)
fills = {
    'THIẾU: FILE': PatternFill('solid', fgColor='FFC7CE'),
    'THIẾU: VPS': PatternFill('solid', fgColor='FFEB9C'),
    'SAI LOẠI': PatternFill('solid', fgColor='F4B084'),
    'THÊM: KÉO VỀ': PatternFill('solid', fgColor='DDEBF7'),
    'THÊM: KD2': PatternFill('solid', fgColor='E2EFDA'),
    'VPS CHƯA CLAIM': PatternFill('solid', fgColor='EDEDED'),
    'OK': PatternFill('solid', fgColor='C6EFCE'),
    'MEDLOG: CHỜ FILE': PatternFill('solid', fgColor='D9D2E9'),
    'CHƯA CÓ FILE': PatternFill('solid', fgColor='FFF2CC'),
}
headers = ['Tuyến đường', 'Mã KH', 'Kế hoạch', 'Ngày', 'Mã cont', 'Loại VPS',
           'Loại trên file', 'Xe', 'Trạng thái', 'Ghi chú']

# Sheet tổng hợp khách hàng
ws = wb.active
ws.title = 'TONG HOP'
sum_headers = ['Khách hàng', 'Số dòng', 'OK', 'THIẾU: FILE', 'THIẾU: VPS', 'SAI LOẠI',
               'THÊM: KÉO VỀ', 'THÊM: KD2', 'VPS CHƯA CLAIM', 'MEDLOG: CHỜ FILE', 'CHƯA CÓ FILE']
ws.append(sum_headers)
for c in ws[1]:
    c.fill = hdr_fill
    c.font = hdr_font
    c.border = border
for cid, name, n, cnt in summary:
    ws.append([name, n, cnt.get('OK', 0), cnt.get('THIẾU: FILE', 0), cnt.get('THIẾU: VPS', 0),
               cnt.get('SAI LOẠI', 0), cnt.get('THÊM: KÉO VỀ', 0), cnt.get('THÊM: KD2', 0),
               cnt.get('VPS CHƯA CLAIM', 0), cnt.get('MEDLOG: CHỜ FILE', 0), cnt.get('CHƯA CÓ FILE', 0)])
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.border = border
        c.font = Font(name='Times New Roman', size=11)
ws.column_dimensions['A'].width = 45
for col in 'BCDEFGHIJK':
    ws.column_dimensions[col].width = 16
ws.freeze_panes = 'A2'

# Sheet tổng hợp theo tuyến
wsr = wb.create_sheet('TONG HOP TUYEN')
wsr.append(sum_headers[:1] + ['Tuyến đường'] + sum_headers[2:])
for c in wsr[1]:
    c.fill = hdr_fill
    c.font = hdr_font
    c.border = border
for cid, name, n, cnt in summary:
    br = collections.defaultdict(collections.Counter)
    for r in data_by_cust[cid]:
        br[r['route']][r['status']] += 1
    for route in sorted(br):
        c = br[route]
        wsr.append([name, route, c.get('OK', 0), c.get('THIẾU: FILE', 0), c.get('THIẾU: VPS', 0),
                    c.get('SAI LOẠI', 0), c.get('THÊM: KÉO VỀ', 0), c.get('THÊM: KD2', 0),
                    c.get('VPS CHƯA CLAIM', 0), c.get('MEDLOG: CHỜ FILE', 0), c.get('CHƯA CÓ FILE', 0)])
for row in wsr.iter_rows(min_row=2):
    for c in row:
        c.border = border
        c.font = Font(name='Times New Roman', size=11)
for i, w in enumerate([40, 28, 8, 12, 12, 10, 14, 12, 16, 16, 16], 1):
    wsr.column_dimensions[get_column_letter(i)].width = w
wsr.freeze_panes = 'A2'
wsr.auto_filter.ref = f'A1:K{wsr.max_row}'

# Chú thích trạng thái
r = ws.max_row + 3
ws.cell(r, 1, 'GHI CHÚ TRẠNG THÁI').font = Font(bold=True)
legend = [
    ('OK', 'Có cả file và VPS, mã + loại khớp'),
    ('THIẾU: FILE', 'VPS có nhưng file không có'),
    ('THIẾU: VPS', 'File có nhưng VPS không có'),
    ('SAI LOẠI', 'Có cả hai nhưng loại cont khác nhau'),
    ('THÊM: KÉO VỀ', 'Lượt kéo về (KV) – tính thêm cont, để riêng'),
    ('THÊM: KD2', 'Lượt KD2 – tính thêm cont, để riêng'),
    ('VPS CHƯA CLAIM', 'File có, VPS có cont nhưng chưa gán lái xe/claim'),
    ('MEDLOG: CHỜ FILE', 'Tuyến MEDLOG chưa kiểm tra (theo yêu cầu)'),
    ('CHƯA CÓ FILE', 'Khách hàng chưa có file bảng kê để đối chiếu'),
]
for i, (k, v) in enumerate(legend, 1):
    ws.cell(r + i, 1, k).font = Font(bold=True)
    ws.cell(r + i, 2, v)


def sheet_name(name):
    s = str(name)
    for ch in ':\\/?*[]':
        s = s.replace(ch, ' ')
    return s[:31]


for cid, name, n, cnt in summary:
    w = wb.create_sheet(sheet_name(SHORT.get(cid, name)))
    w.append(headers)
    for c in w[1]:
        c.fill = hdr_fill
        c.font = hdr_font
        c.border = border
        c.alignment = Alignment(horizontal='center', wrap_text=True)
    for r0 in data_by_cust[cid]:
        w.append([r0['route'], r0['plan_id'], r0['plan'], r0['ngay'], r0['code'], r0['type'],
                  r0['file_type'], r0['plate'], r0['status'], r0['note']])
        rr = w.max_row
        for c in w[rr]:
            c.border = border
            c.font = Font(name='Times New Roman', size=10)
        f = fills.get(r0['status'])
        if f:
            w.cell(rr, 9).fill = f
    for i, wd in enumerate([24, 8, 24, 12, 16, 10, 12, 14, 20, 32], 1):
        w.column_dimensions[get_column_letter(i)].width = wd
    w.freeze_panes = 'A2'
    w.auto_filter.ref = f'A1:J{w.max_row}'

wb.save(OUTPUT)
print('Saved', OUTPUT)
for s in summary:
    print(s[1], s[2], s[3])

conn.close()
