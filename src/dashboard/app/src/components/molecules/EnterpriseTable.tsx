'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export type SortDirection = 'asc' | 'desc' | null;
export type ColumnId = string;

export interface Column<T> {
  id: string;
  label: string;
  width?: string | number;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'number' | 'date' | 'status';
  filterOptions?: Array<{ value: string; label: string; color?: string }>;
  render: (row: T) => React.ReactNode;
  getFilterValue?: (row: T) => string | number | null;
}

export interface EnterpriseTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowId: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  defaultSortColumn?: string;
  defaultSortDirection?: SortDirection;
  emptyMessage?: string;
  loading?: boolean;
  pageSize?: number;
  stickyHeader?: boolean;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  renderRowActions?: (row: T) => React.ReactNode;
}

export function EnterpriseTable<T>({
  columns,
  data,
  rowId,
  onRowClick,
  searchable = true,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  emptyMessage = 'No data available',
  loading = false,
  pageSize,
  stickyHeader = true,
  dense = false,
  rowClassName,
  renderRowActions
}: EnterpriseTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<ColumnId | null>(defaultSortColumn || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort data
  const { filteredData, sortedData } = useMemo(() => {
    let result = [...data];

    // Apply text search across all filterable columns
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          if (!col.filterable) return false;
          const value = col.getFilterValue ? col.getFilterValue(row) : String(col.render(row));
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply column filters
    Object.entries(activeFilters).forEach(([colId, value]) => {
      if (!value) return;
      const column = columns.find(c => c.id === colId);
      if (!column?.filterable) return;

      result = result.filter(row => {
        const rowValue = column.getFilterValue ? column.getFilterValue(row) : String(column.render(row));
        if (column.filterType === 'select' || column.filterType === 'status') {
          return String(rowValue) === value;
        }
        return String(rowValue).toLowerCase().includes(value.toLowerCase());
      });
    });

    const filteredData = result;

    // Apply sorting
    if (sortColumn) {
      const column = columns.find(c => c.id === sortColumn);
      if (column?.sortable) {
        result.sort((a, b) => {
          const aValue = column.getFilterValue ? column.getFilterValue(a) : String(column.render(a));
          const bValue = column.getFilterValue ? column.getFilterValue(b) : String(column.render(b));

          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }

          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return { filteredData, sortedData: result };
  }, [data, searchQuery, activeFilters, sortColumn, sortDirection, columns]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!pageSize) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = pageSize ? Math.ceil(sortedData.length / pageSize) : 1;

  const handleSort = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleFilterChange = (columnId: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [columnId]: value }));
    setCurrentPage(1);
  };

  const clearFilter = (columnId: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
    setCurrentPage(1);
  };

  const rowHeight = dense ? 36 : 48;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search and Filter Bar */}
      {searchable && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            flex: 1,
            position: 'relative',
            maxWidth: 400
          }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: 13,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'var(--font)'
              }}
            />
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text3)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          {/* Active Filters */}
          {Object.entries(activeFilters).map(([colId, value]) => {
            const column = columns.find(c => c.id === colId);
            if (!column) return null;
            return (
              <div
                key={colId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px 4px 12px',
                  background: 'var(--accent)15',
                  border: '1px solid var(--accent)40',
                  borderRadius: 16
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{column.label}:</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>
                  {column.filterOptions?.find(o => o.value === value)?.label || value}
                </span>
                <button
                  onClick={() => clearFilter(colId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: columns.map(c => c.width || 'minmax(120px, 1fr)').join(' '),
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 10 } : {})
        }}>
          {columns.map(column => (
            <div
              key={column.id}
              style={{
                padding: dense ? '10px 12px' : '14px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: column.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onClick={() => column.sortable && handleSort(column.id)}
            >
              {column.label}
              {column.sortable && (
                <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
                  {sortColumn === column.id ? (
                    sortDirection === 'asc' ? (
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    ) : (
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )
                  ) : (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} opacity={0.3}>
                      <path d="m8 9 4 4 4-4M8 15l4 4 4-4" />
                    </svg>
                  )}
                </span>
              )}
            </div>
          ))}
          {renderRowActions && <div style={{ width: 40 }} />}
        </div>

        {/* Filter Row */}
        {columns.some(c => c.filterable) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: columns.map(c => c.width || 'minmax(120px, 1fr)').join(' '),
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)'
          }}>
            {columns.map(column => (
              <div key={`${column.id}-filter`} style={{ padding: dense ? '6px 12px' : '8px 16px' }}>
                {column.filterable && (
                  <TableFilter
                    column={column}
                    value={activeFilters[column.id] || ''}
                    onChange={(value) => handleFilterChange(column.id, value)}
                  />
                )}
              </div>
            ))}
            {renderRowActions && <div style={{ width: 40 }} />}
          </div>
        )}

        {/* Body */}
        <div style={{ overflowY: 'auto', maxHeight: '600px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Loading...
            </div>
          ) : paginatedData.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {emptyMessage}
            </div>
          ) : (
            paginatedData.map((row, index) => (
              <motion.div
                key={rowId(row)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: columns.map(c => c.width || 'minmax(120px, 1fr)').join(' '),
                  borderBottom: index < paginatedData.length - 1 ? '1px solid var(--border)' : 'none',
                  background: onRowClick ? 'var(--bg)' : undefined,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  ...(rowClassName ? { className: rowClassName(row) } : {})
                }}
                onClick={() => onRowClick?.(row)}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.background = 'var(--surface2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.background = 'var(--bg)';
                  }
                }}
              >
                {columns.map(column => (
                  <div
                    key={column.id}
                    style={{
                      padding: dense ? '8px 12px' : '12px 16px',
                      fontSize: 13,
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {column.render(row)}
                  </div>
                ))}
                {renderRowActions && (
                  <div style={{ padding: dense ? '8px 12px' : '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                    {renderRowActions(row)}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Footer / Pagination */}
        {pageSize && sortedData.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface2)'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: currentPage === 1 ? 'var(--surface3)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)'
                }}
              >
                Previous
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        background: currentPage === pageNum ? 'var(--accent)' : 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: currentPage === pageNum ? '#000' : 'var(--text)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                        fontWeight: currentPage === pageNum ? 600 : 400
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: currentPage === totalPages ? 'var(--surface3)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
        <span>Total: {sortedData.length} rows</span>
        {filteredData.length !== sortedData.length && (
          <span>Filtered from: {data.length} rows</span>
        )}
      </div>
    </div>
  );
}

interface TableFilterProps<T> {
  column: Column<T>;
  value: string;
  onChange: (value: string) => void;
}

function TableFilter<T>({ column, value, onChange }: TableFilterProps<T>) {
  if (column.filterType === 'select' || column.filterType === 'status') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 11,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--text)',
          outline: 'none',
          fontFamily: 'var(--font)'
        }}
      >
        <option value="">All</option>
        {column.filterOptions?.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      placeholder="Filter..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '4px 8px',
        fontSize: 11,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--text)',
        outline: 'none',
        fontFamily: 'var(--font)'
      }}
    />
  );
}
