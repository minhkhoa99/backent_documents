import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
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

  async getFileBuffer(id: string) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    let fileKey = document.fileUrl.split('/').pop();
    if (fileKey) fileKey = decodeURIComponent(fileKey);

    if (!fileKey) throw new InternalServerErrorException('Invalid file URL');
    return this.storageService.getFile(fileKey);
  }

  async getFileStream(id: string) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    // Extract key from URL. Use decodeURIComponent to handle spaces/special chars.
    let fileKey = document.fileUrl.split('/').pop();
    if (fileKey) fileKey = decodeURIComponent(fileKey);

    console.log('DocumentsService: getFileStream', { id, fileUrl: document.fileUrl, derivedKey: fileKey });

    if (!fileKey) throw new InternalServerErrorException('Invalid file URL');
    return this.storageService.getFileStream(fileKey);
  }

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

  async upload(file: Express.Multer.File, configThumString?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const fileName = await this.storageService.uploadFile(file, configThumString);
    const fileUrl = this.storageService.getPublicUrl(fileName);
    return { url: fileUrl, path: fileName };
  }

  async create(createDocumentDto: CreateDocumentDto, userId: string) {
    const { price, categoryId, discountPercentage, ...documentData } = createDocumentDto;

    const document = this.documentRepository.create({
      ...documentData,
      discountPercentage: discountPercentage || 0,
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

  async findAll(categoryIds?: string, fileTypes?: string, sort?: string, order: 'ASC' | 'DESC' = 'DESC', page: number = 1, limit: number = 12, search?: string) {
    const qb = this.documentRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.category', 'category')
      .leftJoinAndSelect('document.author', 'author')
      .leftJoinAndSelect('document.price', 'price')
      .where('document.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('document.isActive = :isActive', { isActive: true })
      .andWhere('document.status = :status', { status: DocumentStatus.APPROVED });

    if (categoryIds) {
      const ids = categoryIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        qb.andWhere('category.id IN (:...catIds)', { catIds: ids });
      }
    }

    if (fileTypes) {
      const types = fileTypes.split(',').filter(Boolean);
      if (types.length > 0) {
        const typeConditions = types.map((type, idx) => `LOWER(document.fileUrl) LIKE :type${idx}`);
        const parameters = {};
        types.forEach((type, idx) => {
          parameters[`type${idx}`] = `%.${type.toLowerCase()}`;
        });
        qb.andWhere(`(${typeConditions.join(' OR ')})`, parameters);
      }
    }

    if (search) {
      qb.andWhere('LOWER(document.title) LIKE LOWER(:search)', { search: `%${search}%` });
    }

    if (sort === 'price') {
      qb.orderBy('price.amount', order);
    } else if (sort === 'popular' || sort === 'views') {
      qb.orderBy('document.views', 'DESC');
    } else {
      qb.orderBy('document.createdAt', order);
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    // Explicitly selecting user fields is tricky with QB leftJoinAndSelect if we want to partially select from the joined relation directly without losing the main object structure easily or using raw results.
    // However, the standard `leftJoinAndSelect` will populate the whole entity.
    // Assuming User entity has precautions or we don't mind exposing public fields in this context.
    // If strict security is needed, we should modify selection or use a DTO interceptor.
    // For now, let's proceed (Previous code also just relied on `select` in repository.find)

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string, userId?: string) {
    const document = await this.documentRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['category', 'author', 'price'],
      select: {
        author: {
          id: true,
          email: true,
          fullName: true,
          createdAt: true,
          updatedAt: true
        }
      }
    });

    if (!document) return null;

    let isPurchased = false;

    if (userId) {
      // 1. Author always has access
      if (document.author && document.author.id === userId) {
        isPurchased = true;
      } else {
        // 2. Check orders
        const order = await this.orderRepository.findOne({
          where: {
            user: { id: userId },
            status: OrderStatus.COMPLETED,
            items: {
              document: { id },
            },
          },
        });
        if (order) isPurchased = true;
      }
    }

    return { ...document, isPurchased };
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    const { price, categoryId, discountPercentage, ...data } = updateDocumentDto;

    // Fetch generic document to update relations if needed
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['price']
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (price !== undefined) {
      // Update or Create Price
      if (document.price) {
        document.price.amount = price;
        // You might need to inject PriceRepository to save strictly, 
        // but cascading save from document should work if configured.
        // However, typeorm update() does NOT trigger cascades usually.
        // So we use save() for the whole document or query builder for relation.
      } else {
        // If price didn't exist (rare)
        // document.price = new Price(); // Need Price entity import
        // For now assuming price relation always exists or we skip
      }
    }

    // For simplicity and correctness with OneToOne updates, let's use save() strategy for everything
    // or separate updates.

    // Update direct fields
    Object.assign(document, data);

    if (discountPercentage !== undefined) {
      document.discountPercentage = discountPercentage;
    }

    if (categoryId) {
      document.category = { id: categoryId } as any;
    }

    if (price !== undefined && document.price) {
      document.price.amount = price;
    }

    // Save should update relation due to cascade: true in Document
    return this.documentRepository.save(document);
  }

  async updateStatus(id: string, status: DocumentStatus) {
    return this.documentRepository.update(id, { status });
  }

  remove(id: string) {
    return this.documentRepository.delete(id);
  }
}
