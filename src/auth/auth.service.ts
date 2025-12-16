import { Injectable, ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionDevice } from './entities/session-device.entity';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(SessionDevice)
    private sessionDeviceRepo: Repository<SessionDevice>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      if (!user.isActive) return null;
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, portal?: 'admin' | 'user', userAgent: string = 'unknown', deviceName: string = 'unknown') {
    try {
      if (portal === 'user' && user.role === 'admin') {
        throw new ForbiddenException('Admin accounts must use the Admin Portal.');
      }
      if (portal === 'admin' && user.role !== 'admin') {
        throw new ForbiddenException('Only Administrators can access this portal.');
      }

      const jti = uuidv4();
      const jti_rf = uuidv4();
      const accessTokenExp = 86400; // 24h
      const refreshTokenExp = 86400 * 30; // 30 days

      // Store in Redis
      const now = Math.floor(Date.now() / 1000);

      // Redis: Access Token
      await this.redis.set(`token.${jti}`, JSON.stringify({
        exp: now + accessTokenExp,
        type: 1, // Access
        parent: jti_rf,
        userId: user.id
      }), 'EX', accessTokenExp);

      // Redis: Refresh Token
      await this.redis.set(`token.${jti_rf}`, JSON.stringify({
        exp: now + refreshTokenExp,
        type: 2, // Refresh
        parent: "",
        userId: user.id
      }), 'EX', refreshTokenExp);

      // DB: Session Device
      const session = this.sessionDeviceRepo.create({
        user: { id: user.id },
        jti: jti,
        jti_rf: jti_rf,
        exp: (Date.now() + refreshTokenExp * 1000).toString(),
        user_agent: userAgent,
        device_name: deviceName,
        // IP and other info could be added
      });
      await this.sessionDeviceRepo.save(session);

      // Sign Tokens
      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        fullName: user.fullName,
        jti: jti,
        type: 'access'
      };

      // For refresh token, we might want minimal payload?
      const refreshPayload = {
        sub: user.id,
        jti: jti_rf,
        type: 'refresh'
      };

      console.log('Signing tokens...');
      const access_token = this.jwtService.sign(payload, { expiresIn: accessTokenExp });
      const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshTokenExp });
      console.log('Tokens signed successfully');

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Login error details:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      // Decode to get JTI and verify signature
      const decoded = this.jwtService.verify(refreshToken) as any;
      const jti_rf = decoded.jti; // This is the Refresh Token JTI

      if (!jti_rf || decoded.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

      // Check Redis for Refresh Token
      const redisData = await this.redis.get(`token.${jti_rf}`);
      let userId = decoded.sub;

      if (!redisData) {
        // Fallback to DB: Check if Session exists and is valid
        const session = await this.sessionDeviceRepo.findOne({ where: { jti_rf: jti_rf }, relations: ['user'] });
        if (!session || session.revoked) throw new UnauthorizedException('Session expired or revoked');

        // Check Session Expiry (DB)
        if (Number(session.exp) < Date.now()) {
          throw new UnauthorizedException('Session expired');
        }
        userId = session.user.id;
      } else {
        const data = JSON.parse(redisData);
        userId = data.userId;
      }

      // Generate NEW Access Token (No Rotation of Refresh Token)
      const newAccessJti = uuidv4();
      const accessTokenExp = 86400; // 24h
      const now = Math.floor(Date.now() / 1000);

      // Store new Access Token in Redis
      await this.redis.set(`token.${newAccessJti}`, JSON.stringify({
        exp: now + accessTokenExp,
        type: 1, // Access
        parent: jti_rf, // Parent is the JTI of the Refresh Token
        userId: userId
      }), 'EX', accessTokenExp);

      // Optional: Update DB session last active or similar if needed? 
      // The requirement doesn't explicitly say to update DB session for Access Token generation, 
      // but usually we might want to track the latest Access JTI if we wanted.
      // However, "refresh_token.md" says: "access_token mới được lưu vào Redis với quan hệ cha-con".
      // It doesn't mention updating DB JTI. 
      // Previous code: await this.sessionDeviceRepo.update({ jti_rf: jti_rf }, { jti: newJti });
      // We can keep this to track the *current* active access token for the session if we want.
      await this.sessionDeviceRepo.update({ jti_rf: jti_rf }, { jti: newAccessJti });

      // Fetch User Info
      const user = await this.usersService.findOne(userId);
      if (!user) throw new UnauthorizedException('User not found');

      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        fullName: user.fullName,
        jti: newAccessJti,
        type: 'access'
      };

      const access_token = this.jwtService.sign(payload, { expiresIn: accessTokenExp });

      // Return new Access Token and OLD Refresh Token
      return {
        access_token: access_token,
        refresh_token: refreshToken
      };

    } catch (e) {
      console.error(e); // Debugging
      throw new UnauthorizedException('Invalid refresh token or session expired');
    }
  }

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });
  }

  // Helper to validate access token presence in Redis
  async isTokenValid(jti: string): Promise<boolean> {
    // 1. Check if Access Token exists
    const redisData = await this.redis.get(`token.${jti}`);
    if (!redisData) return false;

    // 2. Parse data to check parent
    try {
      const data = JSON.parse(redisData);
      if (data.type === 1 || data.type === 'access') {
        // It's an Access Token, check if Parent (Refresh Token) exists
        if (data.parent) {
          const parentExists = await this.redis.exists(`token.${data.parent}`);
          if (!parentExists) return false;
        }
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;

    try {
      // 1. Verify & Parse Refresh Token
      const decoded = this.jwtService.verify(refreshToken) as any;
      const jti_rf = decoded.jti;
      const userId = decoded.sub;

      if (decoded.type !== 'refresh') {
        // If it's not a refresh token, we technically can't revoke the "session" fully 
        // unless we track back to the refresh token. 
        // But for now assume we get the refresh token.
        return;
      }

      // 2. Revoke on Redis (Delete Key)
      await this.redis.del(`token.${jti_rf}`);

      // 3. Revoke on Postgres (Update Session)
      // Find session by jti_rf
      const session = await this.sessionDeviceRepo.findOne({ where: { jti_rf: jti_rf } });
      if (session) {
        session.revoked = true;
        await this.sessionDeviceRepo.save(session);
      }

      // 4. Publish Event (RabbitMQ Stub)
      // Ideally: this.client.emit('queue.sub_device', { userId, jti: jti_rf });
      console.log(`[Logout] Published event to queue.sub_device for User ${userId}, JTI ${jti_rf}`);

      return { success: true, userId };
    } catch (e) {
      console.error("Logout failed", e);
      // Don't throw, just ensure cookies are cleared in controller
    }
  }
}
