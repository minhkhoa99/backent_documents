
import { Controller, Get, Post, Body, UseGuards, Request, UploadedFile, UseInterceptors, Patch, Delete, Param } from '@nestjs/common';
import { SellerService } from './seller.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class SellerController {
  constructor(private readonly sellerService: SellerService) { }

  @Get('stats')
  getStats(@Request() req) {
    return this.sellerService.getStats(req.user.userId);
  }

  @Get('documents')
  getDocuments(@Request() req) {
    return this.sellerService.getDocuments(req.user.userId);
  }

  @Get('orders')
  getOrders(@Request() req) {
    return this.sellerService.getOrders(req.user.userId);
  }

  @Patch('documents/:id')
  updateDocument(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.sellerService.updateDocument(req.user.userId, id, body);
  }

  @Delete('documents/:id')
  deleteDocument(@Request() req, @Param('id') id: string) {
    return this.sellerService.deleteDocument(req.user.userId, id);
  }
}
