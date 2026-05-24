import { z } from "zod";

// Request shape for POST /api/locations. The locations table is the
// canonical list surfaced in the Add/Edit-card dropdown — names are
// short labels like "Trade Binder" / "Card Box".
export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type CreateLocationInput = z.input<typeof createLocationSchema>;
