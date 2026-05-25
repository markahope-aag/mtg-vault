import Link from "next/link";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TopCard = {
  oracleId: string;
  printingId: string;
  name: string;
  setName: string;
  setCode: string;
  imageUri: string | null;
  count: number;
  unitPriceUsd: number;
  totalValueUsd: number;
};

export function TopCardsGrid({ topCards }: { topCards: TopCard[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Most valuable · top 20
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {topCards.length === 0 ? (
          <p className="empty-terminal px-5 py-6 text-center">
            no inventory recorded
          </p>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-border-subtle md:grid-cols-2 md:divide-x md:divide-y-0">
            {[topCards.slice(0, 10), topCards.slice(10, 20)].map(
              (group, gi) => (
                <ul key={gi} className="divide-y divide-border-subtle">
                  {group.map((c, i) => (
                    <li
                      key={`${c.oracleId}-${c.printingId}`}
                      className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-inset/40"
                    >
                      <span className="num w-6 shrink-0 text-right text-[11px] text-text-muted">
                        {gi * 10 + i + 1}
                      </span>
                      <ImgWithFallback
                        src={c.imageUri}
                        alt={c.name}
                        className="size-10 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                        fallbackClassName="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/cards/${c.oracleId}`}
                          className="block truncate text-[13px] font-medium text-text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="truncate font-mono text-[10px] uppercase tracking-wide text-text-muted">
                          {c.setName} · {c.setCode}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-[13px] font-semibold text-text-primary">
                          ${c.totalValueUsd.toFixed(2)}
                        </p>
                        <p className="num text-[10px] text-text-muted">
                          {c.count} × ${c.unitPriceUsd.toFixed(2)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
