import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from '../redis/redis.service';
import {
  resolvePermissions,
  PERMISSION_KEYS,
} from '../common/permissions/permissions';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private redisService: RedisService,
  ) {}

  /**
   * Kiểm tra chống leo thang: người quản lý chỉ được gán quyền mà chính mình đang có.
   */
  private validateGrantablePermissions(
    permissions: string[] | undefined,
    actor: { role?: string; permissions?: string[] | null },
  ): string[] | null {
    if (!permissions) return null;
    if (actor?.role === 'supper_admin') {
      return permissions.filter((p) => PERMISSION_KEYS.includes(p));
    }
    const own = new Set(resolvePermissions(actor));
    const granted = permissions.filter((p) => PERMISSION_KEYS.includes(p));
    const over = granted.filter((p) => !own.has(p));
    if (over.length > 0) {
      throw new ForbiddenException(
        `Bạn không thể gán quyền mà mình không có: ${over.join(', ')}`,
      );
    }
    return granted;
  }

  async findAll(currentUser: { role: string; visibleDriverIds?: number[] | null }) {
    const { role: currentRole, visibleDriverIds } = currentUser;

    // Nếu tài khoản có giới hạn xe cụ thể → chỉ trả về đúng những ID đó (+ bản thân)
    if (visibleDriverIds && visibleDriverIds.length > 0) {
      const users = await this.usersRepository.findBy({ id: In(visibleDriverIds) });
      return users.map(({ passwordHash, ...rest }) => rest);
    }

    let users: User[];
    if (currentRole === 'supper_admin') {
      users = await this.usersRepository.find({ order: { createdAt: 'DESC' } });
    } else if (currentRole === 'admin') {
      users = await this.usersRepository.find({
        where: { role: Not('supper_admin') },
        order: { createdAt: 'DESC' },
      });
    } else if (currentRole === 'hr') {
      users = await this.usersRepository.find({
        where: [{ role: 'laixe' }, { role: 'ops' }, { role: 'hr' }],
        order: { createdAt: 'DESC' },
      });
    } else if (currentRole === 'ops') {
      users = await this.usersRepository.find({
        where: { role: 'laixe' },
        order: { createdAt: 'DESC' },
      });
    } else {
      users = await this.usersRepository.find({
        where: [{ role: 'laixe' }, { role: 'ops' }],
        order: { createdAt: 'DESC' },
      });
    }
    return users.map(({ passwordHash, ...rest }) => rest);
  }

  async create(dto: CreateUserDto, currentRole: string, actor: any) {
    const existing = await this.usersRepository.findOne({
      where: { username: dto.username.trim() },
    });
    if (existing) {
      throw new BadRequestException('Tên đăng nhập đã tồn tại');
    }

    let validRole = dto.role || 'laixe';
    if (
      (currentRole === 'ops' || currentRole === 'hr') &&
      validRole !== 'laixe'
    ) {
      throw new ForbiddenException('Bạn chỉ có thể tạo tài khoản lái xe');
    }
    if (currentRole === 'admin' && validRole === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền tạo tài khoản này');
    }

    const permissions = this.validateGrantablePermissions(dto.permissions, actor);

    const hash = bcrypt.hashSync(dto.password, 10);
    const user = this.usersRepository.create({
      username: dto.username.trim(),
      passwordHash: hash,
      fullName: dto.fullName.trim(),
      role: validRole,
      permissions,
      visibleDriverIds: dto.visibleDriverIds?.length ? dto.visibleDriverIds : null,
      soXe: dto.soXe?.trim() || '',
      soMooc: dto.soMooc?.trim() || '',
      stt: dto.stt?.trim() || '',
      sdt: dto.sdt?.trim() || '',
      zaloId: dto.zaloId?.trim() || null,
      zaloBot: dto.zaloBot ?? 0,
      oldCar: dto.oldCar ?? false,
      payBhxh: dto.payBhxh ?? true,
    });
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result;
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    currentRole: string,
    currentUserId: number,
    actor: any,
  ) {
    const target = await this.usersRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (currentRole === 'ops' || currentRole === 'hr') {
      if (target.role !== 'laixe') {
        throw new ForbiddenException('Bạn chỉ có thể sửa tài khoản lái xe');
      }
    }
    if (currentRole === 'admin' && target.role === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền sửa tài khoản này');
    }

    if (dto.fullName) target.fullName = dto.fullName.trim();
    if (dto.role) {
      if (
        (currentRole === 'ops' || currentRole === 'hr') &&
        dto.role !== 'laixe'
      ) {
        throw new ForbiddenException('Bạn chỉ có thể sửa tài khoản lái xe');
      }
      if (currentRole === 'admin' && dto.role === 'supper_admin') {
        throw new ForbiddenException('Bạn không có quyền sửa tài khoản này');
      }
      target.role = dto.role;
    }
    if (dto.permissions !== undefined) {
      target.permissions = this.validateGrantablePermissions(dto.permissions, actor);
    }
    if (dto.visibleDriverIds !== undefined) {
      target.visibleDriverIds = dto.visibleDriverIds?.length ? dto.visibleDriverIds : null;
    }
    if (dto.password) {
      target.passwordHash = bcrypt.hashSync(dto.password, 10);
    }
    if (dto.soXe !== undefined) target.soXe = dto.soXe.trim();
    if (dto.soMooc !== undefined) target.soMooc = dto.soMooc.trim();
    if (dto.stt !== undefined) target.stt = dto.stt.trim();
    if (dto.sdt !== undefined) target.sdt = dto.sdt.trim();
    if (dto.zaloId !== undefined) target.zaloId = dto.zaloId.trim() || null;
    if (dto.zaloBot !== undefined) target.zaloBot = dto.zaloBot;
    if (dto.allowanceFarHome !== undefined)
      target.allowanceFarHome = dto.allowanceFarHome;
    if (dto.allowanceWaitLoading !== undefined)
      target.allowanceWaitLoading = dto.allowanceWaitLoading;
    if (dto.oldCar !== undefined) target.oldCar = dto.oldCar;
    if (dto.payBhxh !== undefined) target.payBhxh = dto.payBhxh;

    const saved = await this.usersRepository.save(target);
    const { passwordHash, ...result } = saved;
    return result;
  }

  /**
   * Đếm dữ liệu liên quan đến tài khoản (submissions, container_imports,
   * edit_history) để admin quyết định xóa toàn bộ hay chỉ khóa tài khoản.
   */
  async getDataCounts(id: number) {
    const [[subs], [cons], [hist]] = await Promise.all([
      this.usersRepository.manager.query(
        'SELECT COUNT(*)::int AS c FROM submissions WHERE user_id = $1',
        [id],
      ),
      this.usersRepository.manager.query(
        `SELECT COUNT(*)::int AS c FROM container_imports
         WHERE submission_id IN (SELECT id FROM submissions WHERE user_id = $1)`,
        [id],
      ),
      this.usersRepository.manager.query(
        `SELECT COUNT(*)::int AS c FROM edit_history
         WHERE edited_by_id = $1 OR submission_id IN (SELECT id FROM submissions WHERE user_id = $1)`,
        [id],
      ),
    ]);
    return {
      submissions: Number(subs?.c || 0),
      containers: Number(cons?.c || 0),
      history: Number(hist?.c || 0),
    };
  }

  /**
   * mode='force': xóa luôn dữ liệu liên quan (submissions, container_imports,
   *   edit_history) rồi xóa tài khoản.
   * mode='block': đổi role sang 'disabled' để chặn đăng nhập, giữ nguyên lịch sử.
   * Không có mode: xóa bình thường; nếu có dữ liệu sẽ từ chối để tránh mất dữ liệu.
   */
  async remove(
    id: number,
    currentRole: string,
    currentUserId: number,
    mode?: string,
  ) {
    if (id === currentUserId) {
      throw new BadRequestException('Không thể xóa tài khoản đang đăng nhập');
    }

    const target = await this.usersRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (
      (currentRole === 'ops' || currentRole === 'hr') &&
      target.role !== 'laixe'
    ) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tài khoản lái xe');
    }
    if (currentRole === 'admin' && target.role === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền xóa tài khoản này');
    }

    if (mode === 'block') {
      target.role = 'disabled';
      await this.usersRepository.save(target);
      await this.redisService.removeRefreshToken(id);
      return { message: 'Đã khóa tài khoản' };
    }

    const counts = await this.getDataCounts(id);
    const hasData = counts.submissions > 0 || counts.containers > 0;

    if (mode === 'force' && hasData) {
      const conn = this.usersRepository.manager.connection;
      await conn.transaction(async (manager) => {
        // Xóa container_imports gắn với submissions của tài khoản
        await manager.query(
          `DELETE FROM container_imports
           WHERE submission_id IN (SELECT id FROM submissions WHERE user_id = $1)`,
          [id],
        );
        // Xóa edit_history của tài khoản (edited_by_id) và của submissions đó
        await manager.query(
          `DELETE FROM edit_history
           WHERE edited_by_id = $1 OR submission_id IN (SELECT id FROM submissions WHERE user_id = $1)`,
          [id],
        );
        await manager.query('DELETE FROM submissions WHERE user_id = $1', [id]);
        await manager.query('DELETE FROM users WHERE id = $1', [id]);
      });
      await this.redisService.removeRefreshToken(id);
      return { message: 'Đã xóa tài khoản và toàn bộ dữ liệu liên quan' };
    }

    if (hasData) {
      throw new BadRequestException(
        `Tài khoản có ${counts.submissions} bản ghi, ${counts.containers} container. Bạn phải chọn "xóa toàn bộ kèm dữ liệu" hoặc "khóa tài khoản".`,
      );
    }

    await this.usersRepository.remove(target);
    return { message: 'Đã xóa người dùng' };
  }

  async findById(id: number) {
    return this.usersRepository.findOne({ where: { id } });
  }
}
