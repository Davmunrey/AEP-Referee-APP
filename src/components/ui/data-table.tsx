import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function DataTableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("", className)} {...props} />;
}

export function DataTableHeaderRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border text-left text-xs font-medium uppercase tracking-wider text-subtle-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function DataTableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/30",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-6 py-4", className)} {...props} />;
}

export function DataTableHeadCell({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-6 py-3 font-medium", className)} {...props} />;
}
