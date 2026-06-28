// src/app/(dashboard)/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { 
  Building, 
  TrendingUp, 
  ThumbsUp, 
  MessageSquare, 
  Plus, 
  ArrowUpRight,
  Settings,
  Check,
  X,
  Loader2,
  Calendar,
  Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { postService } from '@/core/services/post-service';
import { Post } from '@/core/types/post';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const { activeBusiness } = useBusinessStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeBusinessId = activeBusiness?.id;

  const loadPosts = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const data = await postService.getPosts({ businessId: activeBusinessId });
      setPosts(data);
    } catch (err) {
      console.error('Failed to load dashboard posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPosts();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await postService.approvePost(id);
      toast.success('อนุมัติโพสต์เรียบร้อยแล้ว! เตรียมนำส่งขึ้น Facebook ตามกำหนดการ');
      await loadPosts();
    } catch (err) {
      toast.error('ไม่สามารถอนุมัติโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('คุณต้องการปฏิเสธโพสต์ของ AI รายการนี้ใช่หรือไม่?')) return;
    setActionLoading(id);
    try {
      await postService.rejectPost(id, 'user_rejected');
      toast.success('ปฏิเสธโพสต์ของ AI แล้ว');
      await loadPosts();
    } catch (err) {
      toast.error('ไม่สามารถปฏิเสธโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  // กรองโพสต์ล่าสุดที่ไม่ใช่แบบร่าง (draft) หรือกำลังประมวลผล (generating)
  const recentPosts = posts
    .filter((p) => p.status !== 'draft' && p.status !== 'generating')
    .slice(0, 5); // แสดง 5 โพสต์ล่าสุด

  // คำนวณสถิติจากคิวโพสต์จริง
  const postedCount = posts.filter((p) => p.status === 'posted').length;
  const pendingCount = posts.filter((p) => p.status === 'pending_approval').length;
  const approvedCount = posts.filter((p) => p.status === 'approved').length;

  const stats = [
    { name: 'ยิงโพสต์แล้วสำเร็จ', value: `${postedCount} โพสต์`, change: 'อัปเดตเรียลไทม์', icon: TrendingUp },
    { name: 'รอตรวจอนุมัติ', value: `${pendingCount} โพสต์`, change: 'ต้องการตรวจสอบ', icon: MessageSquare },
    { name: 'อนุมัติรอคิวยิง', value: `${approvedCount} โพสต์`, change: 'อยู่ในคิวโพสต์', icon: ThumbsUp },
  ];

  // ตรวจเช็กเฟสบุ๊กเพจที่ผูกอยู่ปัจจุบัน
  const activePage = activeBusiness?.facebookPages && activeBusiness.facebookPages.length > 0
    ? activeBusiness.facebookPages[0]
    : null;

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">ภาพรวมแดชบอร์ด</h1>
          <p className="text-xs text-muted-foreground">
            วิเคราะห์และจัดการโพสต์ล่าสุดสำหรับแบรนด์: <span className="text-primary font-bold">{activeBusiness?.name || 'กำลังโหลด...'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.push('/settings')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-bold text-foreground transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            ตั้งค่าธุรกิจ
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer">
            <Plus className="w-4 h-4" />
            สร้างโพสต์ด่วน (AI)
          </button>
        </div>
      </div>

      {/* Grid Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="glass-panel glow-indigo rounded-xl p-5 flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-xxs font-bold text-muted-foreground uppercase tracking-wider block">{stat.name}</span>
                <span className="text-xl font-extrabold text-foreground block">{stat.value}</span>
                <span className="inline-flex items-center text-xxs text-emerald-500 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {stat.change}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Workspace Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Recent AI Posts */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-extrabold text-foreground">โพสต์ล่าสุดของ AI</h2>
            <button className="text-xxs text-primary hover:text-primary/80 font-bold flex items-center gap-0.5 cursor-pointer">
              ดูทั้งหมด <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">กำลังโหลดรายการโพสต์ของ AI...</span>
            </div>
          ) : recentPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center gap-3 border border-dashed border-border rounded-lg bg-muted/20">
              <Building className="w-8 h-8 text-muted-foreground" />
              <div>
                <span className="block text-xs font-semibold text-foreground">ยังไม่มีคิวโพสต์ที่อนุมัติ</span>
                <span className="block text-xxs text-muted-foreground max-w-xs mt-1 leading-normal">
                  AI จะแนะนำ Content Plan โพสต์แรกสำหรับการตลาดของคุณในวันพรุ่งนี้ เวลา 06:00 น.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => {
                const dateText = post.scheduledAt 
                  ? new Date(post.scheduledAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                  : 'ไม่ได้กำหนดเวลา';
                const hasMedia = post.media && post.media.length > 0;
                const mediaUrl = hasMedia ? post.media![0].file.publicUrl : null;

                return (
                  <div key={post.id} className="p-4 rounded-xl border border-border bg-background/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-white/15">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Post Media Preview */}
                      <div className="w-14 h-14 rounded-lg border border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                        {mediaUrl ? (
                          <img src={mediaUrl} alt="Post preview" className="w-full h-full object-cover" />
                        ) : (
                          <Building className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xxs font-extrabold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">
                            {post.postType === 'promotion' ? 'โปรโมชั่น' : 
                             post.postType === 'product_showcase' ? 'แนะนำสินค้า' : 
                             post.postType === 'brand_awareness' ? 'สร้างแบรนด์' : 'กิจกรรม'}
                          </span>

                          <span className="text-xxs text-muted-foreground bg-muted/65 px-1.5 py-0.5 rounded border border-border/40">
                            {post.generationSource === 'auto_ai' ? '🤖 AI อัจฉริยะ' : 
                             post.generationSource === 'fixed_schedule' ? '📅 ตารางประจำ' : '✏️ สร้างเอง'}
                          </span>
                          
                          {/* Status Tag */}
                          {post.status === 'pending_approval' && (
                            <span className="text-xxs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">รอการตรวจสอบ</span>
                          )}
                          {post.status === 'approved' && (
                            <span className="text-xxs font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded">อนุมัติแล้ว (รอคิวโพสต์)</span>
                          )}
                          {post.status === 'posted' && (
                            <span className="text-xxs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">โพสต์สำเร็จ</span>
                          )}
                          {post.status === 'failed' && (
                            <span className="text-xxs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">เกิดข้อผิดพลาด</span>
                          )}
                        </div>

                        <p className="text-xs text-foreground font-medium line-clamp-2 pr-4 leading-relaxed">
                          {post.caption || 'ไม่มีข้อความประกอบโพสต์'}
                        </p>

                        {/* Error Message for failed posts */}
                        {post.status === 'failed' && post.errorMessage && (
                          <div className="text-xxs text-red-400 bg-red-500/5 border border-red-500/10 rounded-md p-2 mt-1 leading-normal max-w-lg">
                            ⚠️ ข้อผิดพลาด: {post.errorMessage}
                          </div>
                        )}

                        {/* Approval Deadline for pending posts */}
                        {post.status === 'pending_approval' && post.approvalDeadline && (
                          <div className="text-xxs text-amber-500/90 font-medium flex items-center gap-1 mt-1">
                            <span>⏳ จะหมดอายุอนุมัติ: {new Date(post.approvalDeadline).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 text-xxs text-muted-foreground pt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>กำหนดโพสต์: {dateText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions buttons for pending approval */}
                    {post.status === 'pending_approval' && (
                      <div className="flex items-center gap-2 shrink-0 md:self-center">
                        <button
                          type="button"
                          onClick={() => handleReject(post.id)}
                          disabled={actionLoading !== null}
                          className="p-2 rounded-lg bg-secondary hover:bg-red-500/10 border border-border hover:border-red-500/20 text-muted-foreground hover:text-red-500 transition cursor-pointer disabled:opacity-50"
                          title="ปฏิเสธโพสต์"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(post.id)}
                          disabled={actionLoading !== null}
                          className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/95 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoading === post.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          อนุมัติ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Channel Connections */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-foreground">ช่องทางสื่อที่ผูกสิทธิ์</h2>
          
          <div className="space-y-3">
            {activePage ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full border border-border overflow-hidden shrink-0 flex items-center justify-center">
                    {activePage.pictureUrl ? (
                      <img src={activePage.pictureUrl} alt={activePage.pageName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {activePage.pageName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-foreground line-clamp-1">{activePage.pageName}</span>
                    <span className="block text-xxs text-emerald-500">เชื่อมต่อ Facebook สำเร็จ</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 block shrink-0" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-foreground">เพจ Facebook</span>
                    <span className="block text-xxs text-muted-foreground">ยังไม่ได้เชื่อมโยงเพจ</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/settings?tab=facebook')}
                  className="px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-xxs font-bold text-white shadow shrink-0 cursor-pointer transition"
                >
                  เชื่อมต่อ
                </button>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 opacity-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 font-extrabold text-xs shrink-0">
                  L
                </div>
                <div>
                  <span className="block text-xs font-bold text-foreground">LINE OA</span>
                  <span className="block text-xxs text-muted-foreground">ยังไม่เชื่อมต่อ</span>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-muted-foreground block shrink-0" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
