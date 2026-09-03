'use client';
export function OrganizationSwitcher({
  activeId,
  organizations,
}: {
  activeId: string;
  organizations: { id: string; displayName: string; type: string }[];
}) {
  if (organizations.length < 2) return null;
  async function change(organizationId: string) {
    const response = await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });
    if (response.ok) window.location.assign('/dashboard');
  }
  return (
    <label className="organization-switcher">
      <span>Organização ativa</span>
      <select
        value={activeId}
        onChange={(event) => void change(event.target.value)}
      >
        {organizations.map((organization) => (
          <option value={organization.id} key={organization.id}>
            {organization.displayName} ·{' '}
            {organization.type === 'supplier'
              ? 'fornecedor'
              : organization.type === 'reseller'
                ? 'revendedor'
                : 'administração'}
          </option>
        ))}
      </select>
    </label>
  );
}
