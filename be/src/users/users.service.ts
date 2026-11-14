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
  AssignmentsService,
  todayVN,
} from '../assignments/assignments.service';
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
    private readonly assignmentsService: AssignmentsService,
  ) {}

  /**
   * Kiểm tra chống leo thang: chỉ admin / supper_admin được cấp/sửa quyền;
   * admin chỉ được gán quyền mà chính mình đang có. Các role khác bị chặn.
   */
  private validateGrantablePermissions(
    permissions: string[] | undefined,
    actor: { role?: string; permissions?: string[] | null },
    existing?: string[] | null,
  ): string[] | null {
    if (!permissions) return null;
    if (actor?.role === 'supper_admin') {
      return permissions.filter((p) => PERMISSION_KEYS.includes(p));
    }
    if (actor?.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ admin hoặc supper_admin được cấp / sửa quyền',
      );
    }
    const own = new Set(resolvePermissions(actor));
    // Quyền tài khoản đích đang có sẵn được phép giữ nguyên (không phải leo
    // thang) — nhờ vậy tài khoản quản lý giới hạn vẫn sửa được thông tin của
    // admin cấp cao hơn mà không vô tình gỡ quyền của họ.
    const keep = new Set(Array.isArray(existing) ? existing : []);
    const granted = permissions.filter((p) => PERMISSION_KEYS.includes(p));
    const over = granted.filter((p) => !own.has(p) && !keep.has(p));
    if (over.length > 0) {
      throw new ForbiddenException(
        `Bạn không thể gán quyền mà mình không có: ${over.join(', ')}`,
      );
    }
    return granted;
  }

  /**
   * @param currentUser Người đang đăng nhập.
   * @param opts.forAssignment = true → bỏ qua giới hạn `visibleDriverIds`, trả về
   *   TOÀN BỘ danh sách (để form tạo kế hoạch hiện đủ lái xe cho admin phân công).
   *   Chỉ admin/supper_admin được dùng chế độ này.
   */
  async findAll(
    currentUser: { role: string; visibleDriverIds?: number[] | null },
    opts: { forAssignment?: boolean } = {},
  ) {
    const { role: currentRole, visibleDriverIds } = currentUser;

    // Chế độ phân công kế hoạch: bỏ qua giới hạn xe → trả về đủ lái xe để
    // admin/ops chọn từng người. admin / supper_admin / ops được dùng chế độ này;
    // các role khác rơi xuống logic thường bên dưới.
    const canAssign =
      currentRole === 'admin' ||
      currentRole === 'supper_admin' ||
      currentRole === 'ops';
    if (opts.forAssignment && canAssign) {
      const users = await this.usersRepository.find({
        order: { createdAt: 'DESC' },
      });
      return users.map(({ passwordHash, ...rest }) => rest);
    }

    // Giới hạn theo xe CHỈ áp cho role 'admin' (chủ vốn). ops / hr / supper_admin
    // ... làm việc với tất cả lái xe → bỏ qua, rơi xuống nhánh theo role bên dưới.
    if (currentRole === 'admin' && Array.isArray(visibleDriverIds)) {
      const ids = visibleDriverIds
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
      const users = ids.length
        ? await this.usersRepository.findBy({ id: In(ids) })
        : [];
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

    const validRole = dto.role || 'laixe';
    if (
      (currentRole === 'ops' || currentRole === 'hr') &&
      validRole !== 'laixe'
    ) {
      throw new ForbiddenException('Bạn chỉ có thể tạo tài khoản lái xe');
    }
    if (currentRole === 'admin' && validRole === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền tạo tài khoản này');
    }

    const permissions =
      validRole === 'partner'
        ? ['container.view', 'tab.progress']
        : this.validateGrantablePermissions(dto.permissions, actor);

    let customerId: number | null = null;
    if (validRole === 'partner') {
      const custRows: Array<{ id: number }> =
        await this.usersRepository.manager.query(
          'SELECT id FROM customers WHERE mst = $1 LIMIT 1',
          [dto.username.trim()],
        );
      if (custRows[0]?.id) {
        customerId = Number(custRows[0].id);
      }
    }

    const hash = bcrypt.hashSync(dto.password, 10);
    const user = this.usersRepository.create({
      username: dto.username.trim(),
      passwordHash: hash,
      fullName: dto.fullName.trim(),
      role: validRole,
      permissions,
      customerId,
      visibleDriverIds: dto.visibleDriverIds ?? null,
      ben: dto.ben?.trim() || null,
      soXe: dto.soXe?.trim() || '',
      soMooc: dto.soMooc?.trim() || '',
      stt: dto.stt?.trim() || '',
      sdt: dto.sdt?.trim() || '',
      ngayHoatDong: dto.ngayHoatDong?.trim() || null,
      homeVehicleId: dto.homeVehicleId ?? null,
      zaloId: dto.zaloId?.trim() || null,
      zaloBot: dto.zaloBot ?? 0,
      oldCar: dto.oldCar ?? false,
      payBhxh: dto.payBhxh ?? true,
    });
    const saved = await this.usersRepository.save(user);
    // Ghi lịch sử bổ nhiệm để lương cứng tháng hiện tại/tương lai bám đúng xe.
    if (saved.role === 'laixe' && saved.homeVehicleId != null) {
      await this.assignmentsService.recordAssignment({
        driverId: saved.id,
        vehicleId: saved.homeVehicleId,
        effectiveDate: todayVN(),
        actorUserId: Number(actor?.sub ?? actor?.id) || null,
      });
    }
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

    if (dto.username !== undefined && dto.username.trim() && dto.username.trim() !== target.username) {
      const nextUsername = dto.username.trim();
      const dup = await this.usersRepository.findOne({ where: { username: nextUsername } });
      if (dup && dup.id !== target.id) {
        throw new BadRequestException('Tên đăng nhập / MST đã tồn tại');
      }
      target.username = nextUsername;
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
    if (target.role === 'partner') {
      target.permissions = ['container.view', 'tab.progress'];
    } else if (dto.permissions !== undefined) {
      target.permissions = this.validateGrantablePermissions(
        dto.permissions,
        actor,
        target.permissions,
      );
    }
    if (dto.visibleDriverIds !== undefined) {
      // [] (rỗng) = không được xem xe nào; null = xem tất cả (không giới hạn)
      target.visibleDriverIds = dto.visibleDriverIds ?? null;
    }
    if (dto.ben !== undefined) {
      target.ben = dto.ben.trim() || null;
    }
    if (dto.password) {
      target.passwordHash = bcrypt.hashSync(dto.password, 10);
    }
    if (dto.soXe !== undefined) target.soXe = dto.soXe.trim();
    if (dto.soMooc !== undefined) target.soMooc = dto.soMooc.trim();
    if (dto.stt !== undefined) target.stt = dto.stt.trim();
    if (dto.sdt !== undefined) target.sdt = dto.sdt.trim();
    if (dto.ngayHoatDong !== undefined)
      target.ngayHoatDong = dto.ngayHoatDong?.trim() || null;
    const previousHomeVehicleId = target.homeVehicleId ?? null;
    if (dto.homeVehicleId !== undefined) {
      const newVid = dto.homeVehicleId ?? null;
      if (newVid !== target.homeVehicleId) {
        // Đổi xe nhà → chốt các chuyến cũ về XE CŨ, tránh dồn doanh thu lịch sử
        // sang xe mới (nhất là xe mới có ngày hoạt động ở tương lai).
        const oldVid = target.homeVehicleId ?? target.id;
        if (oldVid) {
          await this.usersRepository.manager.query(
            'UPDATE submissions SET actual_vehicle_id = $1 WHERE user_id = $2 AND actual_vehicle_id IS NULL',
            [oldVid, target.id],
          );
        }
      }
      target.homeVehicleId = newVid;
    }
    if (dto.zaloId !== undefined) target.zaloId = dto.zaloId.trim() || null;
    if (dto.zaloBot !== undefined) target.zaloBot = dto.zaloBot;
    if (dto.allowanceFarHome !== undefined)
      target.allowanceFarHome = dto.allowanceFarHome;
    if (dto.allowanceWaitLoading !== undefined)
      target.allowanceWaitLoading = dto.allowanceWaitLoading;
    if (dto.oldCar !== undefined) target.oldCar = dto.oldCar;
    if (dto.payBhxh !== undefined) target.payBhxh = dto.payBhxh;

    const saved = await this.usersRepository.save(target);

    if (saved.role === 'partner' && saved.customerId) {
      await this.usersRepository.manager.query(
        'UPDATE customers SET name = $1, mst = $2 WHERE id = $3',
        [saved.fullName, saved.username, saved.customerId],
      );
    }

    // Đổi xe nhà qua tab Users → ghi lịch sử bổ nhiệm (hiệu lực hôm nay).
    if (
      saved.role === 'laixe' &&
      dto.homeVehicleId !== undefined &&
      (saved.homeVehicleId ?? null) !== previousHomeVehicleId
    ) {
      await this.assignmentsService.recordAssignment({
        driverId: saved.id,
        vehicleId: saved.homeVehicleId ?? null,
        effectiveDate: todayVN(),
        actorUserId: Number(actor?.sub ?? actor?.id) || null,
      });
    }

    // Nếu đã thay đổi visibleDriverIds / role / permissions → huỷ refresh token
    // để JWT mới được tạo tự động với thông tin cập nhật
    const sensitiveChanged =
      dto.visibleDriverIds !== undefined ||
      dto.role !== undefined ||
      dto.permissions !== undefined;
    if (sensitiveChanged) {
      await this.redisService.removeRefreshToken(id);
    }

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
   *   container_claims, edit_history) rồi xóa tài khoản.
   * mode='block': đổi role sang 'disabled' để chặn đăng nhập, giữ nguyên lịch sử.
   * Không có mode: xóa bình thường; nếu có dữ liệu sẽ từ chối để tránh mất dữ liệu.
   */
  async remove(
    id: number,
    currentRole: string,
    currentUserId: number,
    mode?: string,
    currentUserName?: string,
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

      // Ảnh chụp các container sắp bị xoá (đọc TRƯỚC khi xoá) để ghi audit.
      // Bọc try/catch: bảng audit có thể chưa được migrate → không chặn xoá.
      let doomedContainers: any[] = [];
      try {
        doomedContainers = await conn.query(
          `SELECT c.id, c.container_code, c.type, c.shipping_line_id,
                  c.submission_id, c.bundle_id, c.created_at,
                  (SELECT COUNT(*) FROM container_claims cl
                    WHERE cl.container_import_id = c.id) AS claim_count
             FROM container_imports c
            WHERE c.submission_id IN (
                    SELECT id FROM submissions WHERE user_id = $1)`,
          [id],
        );
      } catch {
        doomedContainers = [];
      }

      await conn.transaction(async (manager) => {
        // container_claims KHÔNG có khoá ngoại tới container_imports:
        // phải xoá claim trước, nếu không sẽ để lại claim mồ côi khiến bảng kê
        // Excel "Container - Người chạy" mất dấu Vệ sinh lại / Kéo Về / Kéo lần 2
        // mà không có cách nào truy lại.
        await manager.query(
          `DELETE FROM container_claims
            WHERE submission_id IN (SELECT id FROM submissions WHERE user_id = $1)
               OR container_import_id IN (
                    SELECT id FROM container_imports
                     WHERE submission_id IN (
                             SELECT id FROM submissions WHERE user_id = $1))`,
          [id],
        );
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

      // Audit xoá container (best-effort, chạy SAU khi transaction đã commit).
      for (const c of doomedContainers) {
        try {
          await conn.query(
            `INSERT INTO container_audit_logs
               (container_import_id, container_code, container_type,
                shipping_line_id, shipping_line_name, submission_id, bundle_id,
                claim_count, claim_types, action, performed_by_id,
                performed_by_name, changes)
             VALUES ($1,$2,$3,$4,'',$5,$6,$7,'','DELETE_USER_FORCE',$8,$9,$10)`,
            [
              c.id,
              c.container_code,
              c.type,
              c.shipping_line_id,
              c.submission_id,
              c.bundle_id,
              Number(c.claim_count) || 0,
              currentUserId,
              currentUserName || '',
              JSON.stringify({
                reason: `Xoá toàn bộ dữ liệu của tài khoản #${id} (${target.fullName})`,
                snapshot: c,
              }),
            ],
          );
        } catch {
          // Bảng audit chưa migrate → bỏ qua, không làm hỏng việc xoá.
          break;
        }
      }

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
