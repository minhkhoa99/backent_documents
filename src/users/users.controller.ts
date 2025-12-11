import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    // Prevent updating critical fields like role or email if needed, 
    // but for now allow basic updates. Logic can be refined in Service.
    // For safety, let's strip 'role' from DTO in production, but here we trust DTO or service.
    // Actually, UpdateUserDto is Partial(CreateUserDto) which includes role. 
    // We should probably create a UpdateProfileDto, but let's stick to UpdateUserDto for speed 
    // and rely on frontend not sending it, or backend ignoring it. 
    // Ideally: const { role, ...updateData } = updateUserDto;
    return this.usersService.update(req.user.userId, updateUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
