import { AppDataSource } from '../data-source';
import { Menu } from '../menus/entities/menu.entity';
import { IsNull } from 'typeorm';

async function updateMenuOrder() {
    console.log("Initializing Data Source...");
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const menuRepo = AppDataSource.getRepository(Menu);

    console.log("Fetching root menus...");
    // Fetch roots sorting by label initially to have a deterministic order
    const roots = await menuRepo.find({
        where: { parent: IsNull() },
        order: { label: 'ASC' }
    });

    console.log(`Found ${roots.length} root menus. Applying auto-increment...`);

    let rootOrder = 1;
    for (const root of roots) {
        // Update root order
        // Only update if changed to avoid unnecessary writes, or just write it.
        if (root.order !== rootOrder) {
            root.order = rootOrder;
            await menuRepo.save(root);
            console.log(`Updated root: ${root.label} -> Order ${root.order}`);
        }
        rootOrder++;

        // Process children
        await updateChildrenOrder(menuRepo, root);
    }

    console.log("Menu order update completed.");
    await AppDataSource.destroy();
}

async function updateChildrenOrder(menuRepo: any, parent: Menu) {
    const children = await menuRepo.find({
        where: { parent: { id: parent.id } },
        order: { label: 'ASC' }
    });

    if (children.length > 0) {
        // console.log(`Processing ${children.length} children for ${parent.label}`);
        let childOrder = 1;
        for (const child of children) {
            if (child.order !== childOrder) {
                child.order = childOrder;
                await menuRepo.save(child);
                // console.log(`  Updated child: ${child.label} -> Order ${child.order}`);
            }
            childOrder++;

            // Recurse
            await updateChildrenOrder(menuRepo, child);
        }
    }
}

updateMenuOrder().catch((error) => {
    console.error('Error updating menu order:', error);
    process.exit(1);
});
