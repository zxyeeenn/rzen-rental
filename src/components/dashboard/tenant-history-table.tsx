"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatPHP } from "@/lib/format-php";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  visiblePageItems,
} from "@/lib/pagination-helpers";
import { shortRoomLabelFromListingTitle } from "@/lib/room-display-name";
import type { TenantHistoryRow } from "@/lib/types/tenant-history";

export function TenantHistoryTable({ rows }: { rows: TenantHistoryRow[] }) {
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(rows.length / DEFAULT_TABLE_PAGE_SIZE),
  );

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageOffset = (page - 1) * DEFAULT_TABLE_PAGE_SIZE;
  const pageRows = rows.slice(
    pageOffset,
    pageOffset + DEFAULT_TABLE_PAGE_SIZE,
  );
  const paginationItems = visiblePageItems(page, totalPages);

  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-10 text-center text-sm text-indigo-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground">
        No lease rows in Supabase yet. Active and past leases you add in the{" "}
        <span className="font-mono text-xs">leases</span> table will show here.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full text-sm">
          <thead>
            <tr className="border-b-2 border-indigo-200 bg-indigo-50 text-left dark:border-border dark:bg-muted/40">
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Tenant
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Phone
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Room
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Rent
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Due day
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Start
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                End
              </th>
              <th className="px-3 py-3 text-xs font-semibold text-[#4338ca] dark:text-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.leaseId}
                className="border-b border-indigo-100/50 last:border-b-0 dark:border-border"
              >
                <td className="px-3 py-3">
                  <p className="font-medium">{row.tenantName}</p>
                  {row.notes ? (
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground line-clamp-2">
                      {row.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {row.tenantPhone ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <span className="font-medium">
                    {shortRoomLabelFromListingTitle(row.roomTitle)}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {formatPHP(row.monthlyRentPhp)}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.rentDueDay}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {row.leaseStartDisplay}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {row.leaseEndDisplay ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <Badge
                    className={
                      row.isActive
                        ? "border-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200"
                        : "border-0 bg-indigo-500/15 text-indigo-900 dark:text-indigo-200"
                    }
                  >
                    {row.isActive ? "Active" : "Ended"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-indigo-100/80 pt-4 dark:border-border">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {pageOffset + 1}–
              {Math.min(pageOffset + DEFAULT_TABLE_PAGE_SIZE, rows.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{rows.length}</span>
          </p>
          <Pagination>
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage((p) => p - 1);
                  }}
                />
              </PaginationItem>
              {paginationItems.map((item) =>
                item.type === "ellipsis" ? (
                  <PaginationItem key={item.key}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item.n}>
                    <PaginationLink
                      href="#"
                      isActive={item.n === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(item.n);
                      }}
                    >
                      {item.n}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage((p) => p + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}
