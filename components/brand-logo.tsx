import { Box } from 'lucide-react';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="app-brand">
      <span className="app-brand-mark">
        <Box size={compact ? 16 : 20} />
      </span>
      <span>
        flu<strong>box</strong>
      </span>
    </span>
  );
}
