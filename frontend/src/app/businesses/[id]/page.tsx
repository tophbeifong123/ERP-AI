// src/app/businesses/[id]/page.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function BusinessRedirectHandler() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = params.id as string;
  const fb = searchParams.get('fb');
  const msg = searchParams.get('msg');

  useEffect(() => {
    if (!businessId) {
      router.push('/dashboard');
      return;
    }

    // หากมีการเชื่อมต่อสิทธิ์ Facebook กลับมาจากหลังบ้าน
    if (fb === 'connected') {
      // ส่งต่อไปหน้า onboarding step 4 พร้อมระบุสถานะเชื่อมต่อ
      router.push(`/onboarding?step=4&fb=connected&businessId=${businessId}`);
    } else if (fb === 'error') {
      // ส่งกลับไป step 4 พร้อมแจ้ง error
      router.push(`/onboarding?step=4&fb=error&msg=${msg ? encodeURIComponent(msg) : ''}&businessId=${businessId}`);
    } else {
      // กรณีปกติ ส่งไป dashboard หลัก
      router.push('/dashboard');
    }
  }, [businessId, fb, msg, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-3">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">กำลังบันทึกข้อมูลการเชื่อมต่อเพจ...</p>
    </div>
  );
}

export default function BusinessRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <BusinessRedirectHandler />
    </Suspense>
  );
}
