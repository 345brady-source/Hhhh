/*
 * Invitation link: shareholderdesk://firm/<firm id>. A firm's invitation and
 * activation emails link here, so the app opens on that firm's sign-in.
 */
import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { NS } from '../../core';
import { useSession } from '../../lib/session';

export default function FirmLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, firm, setFirm } = useSession();
  const known = NS.TENANTS.some((t: { id: string }) => t.id === id);
  const pending = !session && known && (!firm || firm.id !== id);
  useEffect(() => {
    if (pending) setFirm(String(id));
  }, [pending, id, setFirm]);
  if (pending) return null;
  return <Redirect href={session ? '/' : '/sign-in'} />;
}
