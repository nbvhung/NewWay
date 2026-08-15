import { extractContainerCodes } from './text-parser';

describe('extractContainerCodes', () => {
  it('trích 7 số cuối từ đọc từng chữ số', () => {
    expect(extractContainerCodes('sau tam hai ba hai khong ba')).toEqual([
      '6823203',
    ]);
  });

  it('không trích 1-3 số cuối (< 4 chữ số); trích được 4-6 số cuối', () => {
    expect(extractContainerCodes('3')).toEqual([]);
    expect(extractContainerCodes('23')).toEqual([]);
    expect(extractContainerCodes('hai ba')).toEqual([]);
    expect(extractContainerCodes('sau tam hai')).toEqual([]);
    expect(extractContainerCodes('3203')).toEqual(['3203']);
    expect(extractContainerCodes('68232')).toEqual(['68232']);
    expect(extractContainerCodes('sau tam hai ba hai khong')).toEqual(['682320']);
  });

  it('không trích mã từ số điện thoại 10 số', () => {
    expect(extractContainerCodes('0912345678')).toEqual([]);
    expect(extractContainerCodes('dien thoai 0912345678 cua toi')).toEqual(
      [],
    );
  });

  it('bỏ qua từ nhiễu khi đọc số', () => {
    expect(extractContainerCodes('o sau tam hai ba hai khong ba oi')).toEqual([
      '6823203',
    ]);
  });

  it('trích được nhiều số trong cùng câu', () => {
    expect(
      extractContainerCodes(
        'sau tam hai ba hai khong ba, bon mot mot bon sau nam mot',
      ),
    ).toEqual(['6823203', '4114651']);
  });

  it('nhận dạng số nhập bằng chữ số', () => {
    expect(extractContainerCodes('so 6823203')).toEqual(['6823203']);
  });

  it('đọc số nguyên lớn theo cấp số', () => {
    expect(
      extractContainerCodes(
        'sau trieu tam tram hai muoi ba nghin hai tram linh ba',
      ),
    ).toEqual(['6823203']);
  });

  it('trích được số >= 4 chữ số từ văn bản có nhiều cụm số', () => {
    // '30-07-2026': '30' và '07' < 4 chữ số nên bỏ qua, chỉ lấy '2026'
    expect(
      extractContainerCodes('HUN TRUNG / HUNTRUNG-DINHVU / 30-07-2026'),
    ).toEqual(['2026']);
    // 2-3 số → bỏ
    expect(extractContainerCodes('bay muoi hai')).toEqual([]);
    expect(extractContainerCodes('mot tram hai muoi ba')).toEqual([]);
  });

  it('không trích khi văn bản không chứa số', () => {
    expect(extractContainerCodes('HUN TRUNG / HUNTRUNG-DINHVU / HONDA')).toEqual(
      [],
    );
    expect(extractContainerCodes('xin chao ban')).toEqual([]);
  });

  it('trích 7 chữ số từ mã container đầy đủ', () => {
    expect(extractContainerCodes('BMOU sau tam hai ba hai khong ba')).toEqual([
      '6823203',
    ]);
  });

  it('trích 7 số cuối từ mã container đầy đủ dạng chữ+số liền', () => {
    expect(extractContainerCodes('BMOU6823203')).toEqual(['6823203']);
  });
  });

  it('trích mã đầy đủ có khoảng trắng giữa chữ và số', () => {
    expect(extractContainerCodes('BMOU 6823203')).toEqual(['6823203']);
  });

  it('không trích mã từ số điện thoại 10 số', () => {
    expect(extractContainerCodes('0912345678')).toEqual([]);
  });

  it('trích nhiều số từ chuỗi chữ số liên tục', () => {
    expect(extractContainerCodes('68232034114651')).toEqual([
      '6823203',
      '4114651',
    ]);
  });

  it('trích số có ít hơn 7 chữ số khi lái xe đọc (≥ 4 chữ số)', () => {
    // 'muoi hai ba khong hai ba' → digit words: 2,3,0,2,3 → '23023' (5 chữ số ≥ 4) → trích được
    expect(extractContainerCodes('muoi hai ba khong hai ba')).toEqual([
      '23023',
    ]);
    // 'mot hai ba' → digit words: 1,2,3 → '123' (3 chữ số < 4) → bỏ qua
    expect(extractContainerCodes('mot hai ba')).toEqual([]);
  });
  });
});
