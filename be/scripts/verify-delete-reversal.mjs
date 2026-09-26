/**
 * Kiểm chứng XOÁ CONTAINER → TRỪ SẢN LƯỢNG bằng service THẬT + repository THẬT
 * trên bản dump production.
 *
 * Vì sao cần: luật "xoá cont thì trừ sản lượng" ảnh hưởng trực tiếp tiền lương
 * của lái xe, và bảng ánh xạ claim → ô sản lượng (`CLAIM_FIELD_OVERRIDE`) chỉ
 * đúng nếu khớp với cách bot ghi. Unit test dùng repo giả, còn đây là DB thật.
 *
 * ── Chuẩn bị ────────────────────────────────────────────────────────────────
 *   PG="/c/Program Files/PostgreSQL/15/bin"
 *   PGPASSWORD=postgres "$PG/psql" -U postgres -c "DROP DATABASE IF EXISTS nw_del"
 *   PGPASSWORD=postgres "$PG/psql" -U postgres -c "CREATE DATABASE nw_del"
 *   PGPASSWORD=postgres "$PG/pg_restore" -U postgres -d nw_del --no-owner \
 *     --no-privileges /d/NWW/backups/<newest>.dump
 *   cd be && npx tsc -p tsconfig.build.json --outDir tvbuild
 *
 * ── Chạy (từ thư mục be/) ───────────────────────────────────────────────────
 *   node scripts/verify-delete-reversal.mjs [planId]     # mặc định plan 317
 *
 * Script SẼ XOÁ THẬT trong `nw_del` — chỉ chạy trên DB tạm, đừng trỏ vào prod.
 *
 * Lưu ý: `container_audit_logs` chưa được migrate trên production, nên log
 * audit chỉ ghi cảnh báo (đúng thiết kế best-effort) — đó là kết quả MONG ĐỢI,
 * không phải lỗi. Xem `deploy/migrate-add-container-audit-log.sql`.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';

const PLAN = Number(process.argv[2] || 317);

const ds = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'nw_del',
  synchronize: false,
  entities: ['tvbuild/**/*.entity.js'],
});
await ds.initialize();

const { ContainerImport } = await import('../tvbuild/database/entities/container-import.entity.js');
const { ContainerClaim } = await import('../tvbuild/database/entities/container-claim.entity.js');
const { ContainerAuditLog } = await import('../tvbuild/database/entities/container-audit-log.entity.js');
const { ShippingLine } = await import('../tvbuild/database/entities/shipping-line.entity.js');
const { Submission } = await import('../tvbuild/database/entities/submission.entity.js');
const { EditHistory } = await import('../tvbuild/database/entities/edit-history.entity.js');
const { User } = await import('../tvbuild/database/entities/user.entity.js');
const { ContainerImportService } = await import('../tvbuild/container-import/container-import.service.js');

const svc = new ContainerImportService(
  ds.getRepository(ContainerImport),
  ds.getRepository(ContainerClaim),
  ds.getRepository(ContainerAuditLog),
  ds.getRepository(ShippingLine),
  ds.getRepository(Submission),
  ds.getRepository(EditHistory),
  ds.getRepository(User),
  { syncForPlan: async () => undefined },
);

const ACTOR = { id: 6, fullName: 'Mr Bach' };

async function snapshot(containerId, subIdOverride = undefined) {
  const c = await ds.query(
    `select id, container_code, type, shipping_line_id, submission_id from container_imports where id=$1`,
    [containerId],
  );
  const subId = subIdOverride !== undefined ? subIdOverride : c[0]?.submission_id ?? null;
  const sub = subId
    ? (
        await ds.query(
          `select id, user_id, driver_name, vo_40, hang_40, vo_20, ve_sinh_lai, keo_ve, edit_count
             from submissions where id=$1`,
          [subId],
        )
      )[0]
    : null;
  const claims = await ds.query(
    `select id, claim_type, submission_id from container_claims where container_import_id=$1 order by id`,
    [containerId],
  );
  const hist = subId
    ? await ds.query(`select count(*)::int n from edit_history where submission_id=$1`, [subId])
    : [{ n: 0 }];
  const lastHist = subId
    ? await ds.query(
        `select changes from edit_history where submission_id=$1 order by id desc limit 1`,
        [subId],
      )
    : [];
  return {
    container: c[0] ?? null,
    submission: sub,
    claims,
    histCount: hist[0].n,
    lastChanges: lastHist[0]?.changes ?? null,
  };
}

function diff(before, after) {
  const out = [];
  if (before.submission && after.submission) {
    for (const f of ['vo_40', 'hang_40', 'vo_20', 've_sinh_lai', 'keo_ve', 'edit_count']) {
      const b = before.submission[f];
      const a = after.submission[f];
      if (String(b ?? '') !== String(a ?? '')) {
        out.push(`    ${f}: ${b || '(rong)'} -> ${a || '(rong)'}`);
      }
    }
  }
  out.push(`    claims: ${before.claims.length} -> ${after.claims.length}`);
  out.push(`    edit_history: ${before.histCount} -> ${after.histCount}`);
  out.push(`    container ton tai: ${before.container ? 'co' : 'khong'} -> ${after.container ? 'co' : 'khong'}`);
  if (after.lastChanges && after.lastChanges !== before.lastChanges) {
    out.push(`    edit_history moi: ${after.lastChanges}`);
  }
  return out.join('\n');
}

// ── A. Container của plan có ĐÚNG 1 claim ───────────────────────────────
const [a] = await ds.query(
  `select ci.id, ci.container_code, ci.type
     from container_imports ci
     join container_claims cc on cc.container_import_id = ci.id
    where ci.shipping_line_id = $1
    group by ci.id, ci.container_code, ci.type
   having count(*) = 1
    limit 1`,
  [PLAN],
);
console.log(`=== A. Xoá 1 cont plan ${PLAN} (1 claim) ===`);
if (!a) {
  console.log('  (plan này không có cont nào đúng 1 claim)');
} else {
  console.log(`  ${a.container_code} (${a.type}) id=${a.id}`);
  const aBefore = await snapshot(a.id);
  const aSub = aBefore.submission?.id;
  const aRes = await svc.remove(a.id, ACTOR);
  console.log(diff(aBefore, await snapshot(a.id, aSub)));
  console.log(`  message: ${aRes.message}`);
}

// ── B. Container có NHIỀU claim, ở kế hoạch CHƯA hoàn thành ─────────────
const bRows = await ds.query(`
  select ci.id, ci.container_code, ci.type, sl.name plan_name,
         (select string_agg(cc.claim_type, '+' order by cc.id)
            from container_claims cc where cc.container_import_id = ci.id) types
    from container_imports ci
    join shipping_lines sl on sl.id = ci.shipping_line_id
   where sl.completed = false
     and (select count(*) from container_claims cc where cc.container_import_id = ci.id) >= 2
   order by ci.id desc
   limit 1
`);
console.log('\n=== B. Xoá cont có nhiều claim (kế hoạch chưa xong) ===');
if (!bRows.length) {
  console.log('  (không có cont nào nhiều claim ở kế hoạch chưa hoàn thành)');
} else {
  const b = bRows[0];
  console.log(`  ${b.container_code} (${b.type}) plan=${b.plan_name} id=${b.id} claims=${b.types}`);
  const bBefore = await snapshot(b.id);
  const bSub = bBefore.submission?.id;
  const bRes = await svc.remove(b.id, ACTOR);
  console.log(diff(bBefore, await snapshot(b.id, bSub)));
  console.log(`  message: ${bRes.message}`);
}

// ── C. Container thuộc kế hoạch ĐÃ HOÀN THÀNH → phải bị chặn ────────────
const [c] = await ds.query(`
  select ci.id, ci.container_code, ci.shipping_line_id, sl.name
    from container_imports ci
    join shipping_lines sl on sl.id = ci.shipping_line_id
   where sl.completed = true
     and exists (select 1 from container_claims cc where cc.container_import_id = ci.id)
   limit 1
`);
console.log('\n=== C. Xoá cont của kế hoạch đã hoàn thành (phải bị CHẶN) ===');
console.log(`  ${c.container_code} plan=${c.shipping_line_id} (${c.name}) id=${c.id}`);
const cBefore = await snapshot(c.id);
const cSub = cBefore.submission?.id;
try {
  await svc.remove(c.id, ACTOR);
  console.log('  ❌ KHÔNG chặn — SAI');
} catch (e) {
  console.log(`  ✅ Đã chặn: ${e.constructor.name}`);
  console.log(`     ${String(e.message).slice(0, 110)}...`);
}
console.log(diff(cBefore, await snapshot(c.id, cSub)));

// ── D. Container KHÔNG có claim → sản lượng không đổi ───────────────────
const [d] = await ds.query(
  `select ci.id, ci.container_code, ci.type
     from container_imports ci
    where ci.shipping_line_id = $1 and ci.submission_id is null
    limit 1`,
  [PLAN],
);
console.log('\n=== D. Xoá cont chưa có ghi nhận ===');
if (!d) {
  console.log('  (plan này không còn cont nào chưa ghi nhận)');
} else {
  console.log(`  ${d.container_code} (${d.type}) id=${d.id}`);
  const dRes = await svc.remove(d.id, ACTOR);
  console.log(`  message: ${dRes.message}`);
}

// ── E. Xoá TOÀN BỘ plan → trừ cho mọi lái xe ────────────────────────────
const orphanBefore = await ds.query(`
  select count(*)::int n from container_claims cc
   where not exists (select 1 from container_imports ci where ci.id = cc.container_import_id)`);
const eBefore = await ds.query(
  `select s.id, s.driver_name, s.vo_40, s.edit_count,
          (select count(*) from container_imports ci
            where ci.submission_id = s.id and ci.shipping_line_id = $1) conts
     from submissions s where s.shipping_line_id = $1 order by s.id`,
  [PLAN],
);
const eRes = await svc.removeByPlan(PLAN, ACTOR);
const eAfter = await ds.query(
  `select s.id, s.driver_name, s.vo_40, s.edit_count,
          (select count(*) from container_imports ci
            where ci.submission_id = s.id and ci.shipping_line_id = $1) conts
     from submissions s where s.shipping_line_id = $1 order by s.id`,
  [PLAN],
);
console.log(`\n=== E. Xoá toàn bộ plan ${PLAN} ===`);
console.log(`  message: ${eRes.message.slice(0, 200)}...`);
console.log(`  reversed: ${eRes.reversed.length} lái xe`);
for (const b of eBefore) {
  const af = eAfter.find((x) => x.id === b.id);
  if (String(b.vo_40) !== String(af.vo_40) || b.conts !== af.conts) {
    console.log(
      `    ${b.driver_name}: vo_40 ${b.vo_40 || 0} -> ${af.vo_40 || 0}, cont ${b.conts} -> ${af.conts}, edit_count ${b.edit_count} -> ${af.edit_count}`,
    );
  }
}
const leftover = await ds.query(
  `select count(*)::int n from container_imports where shipping_line_id = $1`,
  [PLAN],
);
const orphanAfter = await ds.query(`
  select count(*)::int n from container_claims cc
   where not exists (select 1 from container_imports ci where ci.id = cc.container_import_id)`);
console.log(`  container còn lại của plan ${PLAN}: ${leftover[0].n}`);
console.log(
  `  claim mồ côi toàn DB: ${orphanBefore[0].n} -> ${orphanAfter[0].n} ${orphanBefore[0].n === orphanAfter[0].n ? '(không phát sinh thêm ✅)' : '❌ PHÁT SINH THÊM'}`,
);

await ds.destroy();
console.log('\nXONG');
