import { Controller, Get, Post, Body, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
