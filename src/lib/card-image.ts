// Picks the best image URL for a printing, handling double-faced cards (DFCs)
// whose top-level `image_uris` is null because the art lives on each face.

export type ImageUris = Record<string, string> | null | undefined;
export type CardFaces =
  | Array<{ image_uris?: Record<string, string> | null }>
  | null
  | undefined;

const PREFERENCE: Record<
  "small" | "normal" | "large",
  ReadonlyArray<string>
> = {
  small: ["small", "normal", "large", "png"],
  normal: ["normal", "large", "png", "small"],
  large: ["large", "png", "normal", "small"],
};

function pickFromMap(
  m: Record<string, string> | null | undefined,
  size: "small" | "normal" | "large",
): string | null {
  if (!m) return null;
  for (const key of PREFERENCE[size]) {
    const v = m[key];
    if (v) return v;
  }
  return null;
}

/**
 * Try the printing's top-level image, then fall back to the front face
 * (card_faces[0].image_uris). DFCs have a null top-level and rely on faces.
 */
export function pickCardImage(
  imageUris: ImageUris,
  cardFaces?: CardFaces,
  size: "small" | "normal" | "large" = "normal",
): string | null {
  const direct = pickFromMap(imageUris ?? null, size);
  if (direct) return direct;
  const face = cardFaces?.[0]?.image_uris ?? null;
  return pickFromMap(face, size);
}
