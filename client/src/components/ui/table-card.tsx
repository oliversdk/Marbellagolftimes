import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBreakpoint } from "@/hooks/use-breakpoint"

interface TableCardColumn<T> {
  key: keyof T | string
  label: string
  render?: (value: unknown, row: T, index: number) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface TableCardProps<T extends Record<string, unknown>> {
  columns: TableCardColumn<T>[]
  data: T[]
  onRowClick?: (row: T, index: number) => void
  isLoading?: boolean
  loadingRows?: number
  className?: string
  emptyMessage?: string
  keyExtractor?: (row: T, index: number) => string | number
}

function TableCardSkeleton({
  columns,
  rows = 5,
}: {
  columns: number
  rows?: number
}) {
  const { isDesktop } = useBreakpoint()

  if (isDesktop) {
    return (
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <Card key={rowIdx}>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: Math.min(columns, 4) }).map((_, colIdx) => (
              <div key={colIdx} className="flex justify-between items-center">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableCard<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  loadingRows = 5,
  className,
  emptyMessage = "No data available",
  keyExtractor,
}: TableCardProps<T>) {
  const { isDesktop } = useBreakpoint()

  if (isLoading) {
    return (
      <TableCardSkeleton
        columns={columns.filter((c) => !c.hideOnMobile).length}
        rows={loadingRows}
      />
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-muted-foreground"
        data-testid="table-card-empty"
      >
        {emptyMessage}
      </div>
    )
  }

  const getValue = (row: T, key: keyof T | string): unknown => {
    if (typeof key === "string" && key.includes(".")) {
      const keys = key.split(".")
      let value: unknown = row
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k]
      }
      return value
    }
    return row[key as keyof T]
  }

  const getKey = (row: T, index: number): string | number => {
    if (keyExtractor) return keyExtractor(row, index)
    if ("id" in row) return row.id as string | number
    return index
  }

  if (isDesktop) {
    return (
      <div className={cn("w-full overflow-auto", className)}>
        <Table data-testid="table-card-table">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={String(column.key)} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow
                key={getKey(row, rowIndex)}
                onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
                data-testid={`table-row-${rowIndex}`}
              >
                {columns.map((column) => {
                  const value = getValue(row, column.key)
                  return (
                    <TableCell
                      key={String(column.key)}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(value, row, rowIndex)
                        : (value as React.ReactNode)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const visibleColumns = columns.filter((c) => !c.hideOnMobile)

  return (
    <div className={cn("space-y-3", className)} data-testid="table-card-cards">
      {data.map((row, rowIndex) => (
        <Card
          key={getKey(row, rowIndex)}
          className={onRowClick ? "cursor-pointer hover-elevate" : undefined}
          onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
          data-testid={`card-row-${rowIndex}`}
        >
          <CardContent className="p-4 space-y-2">
            {visibleColumns.map((column, colIndex) => {
              const value = getValue(row, column.key)
              const renderedValue = column.render
                ? column.render(value, row, rowIndex)
                : (value as React.ReactNode)

              if (colIndex === 0) {
                return (
                  <div
                    key={String(column.key)}
                    className="font-medium text-foreground"
                  >
                    {renderedValue}
                  </div>
                )
              }

              return (
                <div
                  key={String(column.key)}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-muted-foreground">{column.label}</span>
                  <span className="text-foreground">{renderedValue}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export { TableCard, TableCardSkeleton }
export type { TableCardColumn, TableCardProps }
