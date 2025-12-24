import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Menu } from './entities/menu.entity';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class MenusService {
  private readonly CACHE_KEY_TREE = 'menus:tree';
  private readonly CACHE_KEY_ALL = 'menus:all';

  constructor(
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
    private redisService: RedisService,
  ) { }

  async create(createMenuDto: CreateMenuDto) {
    try {
      const { parentId, ...rest } = createMenuDto;

      if (!rest.order) {
        const parentCondition = parentId ? { id: parentId } : IsNull();
        const lastItem = await this.menuRepository.findOne({
          where: { parent: parentCondition },
          order: { order: 'DESC' },
        });
        rest.order = lastItem ? lastItem.order + 1 : 1;
      }

      console.log('Creating menu with data:', { ...rest, parentId });

      const menu = this.menuRepository.create({
        ...rest,
        parent: parentId ? { id: parentId } : undefined,
      });
      const result = await this.menuRepository.save(menu);
      await this.invalidateCache();
      return result;
    } catch (error) {
      console.error('Error creating menu:', error);
      console.error('Input DTO:', createMenuDto);
      throw error;
    }
  }

  async findAll() {
    const cached = await this.redisService.get(this.CACHE_KEY_ALL);
    if (cached) return cached;

    const result = await this.menuRepository.find({ relations: ['parent'] });
    await this.redisService.set(this.CACHE_KEY_ALL, result, 3600);
    return result;
  }

  async getTree() {
    const cached = await this.redisService.get(this.CACHE_KEY_TREE);
    if (cached) return cached;

    const result = await this.menuRepository.find({
      where: { parent: IsNull(), isActive: true },
      relations: ['children'],
      order: {
        order: 'ASC',
      },
    });
    await this.redisService.set(this.CACHE_KEY_TREE, result, 3600);
    return result;
  }

  findOne(id: string) {
    return this.menuRepository.findOne({ where: { id } });
  }

  async update(id: string, updateMenuDto: UpdateMenuDto) {
    const { parentId, ...rest } = updateMenuDto;

    const menu = await this.menuRepository.preload({
      id,
      ...rest,
      parent: parentId !== undefined ? (parentId ? { id: parentId } : null as unknown as Menu) : undefined,
    });

    if (!menu) {
      throw new Error(`Menu #${id} not found`);
    }

    const result = await this.menuRepository.save(menu);
    await this.invalidateCache();
    return result;
  }

  async remove(id: string) {
    const result = await this.menuRepository.delete(id);
    await this.invalidateCache();
    return result;
  }

  async reorder(items: { id: string; order: number }[]) {
    // Validate hierarchy if needed, but for now just update orders
    // This assumes the frontend sends valid (id, order) pairs within their respective siblings
    await this.menuRepository.manager.transaction(async (transactionalEntityManager) => {
      for (const item of items) {
        await transactionalEntityManager.update(Menu, item.id, { order: item.order });
      }
    });
    await this.invalidateCache();
    return { success: true };
  }

  async updateAutoIncrement() {
    // Find roots
    const roots = await this.menuRepository.find({
      where: { parent: IsNull() },
      order: { label: 'ASC' }
    });

    let rootOrder = 1;
    for (const root of roots) {
      root.order = rootOrder++;
      await this.menuRepository.save(root);
      await this.updateChildrenOrder(root);
    }
    await this.invalidateCache();
    return { message: 'Menu Auto-increment updated' };
  }

  private async updateChildrenOrder(parent: Menu) {
    const children = await this.menuRepository.find({
      where: { parent: { id: parent.id } },
      order: { label: 'ASC' }
    });

    let childOrder = 1;
    for (const child of children) {
      child.order = childOrder++;
      await this.menuRepository.save(child);
      // Recurse if deeper levels exist (Menu supports generic depth)
      await this.updateChildrenOrder(child);
    }
  }

  async seed() {
    interface SeedItem {
      label: string;
      link?: string; // Add link property
      icon?: string;
      parentLabel?: string;
      children?: any[];
    }

    const menus: SeedItem[] = [
      { label: 'Thư mục', icon: 'folder', children: [] },
      { label: 'Sách điện tử', icon: 'book', link: '/categories/sach-dien-tu', children: [] },
      {
        label: 'Sách Nghiệp Vụ',
        parentLabel: 'Thư mục',
        link: '/categories/sach-nghiep-vu',
        children: [],
      },
      {
        label: 'Sách Thiếu Nhi',
        parentLabel: 'Thư mục',
        link: '/categories/sach-thieu-nhi',
        children: [],
      },
      {
        label: 'Sách Tham Khảo',
        parentLabel: 'Thư mục',
        link: '/categories/sach-tham-khao',
        children: [],
      },
      {
        label: 'Lớp 12',
        parentLabel: 'Thư mục',
        link: '/categories/lop-12',
        children: [],
      },
      {
        label: 'Lớp 11',
        parentLabel: 'Thư mục',
        link: '/categories/lop-11',
        children: [],
      },
      {
        label: 'Lớp 10',
        parentLabel: 'Thư mục',
        link: '/categories/lop-10',
        children: [],
      },
      {
        label: 'Lớp 9',
        parentLabel: 'Thư mục',
        link: '/categories/lop-9',
        children: [],
      },
      {
        label: 'Lớp 8',
        parentLabel: 'Thư mục',
        link: '/categories/lop-8',
        children: [],
      },
      {
        label: 'Lớp 7',
        parentLabel: 'Thư mục',
        link: '/categories/lop-7',
        children: [],
      },
      {
        label: 'Lớp 6',
        parentLabel: 'Thư mục',
        link: '/categories/lop-6',
        children: [],
      },
      {
        label: 'Lớp 5',
        parentLabel: 'Thư mục',
        link: '/categories/lop-5',
        children: [],
      },
      {
        label: 'Lớp 4',
        parentLabel: 'Thư mục',
        link: '/categories/lop-4',
        children: [],
      },
      {
        label: 'Lớp 3',
        parentLabel: 'Thư mục',
        link: '/categories/lop-3',
        children: [],
      },
      {
        label: 'Lớp 2',
        parentLabel: 'Thư mục',
        link: '/categories/lop-2',
        children: [],
      },
      {
        label: 'Lớp 1',
        parentLabel: 'Thư mục',
        link: '/categories/lop-1',
        children: [],
      },
    ];

    for (const item of menus) {
      // Check if exists
      let menu = await this.menuRepository.findOne({ where: { label: item.label } });

      let parent: Menu | null = null;
      if (item.parentLabel) {
        parent = await this.menuRepository.findOne({ where: { label: item.parentLabel } });
      }

      if (!menu) {
        menu = this.menuRepository.create({
          label: item.label,
          icon: item.icon,
          link: item.link, // Save link
          parent: parent || undefined,
          isActive: true
        });
      } else {
        // Update existing item link and parent if needed
        menu.link = item.link || '';
        menu.icon = item.icon || '';
        if (parent) menu.parent = parent;
      }
      await this.menuRepository.save(menu);
    }
    await this.invalidateCache();
    return { message: 'Menu seeded' };
  }

  private async invalidateCache() {
    await this.redisService.del(this.CACHE_KEY_TREE);
    await this.redisService.del(this.CACHE_KEY_ALL);
  }
}
