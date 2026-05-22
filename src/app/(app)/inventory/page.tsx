import { listInventory } from "@/lib/inventory/queries";
import { INVENTORY_PAGE_SIZE } from "@/lib/inventory/types";
import { InventoryTable } from "@/components/inventory-table";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const initial = await listInventory({
    filters: { includeDisposed: false },
    sort: "createdAt",
    direction: "desc",
    offset: 0,
    limit: INVENTORY_PAGE_SIZE,
  });

  return (
    <InventoryTable
      initialRows={initial.rows}
      initialNextCursor={initial.nextCursor}
      initialTotals={{
        totalCount: initial.totalCount,
        totalValueUsd: initial.totalValueUsd,
      }}
    />
  );
}
