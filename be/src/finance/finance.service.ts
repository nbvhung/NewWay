import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceEntry } from '../database/entities/finance-entry.entity';

export interface UpsertFinanceDto {
  suaChua?: number;
  nhienLieu?: number;
  cpKhac?: number;
  vonXe?: number;
  vonMooc?: number;
  vonKhac?: number;
  note?: string;
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(FinanceEntry)
    private repo: Repository<FinanceEntry>,
  ) {}

  async getOrCreate(month: number, year: number, userId: number): Promise<FinanceEntry> {
    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
      await this.repo.save(entry);
    }
    return entry;
  }

  async upsert(month: number, year: number, userId: number, dto: UpsertFinanceDto): Promise<FinanceEntry> {
    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
    }
    if (dto.suaChua   !== undefined) entry.suaChua   = dto.suaChua;
    if (dto.nhienLieu !== undefined) entry.nhienLieu = dto.nhienLieu;
    if (dto.cpKhac    !== undefined) entry.cpKhac    = dto.cpKhac;
    if (dto.vonXe     !== undefined) entry.vonXe     = dto.vonXe;
    if (dto.vonMooc   !== undefined) entry.vonMooc   = dto.vonMooc;
    if (dto.vonKhac   !== undefined) entry.vonKhac   = dto.vonKhac;
    if (dto.note      !== undefined) entry.note      = dto.note ?? null;
    return this.repo.save(entry);
  }
}
