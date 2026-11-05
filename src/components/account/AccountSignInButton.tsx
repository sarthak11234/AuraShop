'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SignInModal } from '@/components/auth/SignInModal';

export function AccountSignInButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-6 min-h-11 font-mono text-[10px] font-bold uppercase tracking-widest"
      >
        Sign in to your account
      </Button>
      <SignInModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
