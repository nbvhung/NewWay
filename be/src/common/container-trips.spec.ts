import { buildContainerTrips } from './container-trips';

const container = (over: any = {}) => ({
  id: 1,
  containerCode: '99999',
  type: 'H40',
  bundleId: null,
  shippingLineId: 1,
  submissionId: null,
  vehicleId: 1,
  ...over,
});

const claim = (over: any = {}) => ({
  id: 1,
  containerImportId: 1,
  submissionId: 101,
  claimType: 'CLAIM',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  submissionRef: { userId: 31, actualVehicleId: 1 },
  ...over,
});

describe('buildContainerTrips', () => {
  it('A CLAIM, B KV, C CLAIM lại cùng container = 3 lượt riêng', () => {
    const trips = buildContainerTrips(
      [container()],
      [
        claim({ id: 1, submissionId: 101, claimType: 'CLAIM' }),
        claim({
          id: 2,
          submissionId: 102,
          claimType: 'KV',
          createdAt: new Date('2026-10-02T00:00:00Z'),
          submissionRef: { userId: 32, actualVehicleId: 2 },
        }),
        claim({
          id: 3,
          submissionId: 103,
          claimType: 'CLAIM',
          createdAt: new Date('2026-10-03T00:00:00Z'),
          submissionRef: { userId: 33, actualVehicleId: 3 },
        }),
      ],
    );

    expect(trips).toHaveLength(3);
    expect(trips.map((t) => t.priceType)).toEqual(['H40', 'H40', 'H40']);
    expect(trips.map((t) => t.salaryType)).toEqual(['H40', 'KV', 'H40']);
    expect(trips.map((t) => t.vehicleId)).toEqual([1, 2, 3]);
    expect(trips.map((t) => t.quantity)).toEqual([1, 1, 1]);
  });

  it('bó 4 V20FR = 1 lượt, quantity 4', () => {
    const containers = [1, 2, 3, 4].map((id) =>
      container({
        id,
        type: 'V20FR',
        bundleId: 'B1',
        containerCode: `FR${id}`,
      }),
    );
    const claims = [1, 2, 3, 4].map((id) =>
      claim({
        id,
        containerImportId: id,
        submissionId: 101,
        claimType: 'CLAIM',
      }),
    );

    const trips = buildContainerTrips(containers, claims);
    expect(trips).toHaveLength(1);
    expect(trips[0].priceType).toBe('V20FR');
    expect(trips[0].salaryType).toBe('V20FR');
    expect(trips[0].quantity).toBe(4);
    expect(trips[0].isBundle).toBe(true);
    expect(trips[0].containerIds).toEqual([1, 2, 3, 4]);
  });

  it('kẹp V20 + V20 = 1 lượt giá KV20, quantity 2', () => {
    const containers = [
      container({ id: 1, type: 'V20', shippingLineId: 1 }),
      container({ id: 2, type: 'V20', shippingLineId: 1 }),
    ];
    const claims = [
      claim({ id: 1, containerImportId: 1, claimType: 'CLAIM' }),
      claim({
        id: 2,
        containerImportId: 2,
        claimType: 'CLAMP',
        createdAt: new Date('2026-10-01T00:00:01Z'),
      }),
    ];

    const trips = buildContainerTrips(containers, claims);
    expect(trips).toHaveLength(1);
    expect(trips[0].priceType).toBe('KV20');
    expect(trips[0].salaryType).toBe('V20');
    expect(trips[0].quantity).toBe(2);
    expect(trips[0].isPair).toBe(true);
    expect(trips[0].claimIds).toEqual([1, 2]);
  });

  it('kẹp V20 nhưng khách không có giá KV20 = 2 lượt vỏ V20 riêng', () => {
    const containers = [
      container({ id: 1, type: 'V20', shippingLineId: 1 }),
      container({ id: 2, type: 'V20', shippingLineId: 1 }),
    ];
    const claims = [
      claim({ id: 1, containerImportId: 1, claimType: 'CLAIM' }),
      claim({
        id: 2,
        containerImportId: 2,
        claimType: 'CLAMP',
        createdAt: new Date('2026-10-01T00:00:01Z'),
      }),
    ];

    const trips = buildContainerTrips(containers, claims, {
      shouldPairClamp: () => false,
    });
    expect(trips).toHaveLength(2);
    expect(trips.map((t) => t.priceType)).toEqual(['V20', 'V20']);
    expect(trips.map((t) => t.quantity)).toEqual([1, 1]);
    expect(trips.every((t) => !t.isPair)).toBe(true);
  });

  it('kẹp H20 không có loại giá kẹp = 2 lượt H20 riêng', () => {
    const containers = [
      container({ id: 1, type: 'H20', shippingLineId: 1 }),
      container({ id: 2, type: 'H20', shippingLineId: 1 }),
    ];
    const claims = [
      claim({ id: 1, containerImportId: 1, claimType: 'CLAIM' }),
      claim({
        id: 2,
        containerImportId: 2,
        claimType: 'CLAMP',
        createdAt: new Date('2026-10-01T00:00:01Z'),
      }),
    ];

    const trips = buildContainerTrips(containers, claims);
    expect(trips).toHaveLength(2);
    expect(trips.map((t) => t.priceType)).toEqual(['H20', 'H20']);
    expect(trips.every((t) => !t.isPair)).toBe(true);
  });

  it('FR lẻ: giữ loại V40FR nhưng tính giá V40', () => {
    const trips = buildContainerTrips(
      [container({ id: 1, type: 'V40FR', bundleId: null })],
      [claim({ id: 1, containerImportId: 1, claimType: 'CLAIM' })],
    );
    expect(trips).toHaveLength(1);
    expect(trips[0].containerType).toBe('V40FR');
    expect(trips[0].priceType).toBe('V40');
    expect(trips[0].salaryType).toBe('V40FR');
    expect(trips[0].isBundle).toBe(false);

    const v20 = buildContainerTrips(
      [container({ id: 2, type: 'V20FR', bundleId: null })],
      [claim({ id: 2, containerImportId: 2, claimType: 'CLAIM' })],
    );
    expect(v20[0].containerType).toBe('V20FR');
    expect(v20[0].priceType).toBe('V20');
  });

  it('VSL = 1 lượt giá VSL, REGO = 1 lượt giá container gốc', () => {
    const vls = buildContainerTrips(
      [container()],
      [claim({ id: 1, claimType: 'VSL' })],
    );
    expect(vls).toHaveLength(1);
    expect(vls[0].priceType).toBe('VSL');
    expect(vls[0].salaryType).toBe('VSL');

    const rego = buildContainerTrips(
      [container()],
      [claim({ id: 1, claimType: 'REGO' })],
    );
    expect(rego).toHaveLength(1);
    expect(rego[0].priceType).toBe('H40');
    expect(rego[0].salaryType).toBe('H40');
  });
});
