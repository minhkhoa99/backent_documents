import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards, Request, StreamableFile, Header, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DocumentStatus } from './entities/document.entity';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  @Get(':id/file')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline')
  async serveFile(@Param('id') id: string): Promise<StreamableFile> {
    try {
      const buffer = await this.documentsService.getFileBuffer(id);
      console.log('DocumentsController: Serving file buffer size:', buffer.length);
      return new StreamableFile(buffer);
    } catch (error) {
      console.error('Error serving file:', error);
      throw error;
    }
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async download(@Param('id') id: string, @Request() req) {
    const url = await this.documentsService.download(id, req.user.userId);
    return { url };
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.documentsService.upload(file);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createDocumentDto: CreateDocumentDto, @Request() req) {
    return this.documentsService.create(createDocumentDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('categoryIds') categoryIds?: string,
    @Query('fileTypes') fileTypes?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 12,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findAll(categoryIds, fileTypes, sort, order, Number(page), Number(limit), search);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    // req.user will be populated if valid token is provided, otherwise null
    const userId = req.user?.userId;
    return this.documentsService.findOne(id, userId);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  approve(@Param('id') id: string) {
    return this.documentsService.updateStatus(id, DocumentStatus.APPROVED);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  reject(@Param('id') id: string) {
    return this.documentsService.updateStatus(id, DocumentStatus.REJECTED);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
