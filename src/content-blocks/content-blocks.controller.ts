
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ContentBlocksService } from './content-blocks.service';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('content-blocks')
export class ContentBlocksController {
  constructor(private readonly contentBlocksService: ContentBlocksService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createContentBlockDto: CreateContentBlockDto) {
    return this.contentBlocksService.create(createContentBlockDto);
  }

  @Get()
  findAll() {
    return this.contentBlocksService.findAll();
  }

  @Get('active')
  findAllActive() {
    return this.contentBlocksService.findAllActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentBlocksService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateContentBlockDto: UpdateContentBlockDto) {
    return this.contentBlocksService.update(id, updateContentBlockDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.contentBlocksService.remove(id);
  }
}
