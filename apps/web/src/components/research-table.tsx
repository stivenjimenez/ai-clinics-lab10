"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

import { StatusBadge } from "./status-badge";
import styles from "./research-table.module.css";
import type { Research } from "@/lib/types";

const STATUS_ORDER: Record<string, number> = {
  researching: 0,
  pending: 1,
  ready: 2,
  failed: 3,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function ResearchTable({ data }: { data: Research[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  const columns = useMemo<ColumnDef<Research>[]>(
    () => [
      {
        id: "company",
        header: "Empresa",
        accessorFn: (r) => r.company_name,
        sortingFn: "alphanumeric",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className={styles.companyCell}>
              <span className={styles.companyName}>{r.company_name}</span>
              {r.website && (
                <span className={styles.companyContact}>{r.website}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "notes",
        header: "Observaciones",
        enableSorting: false,
        cell: ({ row }) => {
          const n = row.original.notes;
          if (!n) return <span className={styles.muted}>—</span>;
          const short = n.length > 80 ? `${n.slice(0, 80)}…` : n;
          return <span title={n}>{short}</span>;
        },
      },
      {
        id: "status",
        header: "Estado",
        accessorFn: (r) => STATUS_ORDER[r.status] ?? 99,
        sortingFn: "basic",
        cell: ({ row }) => <StatusBadge research={row.original} />,
      },
      {
        id: "created_at",
        header: "Creado",
        accessorFn: (r) => r.created_at,
        sortingFn: "basic",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "go",
        header: "",
        enableSorting: false,
        cell: () => (
          <span className={styles.arrow} aria-hidden>
            <ChevronRight size={16} strokeWidth={2.25} />
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const sorted = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    className={`${styles.th} ${canSort ? styles.thSortable : ""}`}
                    onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  >
                    <span className={styles.thInner}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      {canSort && (
                        <span className={styles.sortIcon}>
                          {sorted === "asc" ? (
                            <ChevronUp size={12} strokeWidth={2.5} />
                          ) : sorted === "desc" ? (
                            <ChevronDown size={12} strokeWidth={2.5} />
                          ) : (
                            <ChevronsUpDown size={12} strokeWidth={2} className={styles.sortIconIdle} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={styles.row}
              onClick={() => router.push(`/research/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={styles.td}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
