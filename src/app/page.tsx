'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// PhysicsCanvasはクライアントサイドのみで動作させる
const PhysicsCanvas = dynamic(() => import('@/components/PhysicsCanvas'), {
  ssr: false,
});

export default function Home() {
  const [clearCount, setClearCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClear = () => {
    setClearCount(prev => prev + 1);
  };

  if (!mounted) {
    return null; // SSR時は何も表示しない
  }

  return (
    <I18nextProvider i18n={i18n}>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <PhysicsCanvas key={clearCount} onClear={handleClear} />
      </div>
    </I18nextProvider>
  );
}

