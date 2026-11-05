<!--
SYNC IMPACT REPORT
==================
Version change: (template/unratified) â†’ 1.0.0
Bump rationale: Hiáº¿n phĂ¡p Ä‘áº§u tiĂªn (initial ratification) cho dá»± Ă¡n New Way. MAJOR vĂ¬
  thiáº¿t láº­p rĂ ng buá»™c governance chĂ­nh thá»©c nÆ¡i trÆ°á»›c Ä‘Ă³ chá»‰ cĂ³ template rá»—ng. Ná»™i dung
  Ä‘Æ°á»£c suy ra tá»« AGENTS.md, README.md vĂ  cáº¥u trĂºc mĂ£ nguá»“n hiá»‡n cĂ³ (be/, fe/, app/, deploy/).
Principles defined:
  I.   Security & Authorization by Default (NON-NEGOTIABLE)
  II.  Data Integrity, Auditability & Reversibility
  III. Business-Rule Preservation & Role Scoping
  IV.  Backward Compatibility & Operational Safety
  V.   Test-Backed Change & Verification
Added sections:
  - Security, Data & Compatibility Constraints
  - Development Workflow & Quality Gates
  - Governance
Templates reviewed for alignment:
  âœ… .specify/templates/plan-template.md â€” gate "Constitution Check" sáº½ Ä‘Æ°á»£c Ä‘Ă¡nh giĂ¡
       theo cĂ¡c NguyĂªn táº¯c Iâ€“V khi láº­p plan.
  âœ… .specify/templates/spec-template.md â€” khĂ´ng cĂ³ token riĂªng cá»§a constitution.
  âœ… .specify/templates/tasks-template.md â€” cĂ¡c nhĂ³m task hiá»‡n cĂ³ Ä‘á»§ chá»— cho testing,
       security vĂ  compatibility.
Follow-up TODOs: none. RATIFICATION_DATE = ngĂ y hiáº¿n phĂ¡p Ä‘Æ°á»£c thĂ´ng qua láº§n Ä‘áº§u.
-->
# New Way Constitution
Há»‡ thá»‘ng XĂ¡c nháº­n Sáº£n lÆ°á»£ng Xe New Way lĂ  ná»n táº£ng logistics phá»¥c vá»¥ lĂ¡i xe, ngÆ°á»i tá»•ng
há»£p, HR vĂ  quáº£n trá»‹ viĂªn trĂªn ba bá» máº·t: backend NestJS, web Next.js vĂ  app React Native
(Expo). CĂ¡c nguyĂªn táº¯c dÆ°á»›i Ä‘Ă¢y rĂ ng buá»™c má»i thay Ä‘á»•i trong `be/`, `fe/`, `app/` vĂ
`deploy/`, ká»ƒ cáº£ cĂ¡c tĂ­nh nÄƒng chÆ°a Ä‘Æ°á»£c Ä‘áº·c táº£.
## Core Principles
### I. Security & Authorization by Default (NON-NEGOTIABLE)
Báº£o máº­t lĂ  máº·c Ä‘á»‹nh, khĂ´ng pháº£i pháº§n thĂªm vĂ o sau cĂ¹ng. Má»i thay Ä‘á»•i MUST giá»¯ hoáº·c siáº¿t
cĂ¡c rĂ ng buá»™c hiá»‡n cĂ³, khĂ´ng Ä‘Æ°á»£c ná»›i lá»ng mĂ  khĂ´ng Ä‘Æ°á»£c cháº¥p thuáº­n.
- **XĂ¡c thá»±c vĂ  phĂ¢n quyá»n táº­p trung.** Web MUST dĂ¹ng JWT trong httpOnly cookie; mobile
  MUST dĂ¹ng Bearer token qua `expo-secure-store`. KhĂ´ng chuyá»ƒn token web sang localStorage.
  Má»i endpoint quáº£n trá»‹ MUST Ä‘i qua `JwtAuthGuard` vĂ  `@Roles(...)`; role há»£p lá»‡ chá»‰ gá»“m
  `laixe`, `tonghop`, `hr`, `admin`, `supper_admin`.
- **XoĂ¡ dá»¯ liá»‡u luĂ´n cáº§n máº­t kháº©u thao tĂ¡c.** Má»i request `DELETE` MUST kĂ¨m máº­t kháº©u qua
  header `x-cost-password` (hoáº·c query `?pw=`), Ä‘Æ°á»£c kiá»ƒm tra bá»Ÿi guard toĂ n cá»¥c
  `DeletePasswordGuard` (`be/src/common/guards/delete-password.guard.ts`) vá»›i háº±ng sá»‘ duy
  nháº¥t `ACTION_PASSWORD` (`be/src/common/security/action-password.ts`). KHĂ”NG miá»…n trá»« báº¥t
  ká»³ ai, ká»ƒ cáº£ `supper_admin`.
- **Báº£o vá»‡ tĂ i chĂ­nh vĂ  nguá»“n vá»‘n.** Chi phĂ­ vĂ  lá»‹ch sá»­ tĂ i chĂ­nh MUST yĂªu cáº§u máº­t kháº©u
  `348` á»Ÿ backend. Khi khoĂ¡ nguá»“n vá»‘n Ä‘Æ°á»£c báº­t, má»i thao tĂ¡c thĂªm/sá»­a/xoĂ¡ vá»‘n Ä‘áº§u tÆ° MUST
  bá»‹ cháº·n cho táº¥t cáº£ tĂ i khoáº£n; chá»‰ hai tĂ i khoáº£n trong
  `be/src/common/security/capital-lock.ts` Ä‘Æ°á»£c khoĂ¡/má»Ÿ, xĂ¡c thá»±c báº±ng máº­t kháº©u Ä‘Äƒng nháº­p
  cá»§a chĂ­nh há».
- **KhĂ´ng lá»™ dá»¯ liá»‡u qua lá»—i.** DTO MUST dĂ¹ng `class-validator` vá»›i thĂ´ng Ä‘iá»‡p tiáº¿ng Viá»‡t;
  `ValidationPipe` giá»¯ `whitelist: true` vĂ  `forbidNonWhitelisted: true`. BĂ­ máº­t MUST chá»‰
  Ä‘áº¿n tá»« biáº¿n mĂ´i trÆ°á»ng, khĂ´ng bao giá» hard-code hoáº·c log ra ngoĂ i.
**Rationale:** Há»‡ thá»‘ng chá»©a dá»¯ liá»‡u sáº£n lÆ°á»£ng, lÆ°Æ¡ng vĂ  tĂ i chĂ­nh cá»§a nhiá»u bĂªn. Má»™t lá»—
há»•ng phĂ¢n quyá»n hoáº·c má»™t láº§n xoĂ¡ nháº§m cĂ³ thá»ƒ lĂ m sai báº£ng kĂª vĂ  máº¥t dá»¯ liá»‡u khĂ´ng thá»ƒ phá»¥c
há»“i; cĂ¡c guard vĂ  máº­t kháº©u thao tĂ¡c lĂ  hĂ ng rĂ o Ä‘Ă£ Ä‘Æ°á»£c kiá»ƒm chá»©ng.
### II. Data Integrity, Auditability & Reversibility
Má»i thay Ä‘á»•i dá»¯ liá»‡u MUST cĂ³ thá»ƒ truy váº¿t vĂ  MUST giá»¯ tĂ­nh nháº¥t quĂ¡n cá»§a sáº£n lÆ°á»£ng, báº£ng
kĂª, lÆ°Æ¡ng vĂ  tĂ i chĂ­nh.
- **Ghi audit cho má»i láº§n sá»­a.** Sá»­a submission MUST tÄƒng `editCount`, cáº­p nháº­t
  `lastEditedAt` vĂ  ghi `edit_history` dáº¡ng JSON diff `{ field: { old, new } }` vá»›i ngÆ°á»i
  sá»­a. CĂ¡c nghiá»‡p vá»¥ tĂ i chĂ­nh vĂ  container MUST ghi log kiá»ƒm toĂ¡n tÆ°Æ¡ng á»©ng
  (`finance_audit_logs`, `container_audit_logs`).
- **Giao dá»‹ch nguyĂªn tá»­.** CĂ¡c thao tĂ¡c nhiá»u bÆ°á»›c nhÆ° trá»« sáº£n lÆ°á»£ng + xoĂ¡ claim + xoĂ¡
  container MUST náº±m trong má»™t transaction; cáº¥m Ä‘á»ƒ láº¡i tráº¡ng thĂ¡i ná»­a vá»i hoáº·c claim má»“ cĂ´i.
- **KhĂ´ng cĂ³ sá»‘ Ă¢m, khĂ´ng cĂ³ sáº£n lÆ°á»£ng áº£o.** Khi xoĂ¡ container, sáº£n lÆ°á»£ng MUST Ä‘Æ°á»£c trá»«
  Ä‘Ăºng Ă´ Ä‘Ă£ cá»™ng qua `container_claims`, khĂ´ng bao giá» trá»« xuá»‘ng dÆ°á»›i 0. Káº¿ hoáº¡ch Ä‘Ă£
  `completed` MUST cháº·n import vĂ  cháº·n xoĂ¡ container cho tá»›i khi bá» tráº¡ng thĂ¡i hoĂ n thĂ nh.
- **Lá»‹ch sá»­ bĂ¡m Ä‘Ăºng thĂ¡ng vĂ  Ä‘Ăºng xe.** LÆ°Æ¡ng cá»©ng vĂ  chi phĂ­ cá»‘ Ä‘á»‹nh MUST xĂ¡c Ä‘á»‹nh theo
  `driver_vehicle_assignments` vĂ  `salary_from`, khĂ´ng theo xe hiá»‡n táº¡i. Äá»•i xe MUST chá»‘t
  `actual_vehicle_id` cá»§a submission cÅ© vá» xe cÅ© trÆ°á»›c khi chuyá»ƒn. Má»i join láº¥y biá»ƒn sá»‘ tá»«
  `submissions.actual_vehicle_id` MUST trá» tá»›i `vehicles.id`.
- **TĂ¡ch biá»‡t New Way A / New Way B.** `users.ben` vĂ  `finance_cost_items.vehicle_user_id`
  MUST giá»¯ sá»• chi phĂ­ riĂªng tá»«ng bĂªn; API MUST tá»« chá»‘i gĂ¡n xe cá»§a bĂªn nĂ y vĂ o sá»• bĂªn kia.
**Rationale:** Dá»¯ liá»‡u nĂ y lĂ  cÄƒn cá»© thanh toĂ¡n vĂ  Ä‘á»‘i soĂ¡t vá»›i lĂ¡i xe, khĂ¡ch hĂ ng. TĂ­nh
nguyĂªn tá»­, audit trail vĂ  quy táº¯c thĂ¡ng/xe lĂ  Ä‘iá»u kiá»‡n Ä‘á»ƒ khĂ´ng tranh cháº¥p vĂ  khĂ´ng máº¥t
dá»¯ liá»‡u lá»‹ch sá»­.
### III. Business-Rule Preservation & Role Scoping
CĂ¡c quy táº¯c nghiá»‡p vá»¥ vĂ  phĂ¢n quyá»n hiá»‡n há»¯u lĂ  há»£p Ä‘á»“ng vá»›i ngÆ°á»i dĂ¹ng; thay Ä‘á»•i chĂºng
MUST Ä‘Æ°á»£c há»i vĂ  cháº¥p thuáº­n trÆ°á»›c.
- **KhĂ´ng tá»± Ă½ Ä‘á»•i nghiá»‡p vá»¥.** Role, quyá»n, luá»“ng edit history, cĂ¡ch tĂ­nh lÆ°Æ¡ng, BHXH,
  Ä‘Æ¡n giĂ¡ khĂ¡ch hĂ ng vĂ  quy táº¯c káº¹p MUST NOT bá»‹ thay Ä‘á»•i khi chÆ°a cĂ³ yĂªu cáº§u rĂµ rĂ ng tá»«
  ngÆ°á»i dĂ¹ng. Má»i thay Ä‘á»•i MUST Ä‘Æ°á»£c pháº£n Ă¡nh Ä‘á»“ng thá»i á»Ÿ backend, web, mobile vĂ  Excel.
- **Giá»›i háº¡n theo xe lĂ m chá»§.** Khi user cĂ³ `visible_driver_ids`, má»i truy váº¥n MUST dĂ¹ng
  `resolveVisibleDriverIds`: káº¿ hoáº¡ch `all_drivers` luĂ´n hiá»ƒn thá»‹, nhÆ°ng sá»‘ liá»‡u chá»‰ tĂ­nh
  cho xe cá»§a há»; container chÆ°a gĂ¡n xe MUST NOT Ä‘Æ°á»£c tĂ­nh cho tĂ i khoáº£n bá»‹ giá»›i háº¡n.
- **KhoĂ¡ sáº£n lÆ°á»£ng Ä‘Ă£ chá»‘t.** Bot vĂ  import MUST cháº·n ghi vĂ o káº¿ hoáº¡ch `completed`, cháº·n
  ghi trĂ¹ng container Ä‘Ă£ cĂ³ `submissionId`, vĂ  MUST cho ngÆ°á»i dĂ¹ng chá»n khi trĂ¹ng mĂ£ thay
  vĂ¬ tá»± Ä‘á»™ng gĂ¡n.
- **Æ¯u tiĂªn tiáº¿ng Viá»‡t vĂ  tĂ­nh dĂ¹ng Ä‘Æ°á»£c.** ThĂ´ng Ä‘iá»‡p lá»—i, nhĂ£n vĂ  tĂ i liá»‡u hÆ°á»›ng ngÆ°á»i
  dĂ¹ng MUST báº±ng tiáº¿ng Viá»‡t. Giao diá»‡n MUST dĂ¹ng Ä‘Æ°á»£c trĂªn Ä‘iá»‡n thoáº¡i cá»§a lĂ¡i xe.
**Rationale:** LĂ¡i xe vĂ  káº¿ toĂ¡n dá»±a vĂ o hĂ nh vi á»•n Ä‘á»‹nh cá»§a há»‡ thá»‘ng. Thay Ä‘á»•i ngáº§m Ä‘á»‹nh
nghÄ©a lĂ  sai báº£ng kĂª hoáº·c máº¥t niá»m tin, nĂªn nghiá»‡p vá»¥ chá»‰ Ä‘á»•i khi cĂ³ chá»§ Ä‘Ă­ch vĂ  Ä‘Æ°á»£c
kiá»ƒm thá»­.
### IV. Backward Compatibility & Operational Safety
Triá»ƒn khai MUST an toĂ n cho dá»¯ liá»‡u tháº­t vĂ  cho thiáº¿t bá»‹ tháº­t Ä‘ang dĂ¹ng trong sáº£n xuáº¥t.
- **TÆ°Æ¡ng thĂ­ch trĂ¬nh duyá»‡t cÅ©.** `fe/package.json` MUST giá»¯ `browserslist` há»— trá»£ Safari
  16.3 cho tá»›i khi xĂ¡c nháº­n khĂ´ng cĂ²n admin dĂ¹ng iOS 16.3. Sau má»—i build, bundle MUST
  khĂ´ng chá»©a class static block (`static { ... }`).
- **Migration cháº¡y tay trÆ°á»›c khi build.** VĂ¬ production khĂ´ng cĂ³ migration runner
  (`synchronize: false`), má»i thay Ä‘á»•i schema MUST kĂ¨m file `.sql` idempotent trong
  `deploy/` vĂ  Ä‘Æ°á»£c cháº¡y trĂªn VPS TRÆ¯á»C `docker compose up -d --build`.
- **TÆ°Æ¡ng thĂ­ch váº­n hĂ nh Zalo Bot.** Webhook vĂ  long-polling loáº¡i trá»« láº«n nhau; khi Ä‘á»•i
  ná»™i dung file audio pháº£i Ä‘á»•i tĂªn file + route + `ZALO_BUON_NGU_AUDIO_URL` Ä‘á»ƒ trĂ¡nh cache.
- **KhĂ´ng phĂ¡ vá»¡ há»£p Ä‘á»“ng API vĂ  export.** Response format (`{ data }`, `{ message }`) vĂ
  Ä‘á»‹nh dáº¡ng Excel (font, mĂ u, border, cá»™t lÆ°Æ¡ng theo role) MUST Ä‘Æ°á»£c giá»¯ nguyĂªn trá»« khi cĂ³
  yĂªu cáº§u thay Ä‘á»•i tÆ°á»ng minh.
- **Cáº¥u hĂ¬nh proxy vĂ  cookie.** Next.js MUST giá»¯ rewrite `/api/*` â†’ backend Ä‘á»ƒ cookie
  same-origin hoáº¡t Ä‘á»™ng trĂªn Safari/iOS.
**Rationale:** Báº£n phĂ¡t hĂ nh phá»¥c vá»¥ ngÆ°á»i dĂ¹ng tháº­t trĂªn thiáº¿t bá»‹ cÅ© vĂ  dá»¯ liá»‡u khĂ´ng thá»ƒ
táº¡o láº¡i. CĂ¡c rĂ ng buá»™c tÆ°Æ¡ng thĂ­ch vĂ  quy trĂ¬nh migration thá»§ cĂ´ng lĂ  thá»© ngÄƒn sá»± cá»‘ sáº£n
xuáº¥t khĂ´ng thá»ƒ kháº¯c phá»¥c nhanh.
### V. Test-Backed Change & Verification
Má»i thay Ä‘á»•i hĂ nh vi MUST cĂ³ kiá»ƒm chá»©ng tá»± Ä‘á»™ng hoáº·c kiá»ƒm chá»©ng trĂªn dá»¯ liá»‡u tháº­t trÆ°á»›c
khi coi lĂ  hoĂ n thĂ nh.
- **Test Ä‘i kĂ¨m thay Ä‘á»•i.** TĂ­nh nÄƒng vĂ  sá»­a lá»—i á»Ÿ backend MUST thĂªm/cáº­p nháº­t spec
  (`*.spec.ts`) tÆ°Æ¡ng á»©ng. CĂ¡c vĂ¹ng nháº¡y cáº£m Ä‘Ă£ cĂ³ test MUST giá»¯ nguyĂªn hoáº·c tÄƒng Ä‘á»™ phá»§:
  `be/src/common/guards/delete-password.guard.spec.ts`,
  `be/src/finance/finance-capital-lock.spec.ts`,
  `be/src/container-import/container-import-reversal.spec.ts`.
- **Kiá»ƒm chá»©ng trĂªn dá»¯ liá»‡u tháº­t khi cĂ³ thá»ƒ.** Thay Ä‘á»•i liĂªn quan xoĂ¡/khĂ´i phá»¥c sáº£n lÆ°á»£ng
  SHOULD Ä‘Æ°á»£c kiá»ƒm tra báº±ng script xĂ¡c minh (vĂ­ dá»¥
  `be/scripts/verify-delete-reversal.mjs`) trÆ°á»›c khi phĂ¡t hĂ nh.
- **Cháº¡y lint/typecheck/build trÆ°á»›c khi bĂ¡o xong.** KhĂ´ng Ä‘Æ°á»£c tuyĂªn bá»‘ hoĂ n thĂ nh khi
  build hoáº·c kiá»ƒm tra kiá»ƒu cĂ²n lá»—i. Náº¿u chÆ°a biáº¿t lá»‡nh chuáº©n, MUST há»i vĂ  ghi láº¡i vĂ o
  `AGENTS.md`.
- **KhĂ´ng há»“i quy hĂ nh vi Ä‘Ă£ sá»­a.** Má»™t thay Ä‘á»•i MUST NOT lĂ m yáº¿u Ä‘i test báº£o máº­t, test
  Ä‘áº£o ngÆ°á»£c sáº£n lÆ°á»£ng hay cĂ¡c parity check hiá»‡n cĂ³.
**Rationale:** Pháº§n lá»›n rá»§i ro náº±m á»Ÿ cĂ¡c luá»“ng xoĂ¡, tĂ­nh lÆ°Æ¡ng vĂ  phĂ¢n quyá»n â€” nÆ¡i lá»—i chá»‰
lá»™ ra khi Ä‘Ă£ áº£nh hÆ°á»Ÿng dá»¯ liá»‡u tháº­t. Test vĂ  kiá»ƒm chá»©ng trĂªn dump tháº­t lĂ  báº±ng chá»©ng tá»‘i
thiá»ƒu Ä‘á»ƒ thay Ä‘á»•i Ä‘Æ°á»£c tin cáº­y.
## Security, Data & Compatibility Constraints
- **BĂ­ máº­t vĂ  cáº¥u hĂ¬nh.** Má»i bĂ­ máº­t (JWT secret, `ZALO_BOT_TOKEN`, `OPENAI_API_KEY`, máº­t
  kháº©u DB) MUST Ä‘áº¿n tá»« biáº¿n mĂ´i trÆ°á»ng vĂ  MUST NOT xuáº¥t hiá»‡n trong mĂ£ nguá»“n, log, test hay
  commit. KhĂ´ng commit file `.env` chá»©a giĂ¡ trá»‹ tháº­t.
- **Máº­t kháº©u ngÆ°á»i dĂ¹ng.** MUST bÄƒm báº±ng bcrypt (salt rounds = 10). KhĂ´ng lÆ°u hoáº·c tráº£ vá»
  máº­t kháº©u dáº¡ng thĂ´.
- **Rate limit & headers.** MUST giá»¯ Helmet, rate limiting (100/phĂºt), CORS khá»›p chĂ­nh xĂ¡c
  origin vĂ  `synchronize: false` á»Ÿ production.
- **ToĂ n váº¹n dá»¯ liá»‡u tĂ i chĂ­nh.** Báº£ng `finance_entries` MUST duy nháº¥t theo
  `(month, year, userId)`; má»i thay Ä‘á»•i chi phĂ­/vá»‘n MUST ghi `finance_audit_logs`.
- **TÆ°Æ¡ng thĂ­ch ná»n táº£ng.** Backend cháº¡y Node.js 20+; PowerShell script MUST tÆ°Æ¡ng thĂ­ch
  Windows PowerShell 5.1; mĂ£ MUST cháº¡y trĂªn Linux (VPS) vĂ  Windows (mĂ¡y phĂ¡t triá»ƒn).
- **Backup vĂ  phá»¥c há»“i.** Thay Ä‘á»•i váº­n hĂ nh MUST NOT phĂ¡ vá»¡ lá»‹ch backup 30 phĂºt/láº§n vĂ
  backup ngĂ y 02:00 vĂ o `/opt/backups/`.
## Development Workflow & Quality Gates
- **NhĂ¡nh vĂ  commit.** NhĂ¡nh theo `<type>/<short-slug>` vá»›i `<type>` âˆˆ {feat, fix, docs,
  chore, refactor}. Commit message ngáº¯n gá»n, mĂ´ táº£ Ä‘Ăºng thay Ä‘á»•i; khĂ´ng commit khi chÆ°a
  Ä‘Æ°á»£c yĂªu cáº§u.
- **TrÆ°á»›c khi merge.** Thay Ä‘á»•i MUST: build Ä‘Æ°á»£c cáº£ `be/`, `fe/` vĂ  (náº¿u liĂªn quan)
  `app/`; pass lint/typecheck; cĂ³ test cho hĂ nh vi má»›i; cáº­p nháº­t `AGENTS.md`/`deploy/`
  náº¿u quy táº¯c hoáº·c quy trĂ¬nh váº­n hĂ nh thay Ä‘á»•i.
- **Thay Ä‘á»•i schema.** MUST kĂ¨m migration idempotent trong `deploy/`, Ä‘Æ°á»£c nĂªu rĂµ thá»© tá»±
  cháº¡y (migration trÆ°á»›c, build sau) vĂ  Ä‘Æ°á»ng lĂ¹i náº¿u cĂ³.
- **Thay Ä‘á»•i xuyĂªn lá»›p.** TĂ­nh nÄƒng áº£nh hÆ°á»Ÿng backend + web + mobile + Excel MUST Ä‘Æ°á»£c
  triá»ƒn khai Ä‘á»“ng bá»™ vĂ  kiá»ƒm tra nháº¥t quĂ¡n giá»¯a cĂ¡c bá» máº·t; khĂ´ng Ä‘á»ƒ lá»‡ch hĂ nh vi.
- **ÄĂ¡nh giĂ¡ hiáº¿n phĂ¡p.** Má»i plan MUST Ä‘iá»n má»¥c "Constitution Check" vĂ  giáº£i trĂ¬nh náº¿u
  vi pháº¡m. Vi pháº¡m khĂ´ng cĂ³ lĂ½ do chĂ­nh Ä‘Ă¡ng MUST cháº·n merge.
## Governance
Hiáº¿n phĂ¡p nĂ y thay tháº¿ cĂ¡c quy Æ°á»›c tĂ¹y nghi khi xung Ä‘á»™t; `AGENTS.md` tiáº¿p tá»¥c lĂ  hÆ°á»›ng dáº«n
váº­n hĂ nh chi tiáº¿t vĂ  MUST Ä‘Æ°á»£c cáº­p nháº­t khi hiáº¿n phĂ¡p thay Ä‘á»•i.
- **Tháº©m quyá»n.** CĂ¡c NguyĂªn táº¯c Iâ€“V lĂ  cá»•ng rĂ ng buá»™c. `/speckit.analyze` coi xung Ä‘á»™t vá»›i
  má»™t MUST lĂ  CRITICAL. Vi pháº¡m MUST Ä‘Æ°á»£c giáº£i quyáº¿t báº±ng cĂ¡ch sá»­a spec, plan hoáº·c tasks â€”
  khĂ´ng báº±ng cĂ¡ch lĂ m loĂ£ng nguyĂªn táº¯c.
- **Sá»­a Ä‘á»•i.** Thay Ä‘á»•i hiáº¿n phĂ¡p MUST cĂ³ lĂ½ do, Ä‘Æ°á»£c ngÆ°á»i phá»¥ trĂ¡ch dá»± Ă¡n cháº¥p thuáº­n, vĂ
  tÄƒng version theo chĂ­nh sĂ¡ch dÆ°á»›i Ä‘Ă¢y. Má»i sá»­a Ä‘á»•i MUST lan truyá»n tá»›i template/command
  phá»¥ thuá»™c trong cĂ¹ng thay Ä‘á»•i vĂ  Ä‘Æ°á»£c ghi trong Sync Impact Report á»Ÿ Ä‘áº§u file nĂ y.
- **ChĂ­nh sĂ¡ch phiĂªn báº£n (SemVer cho governance).** MAJOR = xoĂ¡/Ä‘á»‹nh nghÄ©a láº¡i nguyĂªn táº¯c
  hoáº·c governance khĂ´ng tÆ°Æ¡ng thĂ­ch ngÆ°á»£c; MINOR = thĂªm nguyĂªn táº¯c/má»¥c má»›i hoáº·c má»Ÿ rá»™ng
  Ä‘Ă¡ng ká»ƒ hÆ°á»›ng dáº«n; PATCH = lĂ m rĂµ, sá»­a cĂ¢u chá»¯, tinh chá»‰nh khĂ´ng Ä‘á»•i ngá»¯ nghÄ©a.
- **RĂ  soĂ¡t tuĂ¢n thá»§.** Má»i PR/review MUST kiá»ƒm tra tuĂ¢n thá»§ cĂ¡c nguyĂªn táº¯c nĂ y. Thay Ä‘á»•i
  lĂ m tÄƒng Ä‘á»™ phá»©c táº¡p hoáº·c lá»‡ch khá»i nguyĂªn táº¯c MUST Ä‘Æ°á»£c giáº£i trĂ¬nh trong PR (vĂ  trong
  má»¥c Complexity Tracking cá»§a plan). Vi pháº¡m khĂ´ng giáº£i trĂ¬nh sáº½ cháº·n merge.
- **HÆ°á»›ng dáº«n runtime.** DĂ¹ng `AGENTS.md` (root, `be/`, `fe/`, `app/`, `deploy/`) vĂ
  `deploy/HANDBOOK.md` cho hÆ°á»›ng dáº«n phĂ¡t triá»ƒn vĂ  váº­n hĂ nh hĂ ng ngĂ y.
**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
