import { describe, expect, it } from 'vitest';
import { createInvitationToken, hashInvitationToken } from './invitations';

describe('convites de organização', () => {
  it('gera tokens imprevisíveis e armazena somente hash', async () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(await hashInvitationToken(first)).not.toBe(first);
  });
});
