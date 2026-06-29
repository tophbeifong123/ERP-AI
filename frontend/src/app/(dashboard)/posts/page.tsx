// src/app/(dashboard)/posts/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Check,
  X,
  Trash2,
  Edit3,
  Loader2,
  Building,
  ExternalLink,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Video,
} from 'lucide-react';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { postService } from '@/core/services/post-service';
import { Post, PostMediaType, PostStatus, PostType } from '@/core/types/post';
import { Service } from '@/core/types/service';
import { serviceService } from '@/core/services/service-service';
import { PostMediaPreview } from '@/components/features/posts/post-media-preview';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type FilterStatus =
  | 'all'
  | 'generating'
  | 'pending'
  | 'scheduled'
  | 'posted'
  | 'failed_rejected';

const POST_TYPE_LABEL: Record<PostType, string> = {
  promotion: 'โปรโมชั่น',
  product_showcase: 'แนะนำสินค้า',
  brand_awareness: 'สร้างแบรนด์',
  event: 'กิจกรรม',
};

const toDatetimeLocal = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromDatetimeLocal = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export default function PostsPage() {
  const { activeBusiness } = useBusinessStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editPostType, setEditPostType] = useState<PostType>('promotion');
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const activeBusinessId = activeBusiness?.id;

  const loadPosts = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const data = await postService.getPosts({ businessId: activeBusinessId });
      setPosts(data);
    } catch {
      toast.error('ไม่สามารถโหลดตารางแผนงานโพสต์ได้');
    } finally {
      setLoading(false);
    }
  };

  // Initial load + when business changes
  useEffect(() => {
    setPosts([]);
    const timer = setTimeout(() => {
      loadPosts();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  // 3-second polling while any post is in 'generating'
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasGenerating = posts.some((p) => p.status === 'generating');
    if (hasGenerating && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadPosts();
      }, 3000);
    }
    if (!hasGenerating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await postService.approvePost(id);
      toast.success(
        'อนุมัติโพสต์แล้ว! ระบบจะโพสต์ขึ้น Facebook ตามเวลาที่กำหนด',
      );
      await loadPosts();
    } catch {
      toast.error('ไม่สามารถอนุมัติโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('คุณแน่ใจว่าต้องการปฏิเสธคำแนะนำโพสต์นี้ของ AI ใช่หรือไม่?'))
      return;
    setActionLoading(id);
    try {
      await postService.rejectPost(id, 'user_rejected');
      toast.success('ปฏิเสธโพสต์เรียบร้อยแล้ว');
      await loadPosts();
    } catch {
      toast.error('ไม่สามารถดำเนินการปฏิเสธโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingPostId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPostId) return;
    const id = deletingPostId;
    setDeletingPostId(null);
    setActionLoading(id);
    try {
      await postService.deletePost(id);
      toast.success('ลบโพสต์ออกจากตารางเวลาสำเร็จ');
      setPosts(posts.filter((p) => p.id !== id));
    } catch {
      toast.error('ไม่สามารถลบโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditModal = async (post: Post) => {
    setEditingPost(post);
    setEditCaption(post.caption ?? '');
    setEditScheduledAt(
      toDatetimeLocal(post.scheduledAt ?? post.suggestedScheduledAt),
    );
    setEditPostType((post.postType ?? 'promotion') as PostType);
    setEditServiceIds([]); // services not in Post type; pull from full detail
    setEditModalOpen(true);
    if (activeBusinessId) {
      try {
        const data = await serviceService.getServices(activeBusinessId);
        setAvailableServices(data);
      } catch {
        toast.error('ไม่สามารถโหลดรายการสินค้า/บริการได้');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setEditLoading(true);
    try {
      const updated = await postService.updatePost(editingPost.id, {
        caption: editCaption,
        scheduledAt: fromDatetimeLocal(editScheduledAt) ?? undefined,
        postType: editPostType,
        featuredServiceIds: editServiceIds,
      });
      toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว');
      setPosts(posts.map((p) => (p.id === editingPost.id ? updated : p)));
      setEditModalOpen(false);
    } catch {
      toast.error('ไม่สามารถแก้ไขโพสต์ได้');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'generating') return post.status === 'generating';
    if (activeFilter === 'pending') return post.status === 'pending_approval';
    if (activeFilter === 'scheduled') return post.status === 'approved';
    if (activeFilter === 'posted') return post.status === 'posted';
    if (activeFilter === 'failed_rejected')
      return (
        post.status === 'failed' ||
        post.status === 'rejected' ||
        post.status === 'expired'
      );
    return true;
  });

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI กำลังสร้าง
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <HelpCircle className="w-3 h-3" />
            รอการตรวจสอบ
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            อนุมัติแล้ว (ในคิว)
          </span>
        );
      case 'posted':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            เผยแพร่สำเร็จ
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            ระบบล้มเหลว
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" />
            ปฏิเสธโดยผู้ใช้
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            เลยกำหนดอนุมัติ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xxs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Calendar className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ห้องทำงาน AI โพสต์
          </h1>
          <p className="text-sm text-muted-foreground">
            ปฏิทินแผนงานคอนเทนต์และเครื่องมือจัดการดูแลโพสต์ทั้งหมดของแบรนด์
          </p>
        </div>
      </div>

      <div className="flex border-b border-border gap-1 overflow-x-auto pb-px">
        {(
          [
            { key: 'all', l: 'ทั้งหมด (All)' },
            { key: 'generating', l: 'AI กำลังสร้าง' },
            { key: 'pending', l: 'รอตรวจอนุมัติ (Review)' },
            { key: 'scheduled', l: 'อนุมัติแล้ว (Scheduled)' },
            { key: 'posted', l: 'เผยแพร่สำเร็จ (Posted)' },
            { key: 'failed_rejected', l: 'ล้มเหลว/ปฏิเสธ (Inactive)' },
          ] as const
        ).map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.l}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">
            กำลังโหลดรายการแผนงานโพสต์ของคุณ...
          </span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass-panel rounded-xl p-16 flex flex-col items-center justify-center text-center gap-3 max-w-lg mx-auto">
          <Building className="w-12 h-12 text-muted-foreground animate-pulse" />
          <span className="text-sm font-bold text-foreground">
            ไม่พบรายการโพสต์ในหมวดหมู่นี้
          </span>
          <p className="text-xs text-muted-foreground leading-normal max-w-sm">
            ไปที่หน้าแดชบอร์ดแล้วกดปุ่ม "สร้างโพสต์ด้วย AI" เพื่อเริ่มงานแรกของคุณ
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const dateText = post.scheduledAt
              ? new Date(post.scheduledAt).toLocaleString('th-TH', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : post.suggestedScheduledAt
                ? `แนะนำ: ${new Date(post.suggestedScheduledAt).toLocaleString('th-TH', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}`
                : 'ยังไม่ได้กำหนดเวลา';
            const hasMedia = post.media && post.media.length > 0;
            const firstMedia = hasMedia ? post.media![0] : undefined;
            const postTypeLabel = post.postType
              ? POST_TYPE_LABEL[post.postType]
              : 'ไม่ระบุ';

            return (
              <div
                key={post.id}
                className="glass-panel rounded-xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 transition hover:border-white/12"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-20 h-20 rounded-xl border border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center relative">
                    {firstMedia ? (
                      <PostMediaPreview
                        media={firstMedia}
                        className="w-full h-full object-cover"
                      />
                    ) : post.status === 'generating' ? (
                      <GeneratingPlaceholder mediaType={post.mediaType} />
                    ) : (
                      <Building className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xxs font-extrabold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">
                        {postTypeLabel}
                      </span>
                      {getStatusBadge(post.status)}
                    </div>

                    <p className="text-xs text-foreground font-medium pr-4 leading-relaxed whitespace-pre-wrap">
                      {post.caption || (
                        <span className="text-muted-foreground italic">
                          AI กำลังสร้างแคปชั่น...
                        </span>
                      )}
                    </p>

                    {post.errorMessage && (
                      <p className="text-xxs text-red-500 bg-red-500/5 border border-red-500/20 rounded px-2 py-1 inline-block">
                        {post.errorMessage}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xxs text-muted-foreground flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {dateText}
                      </span>
                      {post.fbPostId && (
                        <a
                          href={`https://facebook.com/${post.fbPostId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-0.5 text-primary hover:underline font-bold"
                        >
                          เปิดลิงก์โพสต์จริง <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:self-center shrink-0">
                  {post.status === 'pending_approval' && (
                    <>
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
                        onClick={() => handleOpenEditModal(post)}
                        disabled={actionLoading !== null}
                        className="p-2 rounded-lg bg-secondary hover:bg-white/10 border border-border text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
                        title="แก้ไข (ยกเว้นรูปภาพ)"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(post.id)}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-xs font-bold text-white shadow shadow-primary/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading === post.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        อนุมัติยิงโพสต์
                      </button>
                    </>
                  )}

                  {['approved', 'failed', 'rejected', 'expired'].includes(post.status) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(post.id)}
                      disabled={actionLoading !== null}
                      className="p-2 rounded-lg bg-secondary hover:bg-red-500/10 border border-border hover:border-red-500/20 text-muted-foreground hover:text-red-500 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
                    >
                      <Trash2 className="w-4 h-4" />
                      ลบออก
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal — allows editing caption / scheduledAt / postType / services (NOT image) */}
      {editModalOpen && editingPost && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editLoading) {
              setEditModalOpen(false);
            }
          }}
        >
          <div className="max-w-xl w-full glass-panel glow-indigo rounded-2xl p-6 shadow-2xl animate-scale-up space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  แก้ไขโพสต์
                </h3>
                <p className="text-xs text-muted-foreground">
                  คุณสามารถแก้ไขข้อความ เวลาโพสต์ ประเภท และสินค้าที่แนะนำ (รูปภาพถูกล็อก)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={editLoading}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingPost.media && editingPost.media.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
                <PostMediaPreview
                  media={editingPost.media[0]}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    {editingPost.media[0].kind === 'short_video'
                      ? 'วิดีโอถูกสร้างโดย AI'
                      : 'รูปภาพถูกสร้างโดย AI'}
                  </p>
                  <p>ไม่สามารถเปลี่ยนสื่อได้ในเวอร์ชันนี้</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  ข้อความแคปชั่น
                </label>
                <textarea
                  rows={5}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  disabled={editLoading}
                  placeholder="ข้อความโพสต์..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  เวลาที่จะโพสต์
                </label>
                <input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  disabled={editLoading}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {editingPost.suggestedScheduledAt && (
                  <p className="text-xxs text-muted-foreground">
                    AI แนะนำ:{' '}
                    {new Date(editingPost.suggestedScheduledAt).toLocaleString(
                      'th-TH',
                      { dateStyle: 'short', timeStyle: 'short' },
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  ประเภทโพสต์
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      'promotion',
                      'product_showcase',
                      'brand_awareness',
                      'event',
                    ] as PostType[]
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={editLoading}
                      onClick={() => setEditPostType(t)}
                      className={`p-2 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                        editPostType === t
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {POST_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={editLoading}
                className="px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs font-bold text-white shadow-lg disabled:opacity-50 transition cursor-pointer"
              >
                {editLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPostId} onOpenChange={(open) => !open && setDeletingPostId(null)}>
        <DialogContent className="max-w-md w-full glass-panel glow-indigo rounded-2xl p-6 shadow-2xl animate-scale-up space-y-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold text-foreground">
              ยืนยันการลบโพสต์
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์รายการนี้ออกจากคิวงาน? หากลบโพสต์ที่อนุมัติแล้ว ระบบจะถอนโพสต์ออกจากตารางการเผยแพร่บน Facebook โดยอัตโนมัติ และการดำเนินการนี้จะไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingPostId(null)}
              className="cursor-pointer"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600 text-white border-transparent cursor-pointer"
            >
              ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GeneratingPlaceholder({ mediaType }: { mediaType?: PostMediaType }) {
  const isVideo = mediaType === 'short_video';
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-50 to-purple-50">
      {isVideo ? (
        <Video className="w-6 h-6 text-indigo-400 animate-pulse" />
      ) : (
        <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
      )}
      <span className="text-[10px] text-indigo-600 font-medium">
        {isVideo ? 'กำลังสร้างวิดีโอ…' : 'กำลังสร้างรูปภาพ…'}
      </span>
    </div>
  );
}
