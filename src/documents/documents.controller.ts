import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards, Request, StreamableFile, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
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
  async serveFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    try {
      const document = await this.documentsService.findOne(id);
      if (!document) {
        // If service throws NotFound, we might catch it below, but best to check.
        // service.findOne returns null if not found (in some implementations) or throws.
        // service.getFileBuffer throws NotFoundException if not found.
      }

      const buffer = await this.documentsService.getFileBuffer(id);
      console.log('DocumentsController: Serving file buffer size:', buffer.length);

      // Determine content type
      // We need fileUrl to get extension. 
      // getFileBuffer gets document internally but doesn't return it.
      // We should probably optimize this to avoid double fetching, but findOne is cached or fast enough.
      // Actually, let's just fetch document again or use the one from getFileBuffer if we refactor.
      // For now, calling findOne is safest to get filename.
      // But wait, getFileBuffer fetch document by ID. 
      // Let's rely on finding it.

      let contentType = 'application/octet-stream';
      let filename = 'document';

      if (document && document.fileUrl) {
        const parts = document.fileUrl.split('/');
        filename = parts[parts.length - 1];
        const ext = path.extname(filename).toLowerCase();

        const mimeTypes: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.txt': 'text/plain',
        };
        contentType = mimeTypes[ext] || 'application/octet-stream';
      }

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`
      });

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
  uploadFile(@UploadedFile() file: Express.Multer.File, @Query('configThumString') configThumString?: string) {
    return this.documentsService.upload(file, configThumString);
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
