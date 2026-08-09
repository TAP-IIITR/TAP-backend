import { Prisma } from "@prisma/client";

/** Parse page/limit from query string with sane bounds. */
export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20)
  );
  return { page, limit, skip: (page - 1) * limit };
}

/** Build a case-insensitive contains filter for a search term. */
export function searchFilter(
  term: unknown
): Prisma.StringFilter | undefined {
  const t = String(term ?? "").trim();
  if (!t) return undefined;
  return { contains: t, mode: "insensitive" };
}
