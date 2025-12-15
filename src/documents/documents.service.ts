import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Document, DocumentStatus } from './entities/document.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { StorageService as StorageServiceImpl } from '../storage/storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private storageService: StorageServiceImpl,
    @InjectQueue('documents') private documentsQueue: Queue,
  ) { }

  async download(id: string, userId: string): Promise<string> {
    const document = await this.findOne(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // 1. Check if user is the author
    if (document.author && document.author.id === userId) {
      const fileKey = document.fileUrl.split('/').pop();
      if (!fileKey) throw new InternalServerErrorException('Invalid file URL');
      return this.storageService.getPresignedUrl(fileKey);
    }

    // 2. Check if user has purchased the document
    const order = await this.orderRepository.findOne({
      where: {
        user: { id: userId },
        status: OrderStatus.COMPLETED,
        items: {
          document: { id },
        },
      },
    });

    if (!order) {
      throw new ForbiddenException('You need to purchase this document to download it');
    }

    const fileKey = document.fileUrl.split('/').pop();
    if (!fileKey) throw new InternalServerErrorException('Invalid file URL');
    return this.storageService.getPresignedUrl(fileKey);
  }

  async upload(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const fileName = await this.storageService.uploadFile(file);
    const fileUrl = this.storageService.getPublicUrl(fileName);
    return { url: fileUrl, path: fileName };
  }

  async create(createDocumentDto: CreateDocumentDto, userId: string) {
    const { price, categoryId, ...documentData } = createDocumentDto;

    const document = this.documentRepository.create({
      ...documentData,
      price: price ? { amount: price } : undefined,
      category: categoryId ? { id: categoryId } : undefined,
      author: { id: userId },
      status: DocumentStatus.PENDING,
    });

    const savedDoc = await this.documentRepository.save(document);

    const fileKey = savedDoc.fileUrl.split('/').pop();

    if (fileKey) {
      await this.documentsQueue.add('process-pdf', {
        documentId: savedDoc.id,
        fileKey: fileKey
      });
    }

    return savedDoc;
  }

  findAll() {
    return this.documentRepository.find({
      where: {
        isDeleted: false,
        isActive: true,
        status: DocumentStatus.APPROVED
      },
      relations: ['category', 'author', 'price']
    });
  }

  findOne(id: string) {
    return this.documentRepository.findOne({
      where: { id, isDeleted: false }, // Allow viewing inactive? Maybe "Product unavailable" logic in frontend. But deleted definitely gone.
      relations: ['category', 'author', 'price']
    });
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    const { price, categoryId, ...data } = updateDocumentDto;
    const updateData: any = { ...data };

    if (price !== undefined) {
      // Ideally we should update the Price entity, but for update() with relations it's tricky.
      // Better to find one and save, or assume price entity exists.
      // For simplicity in this demo, let's skip deep update via repo.update or handle it partially.
      // We'll use save() strategy for full updates or just ignore price update in simplified version
      // pending proper implementation.
    }
    if (categoryId) {
      updateData.category = { id: categoryId };
    }

    return this.documentRepository.update(id, updateData);
  }

  async updateStatus(id: string, status: DocumentStatus) {
    return this.documentRepository.update(id, { status });
  }

  remove(id: string) {
    return this.documentRepository.delete(id);
  }
}
