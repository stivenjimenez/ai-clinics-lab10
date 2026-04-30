"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { StatusBadge } from "./status-badge";
import styles from "./research-table.module.css";
import type { Research } from "@/lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function ResearchTable({ data }: { data: Research[] }) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<Research>[]>(
    () => [
      {
        id: "company",
        header: "Empresa",
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
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "created_at",
        header: "Creado",
        accessorFn: (r) => formatDate(r.created_at),
      },
      {
        id: "go",
        header: "",
        cell: () => <span className={styles.arrow} aria-hidden>→</span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className={styles.th}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
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
