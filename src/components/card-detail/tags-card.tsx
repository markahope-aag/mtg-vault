import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TagFlags = {
  isCommanderLegal: boolean | null;
  isGameChanger: boolean | null;
  isMassLandDenial: boolean | null;
  isExtraTurn: boolean | null;
  isTutor: boolean | null;
  isReservedList: boolean | null;
};

// Derives the visible tag chips for a card. Each row is `{ label, tone }`
// — tone is a Tailwind class string the Card renders verbatim. Returns []
// when the card has no notable tags, so the page can skip rendering the
// whole Tags card without re-implementing this logic.
function computeTags(flags: TagFlags): Array<{ label: string; tone: string }> {
  const tags: Array<{ label: string; tone: string }> = [];
  if (flags.isCommanderLegal === false)
    tags.push({
      label: "Banned in Commander",
      tone: "bg-red-100 text-red-900 ring-1 ring-red-500/30",
    });
  if (flags.isGameChanger)
    tags.push({ label: "Game Changer", tone: "bg-rose-100 text-rose-900" });
  if (flags.isMassLandDenial)
    tags.push({
      label: "Mass Land Denial",
      tone: "bg-amber-100 text-amber-900",
    });
  if (flags.isExtraTurn)
    tags.push({ label: "Extra Turn", tone: "bg-purple-100 text-purple-900" });
  if (flags.isTutor)
    tags.push({ label: "Tutor", tone: "bg-sky-100 text-sky-900" });
  if (flags.isReservedList)
    tags.push({ label: "Reserved List", tone: "bg-stone-200 text-stone-800" });
  return tags;
}

export function TagsCard({ flags }: { flags: TagFlags }) {
  const tags = computeTags(flags);
  if (tags.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tags</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t.label}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${t.tone}`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
