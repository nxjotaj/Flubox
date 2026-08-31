import { Badge, Button, Card, EmptyState as AstryxEmptyState, Skeleton } from "@astryxdesign/core";
import { Inbox } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function ActionButton({ children, tone = "secondary", ...props }: Omit<ComponentProps<typeof Button>, "label" | "variant"> & { children: ReactNode; tone?: "primary" | "secondary" | "ghost" | "danger" }) {
  const label = typeof children === "string" ? children : props["aria-label"] || "Ação";
  return <Button {...props} label={String(label)} variant={tone === "danger" ? "destructive" : tone}>{children}</Button>;
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function StatCard({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  onClick?: () => void;
}) {
  return (
    <Card className="stat-card" elevation="low">
      <button type="button" onClick={onClick}>
        <span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}
      </button>
    </Card>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AstryxEmptyState className="empty-state" icon={<Inbox />} title={title} description={description} actions={action} />
  );
}
export function StatusBadge({ children }: { children: ReactNode }) {
  const value = String(children).toUpperCase();
  const variant = /CONFIRMED|PAID|SHIPPED|ACTIVE|READY|APPROVED/.test(value) ? "success" : /ERROR|REJECTED|CANCELLED|SUSPENDED|FAILED/.test(value) ? "error" : /REVIEW|PENDING|AWAITING|SEPARATING/.test(value) ? "warning" : "neutral";
  return <Badge className="status-badge" variant={variant} label={children} />;
}
export function Loading() {
  return <div className="loading" role="status" aria-label="Carregando dados"><Skeleton height={22} width="45%"/><Skeleton height={116}/><Skeleton height={116} index={1}/></div>;
}
