import { extractContainerCodes } from './text-parser';

describe('extractContainerCodes', () => {
  it('trích 7 số cuối từ đọc từng chữ số', () => {
    expect(extractContainerCodes('sau tam hai ba hai khong ba')).toEqual(['6823203']);
  });

  it('bỏ qua từ nhiễu khi đọc số', () => {
    expect(extractContainerCodes('o sau tam hai ba hai khong ba oi')).toEqual(['6823203']);
  });

  it('trích được nhiều số trong cùng câu', () => {
    expect(
      extractContainerCodes('sau tam hai ba hai khong ba, bon mot mot bon sau nam mot'),
    ).toEqual(['6823203', '4114651']);
  });

  it('nhận dạng số nhập bằng chữ số', () => {
    expect(extractContainerCodes('so 6823203')).toEqual(['6823203']);
  });

  it('đọc số nguyên lớn theo cấp số', () => {
    expect(extractContainerCodes('sau trieu tam tram hai muoi ba nghin hai tram linh ba')).toEqual([
      '6823203',
    ]);
  });

  it('không trích từ văn bản không có 7 chữ số liên tiếp', () => {
    expect(extractContainerCodes('HUN TRUNG / HUNTRUNG-DINHVU / 30-07-2026')).toEqual([]);
    expect(extractContainerCodes('bay muoi hai')).toEqual([]);
    expect(extractContainerCodes('mot tram hai muoi ba')).toEqual([]);
  });

  it('trích 7 chữ số từ mã container đầy đủ', () => {
    expect(extractContainerCodes('BMOU sau tam hai ba hai khong ba')).toEqual(['6823203']);
  });

  it('trích nhiều số từ chuỗi chữ số liên tục', () => {
    expect(extractContainerCodes('68232034114651')).toEqual(['6823203', '4114651']);
  });

  it('không đọc số có ít hơn 7 chữ số', () => {
    expect(extractContainerCodes('muoi hai ba khong hai ba')).toEqual([]);
  });
});
