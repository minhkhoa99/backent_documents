export class CreateMenuDto {
    label: string;
    link?: string;
    icon?: string;
    order?: number;
    isActive?: boolean;
    parentId?: string;
}
