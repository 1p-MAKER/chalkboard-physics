'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '../i18n/config';

// PhysicsCanvasはクライアントサイドのみで動作させる
const PhysicsCanvas = dynamic(() => import('@/components/PhysicsCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#2d5016',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff'
    }}>
      Loading...
    </div>
  )
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

  // クライアントサイドでマウント完了まで何も表示しない
  if (!mounted) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#2d5016'
      }} />
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PhysicsCanvas key={clearCount} onClear={handleClear} />
    </div>
  );
}
