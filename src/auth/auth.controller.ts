import { Controller, Get, Post, Body, UseGuards, Request, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RegisterInitDto } from './dto/register-init.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { FinalizeRegisterDto, ResetPasswordDto } from './dto/finalize.dto';
import { LoginDto } from './dto/login.dto';
import { Query } from '@nestjs/common';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) { }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response, @Body() loginDto: LoginDto) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const data = await this.authService.login(req.user, loginDto.portal, userAgent);

    // Return tokens in body
    return {
      success: true,
      user: data.user,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  }

  @Post('refresh')
  async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Extract token from Body or Header (Cookie fallback removed/secondary)
    let token = req.body && req.body.refresh_token;
    if (!token && req.headers['authorization']) {
      token = req.headers['authorization']?.split(' ')[1];
    }

    if (!token) {
      throw new Error('No refresh token provided');
    }

    const data = await this.authService.refreshToken(token);

    return {
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  }

  @Post('logout')
  async logout(@Request() req, @Res({ passthrough: true }) res: Response, @Body() body: { refresh_token?: string }) {
    // Try to get refresh token from Body first
    const refreshToken = body?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    return { success: true };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterInitDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify_otp')
  async sendOtp(@Request() req, @Body() dto: SendOtpDto) {
    // Get IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.authService.createOtp(dto, ip);
  }

  @Get('verify_otp')
  async verifyOtp(@Query() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('finalize_register')
  async finalizeRegister(@Body() dto: FinalizeRegisterDto) {
    return this.authService.finalizeRegister(dto);
  }

  @Post('reset_password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    // req.user contains info from JWT payload
    // Fetch fresh data from DB to ensure up-to-date info (e.g. name change, phone change)
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return safe public info
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone
    };
  }
}
