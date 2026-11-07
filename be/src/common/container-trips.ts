/**
 * Dựng "lượt container" (trip) từ container + lịch sử claim.
 *
 * Quy ước nghiệp vụ:
 *  - Mỗi lượt = 1 đơn vị tính tiền/doanh thu (1 container lẻ, 1 bó FR, 1 cặp kẹp).
 *  - Bó FR: 1 bó = 1 lượt; quantity = số container trong bó (dùng cho lương).
 *  - FR lẻ (không bundle): 1 lượt; priceType = V20/V40 (giá vỏ thường),
 *    containerType vẫn giữ V20FR/V40FR để kê đúng loại.
 *  - Kẹp: 1 cặp = 1 lượt; priceType = KV20/KV20FR; quantity = 2.
 *  - KV (kéo về lẻ) = 1 lượt; priceType = loại container gốc.
 *  - VSL = 1 lượt; priceType = VSL.
 *  - REGO/KD2/CLASSIFY = như CLAIM (giá container gốc).
 *  - Bó/kẹp: các container thành viên không tạo lượt doanh thu riêng.
 */

const FR_TYPES = new Set(['V20FR', 'V40FR']);
const KEP_PRICE_TYPE: Record<string, string> = {
  V20: 'KV20',
  V20FR: 'KV20FR',
};

export interface TripContainerLike {
  id: number;
  containerCode: string;
  type: string;
  bundleId: string | null;
  shippingLineId: number | null;
  submissionId: number | null;
  /** Snapshot xe lúc ghi nhận (có thể null với dữ liệu cũ). */
  vehicleId?: number | null;
}

export interface TripClaimLike {
  id: number;
  containerImportId: number;
  submissionId: number;
  claimType: string;
  createdAt: Date | string;
  submissionRef?: {
    userId?: number;
    actualVehicleId?: number | null;
    user?: {
      id?: number;
      homeVehicleId?: number | null;
      soXe?: string;
    } | null;
  } | null;
}

export interface ContainerTrip {
  key: string;
  claimType: string;
  /** Loại dùng để tính doanh thu (H20, H40, VSL, KV20...). */
  priceType: string;
  /** Loại dùng để tính lương (H20, V20FR, VSL, KV...). */
  salaryType: string;
  /** Số container trong lượt (bó/kẹp dùng cho lương). */
  quantity: number;
  containerIds: number[];
  claimIds: number[];
  containerCode: string;
  containerType: string;
  submissionId: number;
  driverId: number;
  vehicleId: number | null;
  claimedAt: Date;
  isBundle: boolean;
  isPair: boolean;
}

export interface TripBuildOptions {
  resolveVehicleId?: (
    claim: TripClaimLike,
    container: TripContainerLike,
  ) => number | null;
  /**
   * Cho phép ghép cặp kẹp hay không. Dashboard truyền hàm kiểm tra giá kẹp:
   * nếu khách không có đơn giá KV20/KV20FR thì KHÔNG ghép cặp, để 2 container
   * được tính giá như 2 vỏ lẻ (đúng quy tắc "tính giá theo vỏ").
   */
  shouldPairClamp?: (mainType: string, clampType: string) => boolean;
}

/** Đơn vị lương theo loại container + số lượng (giống calcSubSalary). */
export function tripSalaryUnits(type: string, quantity: number): number {
  const q = Math.max(0, Number(quantity) || 0);
  if (type === 'V20') return Math.ceil(q / 2);
  if (type === 'V20FR') return Math.ceil(q / 8);
  if (type === 'V40FR') return Math.ceil(q / 4);
  if (type === 'VSL' || type === 'KV') return 1;
  return q;
}

function claimTime(cl: TripClaimLike): number {
  const t = new Date(cl.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function buildContainerTrips(
  containers: TripContainerLike[],
  claims: TripClaimLike[],
  options: TripBuildOptions = {},
): ContainerTrip[] {
  const containerById = new Map<number, TripContainerLike>();
  for (const c of containers) containerById.set(c.id, c);

  const unitKey = (c: TripContainerLike): string =>
    c.bundleId && FR_TYPES.has(String(c.type))
      ? `bundle:${c.shippingLineId}:${c.bundleId}`
      : `single:${c.id}`;
  const unitByContainer = new Map<number, string>();
  for (const c of containers) unitByContainer.set(c.id, unitKey(c));

  const sortedClaims = [...claims].sort(
    (a, b) =>
      claimTime(a) - claimTime(b) || (Number(a.id) || 0) - (Number(b.id) || 0),
  );

  const usedClaims = new Set<number>();
  const pairByContainer = new Map<
    number,
    { mainId: number; clampId: number; mainClaimId: number; clampClaimId: number }
  >();
  const pairList: {
    mainId: number;
    clampId: number;
    mainClaimId: number;
    clampClaimId: number;
    submissionId: number;
  }[] = [];

  // ── Phát hiện cặp kẹp: claim CLAMP + claim ngay trước trong cùng submission ──
  {
    const lastBySubmission = new Map<number, TripClaimLike>();
    for (const cl of sortedClaims) {
      if (cl.claimType === 'CLAMP') {
        const main = lastBySubmission.get(cl.submissionId);
        const clampC = containerById.get(cl.containerImportId);
        const mainC = main ? containerById.get(main.containerImportId) : undefined;
        const kepType = mainC ? KEP_PRICE_TYPE[String(mainC.type)] : undefined;
        const allowPair =
          !!kepType &&
          (!options.shouldPairClamp ||
            options.shouldPairClamp(String(mainC!.type), String(clampC!.type)));
        if (
          main &&
          clampC &&
          mainC &&
          mainC.id !== clampC.id &&
          String(mainC.type) === String(clampC.type) &&
          !FR_TYPES.has(String(mainC.type)) &&
          allowPair &&
          !pairByContainer.has(mainC.id) &&
          !pairByContainer.has(clampC.id)
        ) {
          const pair = {
            mainId: mainC.id,
            clampId: clampC.id,
            mainClaimId: main.id,
            clampClaimId: cl.id,
            submissionId: cl.submissionId,
          };
          pairList.push(pair);
          pairByContainer.set(pair.mainId, pair);
          pairByContainer.set(pair.clampId, pair);
        }
      }
      lastBySubmission.set(cl.submissionId, cl);
    }
  }

  const driverIdOf = (cl: TripClaimLike): number =>
    Number(cl.submissionRef?.userId ?? 0);
  const vehicleIdOf = (
    cl: TripClaimLike,
    c: TripContainerLike,
  ): number | null => {
    if (options.resolveVehicleId) return options.resolveVehicleId(cl, c);
    return (
      cl.submissionRef?.actualVehicleId ??
      cl.submissionRef?.user?.homeVehicleId ??
      cl.submissionRef?.user?.id ??
      null
    );
  };

  const trips: ContainerTrip[] = [];
  const pushTrip = (trip: ContainerTrip) => trips.push(trip);

  // ── 1. Lượt kẹp: 1 cặp = 1 lượt ──
  for (const pair of pairList) {
    const mainC = containerById.get(pair.mainId);
    const clampC = containerById.get(pair.clampId);
    const mainClaim = sortedClaims.find((c) => c.id === pair.mainClaimId);
    const clampClaim = sortedClaims.find((c) => c.id === pair.clampClaimId);
    if (!mainC || !clampC || !mainClaim) continue;
    const priceType = KEP_PRICE_TYPE[String(mainC.type)] || String(mainC.type);
    pushTrip({
      key: `pair:${mainC.id}:${clampC.id}:${pair.mainClaimId}`,
      claimType: 'CLAMP',
      priceType,
      salaryType: String(mainC.type),
      quantity: 2,
      containerIds: [mainC.id, clampC.id],
      claimIds: [mainClaim.id, ...(clampClaim ? [clampClaim.id] : [])],
      containerCode: mainC.containerCode,
      containerType: String(mainC.type),
      submissionId: pair.submissionId,
      driverId: driverIdOf(mainClaim),
      vehicleId: vehicleIdOf(mainClaim, mainC),
      claimedAt: new Date(mainClaim.createdAt),
      isBundle: false,
      isPair: true,
    });
    usedClaims.add(mainClaim.id);
    if (clampClaim) usedClaims.add(clampClaim.id);
  }

  // ── 2. Gom claim theo bó (chỉ các claim tạo doanh thu chính) ──
  const bundleGroups = new Map<string, TripClaimLike[]>();
  for (const cl of sortedClaims) {
    if (usedClaims.has(cl.id)) continue;
    const c = containerById.get(cl.containerImportId);
    if (!c) continue;
    const key = unitByContainer.get(c.id) || `single:${c.id}`;
    if (!key.startsWith('bundle:')) continue;
    // VSL/KV là dịch vụ theo từng container → để bước 3 xử lý riêng.
    if (cl.claimType === 'VSL' || cl.claimType === 'KV') continue;
    const groupKey = `${key}|${cl.claimType}|${cl.submissionId}`;
    const arr = bundleGroups.get(groupKey) ?? [];
    arr.push(cl);
    bundleGroups.set(groupKey, arr);
  }

  for (const [groupKey, groupClaims] of bundleGroups.entries()) {
    const first = groupClaims[0];
    const firstC = containerById.get(first.containerImportId);
    if (!firstC) continue;
    const ids = groupClaims.map((c) => c.containerImportId);
    pushTrip({
      key: `bundle:${groupKey}`,
      claimType: first.claimType,
      priceType: String(firstC.type),
      salaryType: String(firstC.type),
      quantity: groupClaims.length,
      containerIds: ids,
      claimIds: groupClaims.map((c) => c.id),
      containerCode: firstC.containerCode,
      containerType: String(firstC.type),
      submissionId: first.submissionId,
      driverId: driverIdOf(first),
      vehicleId: vehicleIdOf(first, firstC),
      claimedAt: new Date(first.createdAt),
      isBundle: true,
      isPair: false,
    });
    for (const cl of groupClaims) usedClaims.add(cl.id);
  }

  // ── 3. Các claim còn lại: mỗi claim = 1 lượt ──
  for (const cl of sortedClaims) {
    if (usedClaims.has(cl.id)) continue;
    const c = containerById.get(cl.containerImportId);
    if (!c) continue;
    const isVsl = cl.claimType === 'VSL';
    const isKv = cl.claimType === 'KV';
    // FR lẻ (không nằm trong bó) tính giá như vỏ thường: V20FR→V20, V40FR→V40.
    // Loại hiển thị (containerType) vẫn giữ V20FR/V40FR để kê đúng loại.
    const isLoneFr = !c.bundleId && FR_TYPES.has(String(c.type));
    const priceType = isVsl
      ? 'VSL'
      : isLoneFr
        ? String(c.type) === 'V40FR'
          ? 'V40'
          : 'V20'
        : String(c.type);
    const salaryType = isVsl ? 'VSL' : isKv ? 'KV' : String(c.type);
    pushTrip({
      key: `single:${cl.id}`,
      claimType: cl.claimType,
      priceType,
      salaryType,
      quantity: 1,
      containerIds: [c.id],
      claimIds: [cl.id],
      containerCode: c.containerCode,
      containerType: String(c.type),
      submissionId: cl.submissionId,
      driverId: driverIdOf(cl),
      vehicleId: vehicleIdOf(cl, c),
      claimedAt: new Date(cl.createdAt),
      isBundle: false,
      isPair: false,
    });
    usedClaims.add(cl.id);
  }

  return trips;
}
