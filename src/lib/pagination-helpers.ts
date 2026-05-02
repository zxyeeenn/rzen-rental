/** Shared client-side table pagination (page numbers + ellipses). */

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export function visiblePageItems(
  current: number,
  total: number,
): ({ type: "page"; n: number } | { type: "ellipsis"; key: string })[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({
      type: "page" as const,
      n: i + 1,
    }));
  }
  const items: (
    | { type: "page"; n: number }
    | { type: "ellipsis"; key: string }
  )[] = [];
  const pushPage = (n: number) => items.push({ type: "page", n });
  const pushEllipsis = (key: string) =>
    items.push({ type: "ellipsis", key });

  pushPage(1);
  if (current <= 3) {
    pushPage(2);
    pushPage(3);
    pushPage(4);
    pushEllipsis("end");
    pushPage(total);
  } else if (current >= total - 2) {
    pushEllipsis("start");
    pushPage(total - 3);
    pushPage(total - 2);
    pushPage(total - 1);
    pushPage(total);
  } else {
    pushEllipsis("mid-left");
    pushPage(current - 1);
    pushPage(current);
    pushPage(current + 1);
    pushEllipsis("mid-right");
    pushPage(total);
  }
  return items;
}
