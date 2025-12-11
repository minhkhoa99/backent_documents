import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Menu } from './entities/menu.entity';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
  ) { }

  create(createMenuDto: CreateMenuDto) {
    const menu = this.menuRepository.create(createMenuDto);
    return this.menuRepository.save(menu);
  }

  findAll() {
    return this.menuRepository.find();
  }

  getTree() {
    return this.menuRepository.find({
      where: { parent: IsNull(), isActive: true },
      relations: ['children'],
      order: {
        order: 'ASC',
      },
    });
  }

  findOne(id: string) {
    return this.menuRepository.findOne({ where: { id } });
  }

  update(id: string, updateMenuDto: UpdateMenuDto) {
    return this.menuRepository.update(id, updateMenuDto);
  }

  remove(id: string) {
    return this.menuRepository.delete(id);
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
    return { message: 'Menu seeded' };
  }
}
