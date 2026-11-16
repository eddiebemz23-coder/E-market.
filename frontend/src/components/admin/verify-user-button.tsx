'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiFailure } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast';

/**
 * Manual verification for accounts whose OTP never landed. The decision is filed in the audit
 * trail with the signed-in admin as actor, so the button is deliberately small and labelled —
 * it is a support action, not a bulk lever.
 */
export function VerifyUserButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    try {
      await api.post(`/api/admin/users/${userId}/verify`, {});
      toast.push(`${name} is now verified.`, 'success');
      router.refresh();
    } catch (failure) {
      toast.push(failure instanceof ApiFailure ? failure.message : 'Could not verify the account', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={() => void verify()}>
      Verify
    </Button>
  );
}