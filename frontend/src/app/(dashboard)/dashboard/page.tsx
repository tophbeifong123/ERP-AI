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
  Globe,
  Sparkles,
  Video,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { postService } from '@/core/services/post-service';
import { Post, PostMediaType } from '@/core/types/post';
import { toast } from 'sonner';
import CreatePostModal from '@/components/features/posts/create-post-modal';
import { PostMediaPreview } from '@/components/features/posts/post-media-preview';
import { Service } from '@/core/types/service';
import { serviceService } from '@/core/services/service-service';

const LineIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.303.079.778.038 1.084-.131.968-.537 3.868-.537 3.868s-.167 1.002.696.58c.864-.422 4.658-2.732 6.357-4.18 1.353-.081 2.686-.39 3.896-.913 4.148-1.789 6.457-5.074 6.457-8.991zm-15.364.717h-1.579c-.276 0-.5.224-.5.5v3.197c0 .276.224.5.5.5h1.579c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.748h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.601h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5zm2.935 0h-.325c-.276 0-.5.224-.5.5v3.697c0 .276.224.5.5.5h.325c.276 0 .5-.224.5-.5v-3.697c0-.276-.224-.5-.5-.5zm4.07 0h-.326c-.276 0-.5.224-.5.5v2.247l-2.001-2.61c-.083-.111-.212-.178-.349-.178-.067 0-.135.016-.197.048-.184.093-.298.283-.298.49v3.697c0 .276.224.5.5.5h.325c.276 0 .5-.224.5-.5v-2.247l2.001 2.61c.083.111.212.178.349.178.067 0 .135-.016.197-.048.184-.093.298-.283.298-.49v-3.697c0-.276-.224-.5-.5-.5zm4.07 0h-1.579c-.276 0-.5.224-.5.5v3.197c0 .276.224.5.5.5h1.579c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.748h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5h-1.079v-.601h1.079c.276 0 .5-.224.5-.5v-.324c0-.276-.224-.5-.5-.5z" />
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export default function DashboardPage() {
  const router = useRouter();
  const { activeBusiness } = useBusinessStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

  const activeBusinessId = activeBusiness?.id;

  const [isLineConnected, setIsLineConnected] = useState(false);
  const [isIgConnected, setIsIgConnected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLineConnected(localStorage.getItem('is_line_connected') === 'true');
      setIsIgConnected(localStorage.getItem('is_ig_connected') === 'true');
    }
  }, []);

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
          <button
            type="button"
            onClick={() => {
              if (!activeBusinessId) {
                toast.error('กรุณาเลือกธุรกิจก่อนสร้างโพสต์');
                return;
              }
              if (activeBusiness?.facebookPages?.length === 0) {
                toast.error('กรุณาเชื่อมต่อ Facebook Page ก่อนสร้างโพสต์');
                router.push('/settings?tab=facebook');
                return;
              }
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างโพสต์ด้วย AI
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
                const firstMedia = hasMedia ? post.media![0] : undefined;

                return (
                  <div key={post.id} className="p-4 rounded-xl border border-border bg-background/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-white/15">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Post Media Preview */}
                      <div className="w-14 h-14 rounded-lg border border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                        {firstMedia ? (
                          <PostMediaPreview
                            media={firstMedia}
                            className="w-full h-full object-cover"
                          />
                        ) : post.status === 'generating' ? (
                          <DashboardGeneratingPlaceholder mediaType={post.mediaType} />
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
                          
                          {/* Status Tag */}
                          {post.status === 'pending_approval' && (
                            <span className="text-xxs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">รอการตรวจสอบ</span>
                          )}
                          {post.status === 'approved' && (
                            <span className="text-xxs font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded">อนุมัติแล้ว (รอคิวโพสต์)</span>
                          )}
                          {post.status === 'posted' && (
                            post.fbPostId ? (
                              <a
                                href={`https://facebook.com/${post.fbPostId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xxs font-bold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <span>โพสต์สำเร็จ</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xxs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">โพสต์สำเร็จ</span>
                            )
                          )}
                          {post.status === 'failed' && (
                            <span className="text-xxs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">เกิดข้อผิดพลาด</span>
                          )}
                        </div>

                        <p className="text-xs text-foreground font-medium line-clamp-2 pr-4 leading-relaxed">
                          {post.caption || 'ไม่มีข้อความประกอบโพสต์'}
                        </p>
                        
                        <div className="flex items-center gap-1 text-xxs text-muted-foreground">
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
              <a
                href={`https://facebook.com/${activePage.fbPageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 hover:bg-muted/50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full border border-border overflow-hidden shrink-0 flex items-center justify-center">
                    {activePage.pictureUrl ? (
                      <img src={activePage.pictureUrl} alt={activePage.pageName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {activePage.pageName[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground line-clamp-1">{activePage.pageName}</span>
                    <span className="block text-xxs text-emerald-500">เชื่อมต่อ Facebook สำเร็จ</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 block shrink-0" />
              </a>
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

            {/* LINE OA Connection Status */}
            {isLineConnected ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#06C755]/10 border border-[#06C755]/20 flex items-center justify-center text-[#06C755] shrink-0">
                    <LineIcon className="w-4.5 h-4.5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">{activeBusiness?.name || 'ธุรกิจ'} Official</span>
                    <span className="block text-xxs text-emerald-500 truncate">เชื่อมต่อ LINE OA สำเร็จ</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 block shrink-0" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 opacity-50 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 font-extrabold text-xs shrink-0">
                    L
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">LINE OA</span>
                    <span className="block text-xxs text-muted-foreground truncate">ยังไม่เชื่อมต่อ</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/settings?tab=facebook')}
                  className="px-2.5 py-1 rounded bg-[#06C755] hover:bg-[#06C755]/90 text-xxs font-bold text-white shadow shrink-0 cursor-pointer transition"
                >
                  เชื่อมต่อ
                </button>
              </div>
            )}

            {/* Instagram Connection Status */}
            {isIgConnected ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
                    <InstagramIcon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">@{activeBusiness?.name?.toLowerCase() || 'shop'}_store</span>
                    <span className="block text-xxs text-emerald-500 truncate">เชื่อมต่อ Instagram สำเร็จ</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 block shrink-0" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/35 opacity-50 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
                    <InstagramIcon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">Instagram</span>
                    <span className="block text-xxs text-muted-foreground truncate">ยังไม่เชื่อมต่อ</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/settings?tab=facebook')}
                  className="px-2.5 py-1 rounded bg-gradient-to-r from-[#833AB4] to-[#F56040] hover:opacity-90 text-xxs font-bold text-white shadow shrink-0 cursor-pointer transition"
                >
                  เชื่อมต่อ
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {activeBusinessId && (
        <CreatePostModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            router.push('/posts');
          }}
          businessId={activeBusinessId}
          services={services}
          onLoadServices={async () => {
            const data = await serviceService.getServices(activeBusinessId);
            setServices(data);
            return data;
          }}
        />
      )}
    </div>
  );
}

function DashboardGeneratingPlaceholder({ mediaType }: { mediaType?: PostMediaType }) {
  const isVideo = mediaType === 'short_video';
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-indigo-50 to-purple-50">
      {isVideo ? (
        <Video className="w-5 h-5 text-indigo-400 animate-pulse" />
      ) : (
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
      )}
      <span className="text-[9px] text-indigo-600 font-medium">
        {isVideo ? 'กำลังสร้างวิดีโอ…' : 'กำลังสร้างรูปภาพ…'}
      </span>
    </div>
  );
}
