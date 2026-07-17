import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(currentRole: string) {
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
    } else {
      users = await this.usersRepository.find({
        where: [{ role: 'laixe' }, { role: 'ops' }],
        order: { createdAt: 'DESC' },
      });
    }
    return users.map(({ passwordHash, ...rest }) => rest);
  }

  async create(dto: CreateUserDto, currentRole: string) {
    const existing = await this.usersRepository.findOne({ where: { username: dto.username.trim() } });
    if (existing) {
      throw new BadRequestException('Tên đăng nhập đã tồn tại');
    }

    let validRole = dto.role || 'laixe';
    if ((currentRole === 'ops' || currentRole === 'hr') && validRole !== 'laixe') {
      throw new ForbiddenException('Bạn chỉ có thể tạo tài khoản lái xe');
    }
    if (currentRole === 'admin' && validRole === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền tạo tài khoản này');
    }

    const hash = bcrypt.hashSync(dto.password, 10);
    const user = this.usersRepository.create({
      username: dto.username.trim(),
      passwordHash: hash,
      fullName: dto.fullName.trim(),
      role: validRole,
      soXe: dto.soXe?.trim() || '',
      stt: dto.stt?.trim() || '',
      sdt: dto.sdt?.trim() || '',
    });
    const saved = await this.usersRepository.save(user);
    const { passwordHash, ...result } = saved;
    return result;
  }

  async update(id: number, dto: UpdateUserDto, currentRole: string, currentUserId: number) {
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
      if ((currentRole === 'ops' || currentRole === 'hr') && dto.role !== 'laixe') {
        throw new ForbiddenException('Bạn chỉ có thể sửa tài khoản lái xe');
      }
      if (currentRole === 'admin' && dto.role === 'supper_admin') {
        throw new ForbiddenException('Bạn không có quyền sửa tài khoản này');
      }
      target.role = dto.role;
    }
    if (dto.password) {
      target.passwordHash = bcrypt.hashSync(dto.password, 10);
    }
    if (dto.soXe !== undefined) target.soXe = dto.soXe.trim();
    if (dto.stt !== undefined) target.stt = dto.stt.trim();
    if (dto.sdt !== undefined) target.sdt = dto.sdt.trim();

    const saved = await this.usersRepository.save(target);
    const { passwordHash, ...result } = saved;
    return result;
  }

  async remove(id: number, currentRole: string, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Không thể xóa tài khoản đang đăng nhập');
    }

    const target = await this.usersRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if ((currentRole === 'ops' || currentRole === 'hr') && target.role !== 'laixe') {
      throw new ForbiddenException('Bạn chỉ có thể xóa tài khoản lái xe');
    }
    if (currentRole === 'admin' && target.role === 'supper_admin') {
      throw new ForbiddenException('Bạn không có quyền xóa tài khoản này');
    }

    await this.usersRepository.remove(target);
    return { message: 'Đã xóa người dùng' };
  }

  async findById(id: number) {
    return this.usersRepository.findOne({ where: { id } });
  }
}
