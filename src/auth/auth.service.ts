import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      // Check if active
      if (!user.isActive) return null; // Or throw specific exception if we want detail

      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, portal?: 'admin' | 'user') {
    if (portal === 'user' && user.role === 'admin') {
      throw new ForbiddenException('Admin accounts must use the Admin Portal.');
    }
    if (portal === 'admin' && user.role !== 'admin') {
      throw new ForbiddenException('Only Administrators can access this portal.');
    }

    const payload = { email: user.email, sub: user.id, role: user.role, fullName: user.fullName };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    };
  }

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });
  }
}
