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
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private storageService: StorageServiceImpl,
    private redisService: RedisService,
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

    // No need to invalidate list cache since pending docs don't show up in public list usually,
    // but if we have admin list, we should. Safe to invalidate.
    await this.invalidateDocumentCache(savedDoc.id);

    return savedDoc;
  }

  async findAll(categoryIds?: string, fileTypes?: string, sort?: string, order: 'ASC' | 'DESC' = 'DESC', page: number = 1, limit: number = 12, search?: string) {
    const cacheKey = `documents:list:${categoryIds || 'all'}:${fileTypes || 'all'}:${sort || 'default'}:${order}:${page}:${limit}:${search || 'none'}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const qb = this.documentRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.category', 'category')
      .leftJoinAndSelect('document.author', 'author')
      .leftJoinAndSelect('document.price', 'price')
      .where('document.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('document.isActive = :isActive', { isActive: true })
      .andWhere('document.status = :status', { status: DocumentStatus.APPROVED })
      // Optimization: Select only necessary fields
      .select([
        'document.id', 'document.title', 'document.fileUrl', 'document.previewUrl', 'document.avatar',
        'document.totalPage', 'document.createdAt', 'document.views', 'document.discountPercentage',
        'category.id', 'category.name', 'category.slug',
        'price.amount',
        'author.id', 'author.fullName', 'author.avatar' // Exclude email/phone
      ]);

    if (categoryIds) {
      const ids = categoryIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        qb.andWhere('category.id IN (:...catIds)', { catIds: ids });
      }
    }

    // Optimization: avoid LIKE on fileUrl if possible, but keep for now
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
      // Use Full-Text Search Index
      // Pre-process search term: split words and join with & for AND search, or | for OR.
      // 'simple' dictionary prevents stemming issues with Vietnamese
      const sanitizedSearch = search.trim().replace(/[&|!():<>\\]/g, '').split(/\s+/).join(' & ');
      if (sanitizedSearch) {
        qb.andWhere(`to_tsvector('simple', document.title) @@ to_tsquery('simple', :search)`, { search: `${sanitizedSearch}:*` }); // :* for prefix matching
      }
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

    const [data, total] = await qb.getManyAndCount();

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    await this.redisService.set(cacheKey, result, 300); // 5 minutes cache for lists
    return result;
  }

  async findOne(id: string, userId?: string) {
    const cacheKey = `documents:detail:${id}`;

    // Check cache first if no userId (public view) or if we cache generic part separately. 
    // Since isPurchased depends on userId, we can only safely cache the document data itself.
    // Let's cache the robust document data.

    let document: any = await this.redisService.get(cacheKey);

    if (!document) {
      document = await this.documentRepository.findOne({
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
      if (document) {
        await this.redisService.set(cacheKey, document, 3600);
      }
    }

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
      if (document.price) {
        document.price.amount = price;
      }
    }

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

    const saved = await this.documentRepository.save(document);
    await this.invalidateDocumentCache(id);
    return saved;
  }

  async updateStatus(id: string, status: DocumentStatus) {
    const result = await this.documentRepository.update(id, { status });
    await this.invalidateDocumentCache(id);
    return result;
  }

  async remove(id: string) {
    // Soft delete usually? The entity has isDeleted.
    // Original code was delete(). If it really deletes row, cache invalidation is same.
    const result = await this.documentRepository.delete(id);
    await this.invalidateDocumentCache(id);
    return result;
  }

  private async invalidateDocumentCache(id: string) {
    await this.redisService.del(`documents:detail:${id}`);

    // Invalidate all list caches. Since Redis doesn't support wildcard delete easily without SCAN,
    // and we are using a simple wrapper, we can't easily delete all 'documents:list:*'.
    // However, for high correctness, we should.
    // For now, we can rely on short TTL (5 mins) for lists, OR we can implement SCAN in RedisService.
    // Let's assume user accepts short TTL trade-off or we add a simpler method.
    // To be better, let's try to clear at least the most common ones or leave it to TTL.
    // Given the request for "Optimize", sticking to TTL for lists is common pattern.
    // But if we want to be "Expert", we should probably handle it.
    // I will stick to TTL for lists to avoid performance hit of SCAN on every update.
  }
}
