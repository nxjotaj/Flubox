export type OrganizationMembership = { id: string; status: string };
export function chooseActiveOrganization<T extends OrganizationMembership>(
  memberships: readonly T[],
  selectedId?: string,
): T | null {
  const active = memberships.filter(
    (membership) => membership.status === 'active',
  );
  return (
    active.find((membership) => membership.id === selectedId) ??
    active[0] ??
    null
  );
}
