import { Injectable, ForbiddenException, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RegisterInitDto } from './dto/register-init.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionDevice } from './entities/session-device.entity';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { MailerService } from '@nestjs-modules/mailer';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { FinalizeRegisterDto, ResetPasswordDto } from './dto/finalize.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(SessionDevice)
    private sessionDeviceRepo: Repository<SessionDevice>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly mailerService: MailerService,
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
      const accessToken = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES || '86400');
      const refreshToken = parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES || '86400');
      console.log("accessToken: ", accessToken);

      const accessTokenExp = accessToken; // 24h
      const refreshTokenExp = refreshToken * 30; // 30 days

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
        phone: user.phone,
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
          role: user.role,
          phone: user.phone
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
        phone: user.phone,
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

  async register(registerDto: RegisterInitDto) {
    // 1. Check if user exists
    const existingUser = await this.usersService.findByEmailOrPhone(registerDto.email, registerDto.phone);
    if (existingUser) {
      // If already verified, return status
      return {
        verified: existingUser.isVerified,
        message: existingUser.isVerified ? 'User already exists' : 'User exists but not verified'
      };
    }

    // 2. Hash password provided by user
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 3. Create User
    const newUser = await this.usersService.create({
      email: registerDto.email,
      phone: registerDto.phone,
      password: hashedPassword,
      fullName: registerDto.email.split('@')[0], // Default name
      // role: UserRole.BUYER // Default is BUYER in entity
    } as CreateUserDto);

    // Explicitly set verified false (though default is false in some DBs, entity defaults to false)
    // Note: User entity has isVerified default false.

    return {
      verified: false,
      message: 'User created successfully',
      userId: newUser.id
    };
  }

  async createOtp(dto: SendOtpDto, ip: string) {
    // 1. Rate Limit
    const phoneLimit = parseInt(process.env.CLIENT_PHONE_REQUEST_OTP_LIMIT || '3', 10);
    console.log(`[OTP Limit] Phone: ${dto.phone}, Limit: ${phoneLimit}`);
    const phoneLimitKey = `otp_limit_phone_${dto.phone}`;
    const ipLimitKey = `otp_limit_ip_${ip}`;

    const phoneCount = await this.redis.incr(phoneLimitKey);
    console.log(`[OTP Limit] Count for ${dto.phone}: ${phoneCount}`);
    // Set expiry to 10 minutes (600s) on first request OR if key exists without TTL (fix for persist edge case)
    const ttl = await this.redis.ttl(phoneLimitKey);
    if (phoneCount === 1 || ttl === -1) {
      await this.redis.expire(phoneLimitKey, 600);
    }

    if (phoneCount > phoneLimit) {
      throw new ForbiddenException(`Bạn đã gửi OTP quá ${phoneLimit} lần. Vui lòng thử lại sau 10 phút.`);
    }

    const ipCount = await this.redis.incr(ipLimitKey);
    if (ipCount === 1) await this.redis.expire(ipLimitKey, 86400); // 1 day
    if (ipCount > 100) throw new ForbiddenException('Daily OTP limit reached for this IP');

    // Cooldown
    const cooldownKey = `otp_cooldown_${dto.phone}`;
    const cooldownTtl = await this.redis.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      throw new ForbiddenException(`Vui lòng đợi ${cooldownTtl} giây trước khi yêu cầu mã mới.`);
    }

    // 2. Lookup User
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new ForbiddenException('User not found');

    // 3. Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Save to Redis & DB
    const otpExpTime = parseInt(process.env.OTP_EXPIRATION_TIME || '180', 10);
    const otpExp = new Date(Date.now() + otpExpTime * 1000);

    // Redis Storage (Primary)
    const otpKey = `otp_auth_${user.id}`;
    await this.redis.set(otpKey, code, 'EX', otpExpTime);

    // DB Storage (Secondary/Audit)
    await this.usersService.update(user.id, {
      otpCode: code,
      otpExp: otpExp,
      otpRetry: 0
    } as any);

    // 5. Send Mail
    try {
      if (user.email) {
        await this.mailerService.sendMail({
          to: user.email,
          subject: 'Tài liệu điện tử - Xác thực tài khoản',
          text: `Mã xác thực của bạn là: ${code}\n\nDành cho tài khoản: ${user.email}\nTrên hệ thống Tài liệu điện tử.\n\nMã xác thực có hiệu lực ${process.env.OTP_EXPIRATION_TIME} giây từ thời điểm gửi.`,
        });
      }
    } catch (e) {
      console.error('Mail error', e);
      // Continue even if mail fails? Or throw? plan says logic is to send mail.
      // If mail fails, user can't verify. Should throw.
      throw new Error('Failed to send OTP email');
    }

    // 6. Set Cooldown
    const cooldownTime = parseInt(process.env.OTP_COOLDOWN_TIME || '60', 10);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTime);

    return { success: true, message: 'OTP sent to email ' + user.email, expiresIn: otpExpTime };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // 1. Check Block
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new ForbiddenException('User not found');

    const blockKey = `otp_block_${user.id}`;
    if (await this.redis.get(blockKey)) {
      throw new ForbiddenException('Too many failed attempts. Please try again later (10m).');
    }

    // 2. Validate
    const otpKey = `otp_auth_${user.id}`;
    const redisOtp = await this.redis.get(otpKey);

    // Priority: Redis > DB
    const validOtp = redisOtp || user.otpCode;
    // If redis exists, it is valid based on TTL. If fallback to DB, check exp.

    if (!validOtp) throw new ForbiddenException('No OTP request found');

    // If only verifying against DB and it's expired
    if (!redisOtp && user.otpExp && new Date() > user.otpExp) throw new ForbiddenException('OTP đã hết hạn');

    if (String(validOtp) !== String(dto.code)) {
      const retry = (user.otpRetry || 0) + 1;
      await this.usersService.update(user.id, { otpRetry: retry } as any);

      if (retry >= 3) {
        await this.redis.set(blockKey, '1', 'EX', 600); // 10 min
        throw new ForbiddenException('Too many failed attempts. Blocked for 10 minutes.');
      }
      throw new UnauthorizedException('Invalid OTP');
    }

    // 3. Success
    await this.redis.del(otpKey); // Clear Redis OTP
    await this.usersService.update(user.id, {
      otpCode: null,
      otpExp: null,
      otpRetry: 0
    } as any);

    // 4. Generate Sign Key
    const signKey = uuidv4();
    const signKeyKey = `sign_key_${signKey}`;
    await this.redis.set(signKeyKey, user.id, 'EX', 600); // 10 min

    return {
      success: true,
      sign_key: signKey,
      user_id: user.id
    };
  }

  async finalizeRegister(dto: FinalizeRegisterDto) {
    const signKeyKey = `sign_key_${dto.sign_key}`;
    const userId = await this.redis.get(signKeyKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired sign key');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) throw new BadRequestException('User not found');

    // Update Verified
    await this.usersService.update(userId, { isVerified: true } as any);

    // Clean up
    await this.redis.del(signKeyKey);

    return { success: true, message: 'Account verified successfully' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const signKeyKey = `sign_key_${dto.sign_key}`;
    const userId = await this.redis.get(signKeyKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired sign key');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) throw new BadRequestException('User not found');

    // Hash New Password
    const hashedPassword = await bcrypt.hash(dto.new_password, 10);

    // Update User
    await this.usersService.update(userId, {
      password: hashedPassword,
      isVerified: true // Also verify if not already
    } as any);

    // Revoke all sessions (Logout all devices)
    const sessions = await this.sessionDeviceRepo.find({
      where: { user: { id: userId }, revoked: false }
    });

    for (const session of sessions) {
      // Remove Refresh Token from Redis
      if (session.jti_rf) {
        await this.redis.del(`token.${session.jti_rf}`);
      }
      // Remove Access Token from Redis (if tracked in DB)
      if (session.jti) {
        await this.redis.del(`token.${session.jti}`);
      }
    }

    // Mark all in DB as revoked
    await this.sessionDeviceRepo.update({ user: { id: userId } }, { revoked: true });

    // Clean up
    await this.redis.del(signKeyKey);

    return { success: true, message: 'Password reset successfully' };
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
