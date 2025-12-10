import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) { }

  @Post()
  addToCart(@Request() req, @Body('documentId') documentId: string) {
    return this.cartService.addToCart(req.user.id, documentId);
  }

  @Get()
  getCart(@Request() req) {
    return this.cartService.getCart(req.user.id);
  }

  @Delete(':id')
  removeFromCart(@Request() req, @Param('id') itemId: string) {
    return this.cartService.removeFromCart(req.user.id, itemId);
  }
}
