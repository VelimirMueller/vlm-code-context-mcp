'use client';

import React, { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterFn?: (row: T, filterValue: string) => boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface EnterpriseDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  sortable?: boolean;
  filterable?: boolean;
  pageSize?: number;
  emptyState?: React.ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}

export function EnterpriseDataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  sortable = true,
  filterable = true,
  pageSize = 25,
  emptyState,
  loading = false,
  onRowClick,
  rowClassName,
}: EnterpriseDataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Apply sorting and filtering
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    if (filterable) {
      Object.entries(filters).forEach(([columnId, filterValue]) => {
        if (filterValue.trim()) {
          const column = columns.find(c => c.id === columnId);
          if (column?.filterFn) {
            result = result.filter(row => column.filterFn!(row, filterValue));
          } else {
            // Default text filter
            result = result.filter(row => {
              const value = (row as any)[columnId];
              return String(value).toLowerCase().includes(filterValue.toLowerCase());
            });
          }
        }
      });
    }

    // Apply sorting
    if (sortable && sortColumn && sortDirection) {
      result.sort((a, b) => {
        const aVal = (a as any)[sortColumn];
        const bVal = (b as any)[sortColumn];

        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, filters, sortColumn, sortDirection, columns, sortable, filterable]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const handleSort = (columnId: string) => {
    if (!sortable) return;

    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleFilter = (columnId: string, value: string) => {
    setFilters(prev => ({ ...prev, [columnId]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  if (loading) {
    return <LoadingSkeleton columns={columns} />;
  }

  if (processedData.length === 0) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}>
        {emptyState || (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 4 }}>No data found</div>
            {Object.values(filters).some(v => v.trim()) && (
              <button
                onClick={clearFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  marginTop: 8,
                }}
              >
                Clear filters
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const hasActiveFilters = Object.values(filters).some(v => v.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      {filterable && hasActiveFilters && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {processedData.length} of {data.length} records
          </span>
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {columns.map(column => (
                  <th
                    key={column.id}
                    style={{
                      padding: '12px 16px',
                      textAlign: column.align || 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                      width: column.width,
                      cursor: column.sortable && sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort(column.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {column.header}
                      {column.sortable && sortable && (
                        <SortIndicator
                          isActive={sortColumn === column.id}
                          direction={sortColumn === column.id ? sortDirection : null}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Filter row */}
            {filterable && (
              <tr style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
                {columns.map(column => (
                  <td
                    key={column.id}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg)',
                    }}
                  >
                    {column.filterable !== false && (
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={filters[column.id] || ''}
                        onChange={(e) => handleFilter(column.id, e.target.value)}
                        style={{
                          width: '100%',
                          minWidth: 80,
                          padding: '6px 10px',
                          fontSize: 11,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text)',
                          fontFamily: 'var(--font)',
                          outline: 'none',
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}

            <tbody>
              {paginatedData.map((row, idx) => (
                <tr
                  key={(row as any)[keyField] ?? idx}
                  onClick={() => onRowClick?.(row)}
                  className={rowClassName?.(row)}
                  style={{
                    borderBottom: idx < paginatedData.length - 1 ? '1px solid var(--border2)' : 'none',
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }
                  }}
                >
                  {columns.map(column => (
                    <td
                      key={column.id}
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--text)',
                        textAlign: column.align || 'left',
                      }}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length}
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: currentPage === 1 ? 'var(--text3)' : 'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: currentPage === 1 ? 'var(--text3)' : 'var(--text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              ‹
            </button>

            {/* Page numbers */}
            {getPageNumbers(currentPage, totalPages).map((page, idx) => (
              typeof page === 'number' ? (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    background: currentPage === page ? 'var(--accent)' : 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: currentPage === page ? '#000' : 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    fontWeight: currentPage === page ? 600 : 400,
                  }}
                >
                  {page}
                </button>
              ) : (
                <span key={idx} style={{ padding: '6px 4px', color: 'var(--text3)' }}>
                  {page}
                </span>
              )
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: currentPage === totalPages ? 'var(--text3)' : 'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: currentPage === totalPages ? 'var(--text3)' : 'var(--text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────────────── */

interface SortIndicatorProps {
  isActive: boolean;
  direction: SortDirection;
}

function SortIndicator({ isActive, direction }: SortIndicatorProps) {
  if (!isActive) {
    return (
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ opacity: 0.3 }}>
        <path d="M3 5h6M6 3v4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      {direction === 'asc' ? (
        <path d="M3 7h6M6 5v4" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" />
      ) : (
        <path d="M3 5h6M6 3v4" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" transform="rotate(180 6 6)" />
      )}
    </svg>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const delta = 1;

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return pages;
}

function LoadingSkeleton<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((column, idx) => (
              <th key={idx} style={{ padding: '12px 16px', textAlign: 'left' }}>
                <div style={{ width: 100, height: 14, background: 'var(--surface3)', borderRadius: 4 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map(row => (
            <tr key={row}>
              {columns.map((_, idx) => (
                <td key={idx} style={{ padding: '12px 16px' }}>
                  <div style={{ width: '100%', height: 16, background: 'var(--surface3)', borderRadius: 4 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
