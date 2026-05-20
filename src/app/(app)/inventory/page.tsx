import { listInventory } from "@/lib/inventory/queries";
import { InventoryTable } from "@/components/inventory-table";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const initial = await listInventory({
    filters: { includeDisposed: false },
    sort: "createdAt",
    direction: "desc",
    offset: 0,
    limit: 50,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <InventoryTable
        initialRows={initial.rows}
        initialNextCursor={initial.nextCursor}
        initialTotals={{
          totalCount: initial.totalCount,
          totalValueUsd: initial.totalValueUsd,
        }}
      />
    </div>
  );
}
