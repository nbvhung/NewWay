import { extractContainerCodes } from './text-parser';

describe('extractContainerCodes', () => {
  it('trích 7 số cuối từ đọc từng chữ số', () => {
    expect(extractContainerCodes('sau tam hai ba hai khong ba')).toEqual([
      '6823203',
    ]);
  });

  it('trích 1-6 số cuối khi lái xe nhập chưa đủ 7 số', () => {
    expect(extractContainerCodes('3')).toEqual(['3']);
    expect(extractContainerCodes('23')).toEqual(['23']);
    expect(extractContainerCodes('hai ba')).toEqual(['23']);
    expect(extractContainerCodes('sau tam hai')).toEqual(['682']);
    expect(extractContainerCodes('68232')).toEqual(['68232']);
    expect(extractContainerCodes('sau tam hai ba hai khong')).toEqual([
      '682320',
    ]);
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

  it('trích các số ngắn (1-4 chữ số) từ văn bản chứa số', () => {
    expect(
      extractContainerCodes('HUN TRUNG / HUNTRUNG-DINHVU / 30-07-2026'),
    ).toEqual(['30', '07', '2026']);
    expect(extractContainerCodes('bay muoi hai')).toEqual(['72']);
    expect(extractContainerCodes('mot tram hai muoi ba')).toEqual(['123']);
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

  it('trích số có ít hơn 7 chữ số khi lái xe đọc', () => {
    expect(extractContainerCodes('muoi hai ba khong hai ba')).toEqual([
      '23023',
    ]);
  });
});
