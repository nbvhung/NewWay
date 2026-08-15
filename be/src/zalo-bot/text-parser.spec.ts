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

  it('không trích từ văn bản không có cụm số ít nhất 4 chữ số', () => {
    expect(extractContainerCodes('bay muoi hai')).toEqual([]);
    expect(extractContainerCodes('mot tram hai muoi ba')).toEqual([]);
    expect(extractContainerCodes('abc xyz')).toEqual([]);
  });

  it('trích 7 chữ số từ mã container đầy đủ', () => {
    expect(extractContainerCodes('BMOU sau tam hai ba hai khong ba')).toEqual(['6823203']);
  });

  it('trích nhiều số từ chuỗi chữ số liên tục', () => {
    expect(extractContainerCodes('68232034114651')).toEqual(['6823203', '4114651']);
  });

  it('không đọc số có ít hơn 4 chữ số', () => {
    expect(extractContainerCodes('mot hai ba')).toEqual([]);
    expect(extractContainerCodes('bay muoi hai')).toEqual([]);
    expect(extractContainerCodes('123')).toEqual([]);
  });

  it('trích được số có 4 chữ số (suffix ngắn)', () => {
    expect(extractContainerCodes('3203')).toEqual(['3203']);
    expect(extractContainerCodes('1234')).toEqual(['1234']);
  });

  it('trích được số có 5-6 chữ số (suffix trung)', () => {
    expect(extractContainerCodes('23203')).toEqual(['23203']);
    expect(extractContainerCodes('823203')).toEqual(['823203']);
  });
});
