// src/app/(dashboard)/posts/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
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
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useBusinessStore } from '@/hooks/store/use-business-store';
import { postService } from '@/core/services/post-service';
import { Post, PostStatus } from '@/core/types/post';
import { toast } from 'sonner';

type FilterStatus = 'all' | 'pending' | 'scheduled' | 'posted' | 'failed_rejected';

export default function PostsPage() {
  const { activeBusiness } = useBusinessStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filtering & Search
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  
  // Edit caption modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const activeBusinessId = activeBusiness?.id;

  const loadPosts = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      const data = await postService.getPosts({ businessId: activeBusinessId });
      setPosts(data);
    } catch (err) {
      toast.error('ไม่สามารถโหลดตารางแผนงานโพสต์ได้');
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
      toast.success('อนุมัติเผยแพร่โพสต์สำเร็จ! ระบบจะทำการยิงไปเพจเฟซบุ๊กตามเวลาตารางงาน');
      await loadPosts();
    } catch (err) {
      toast.error('ไม่สามารถกดอนุมัติโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('คุณแน่ใจว่าต้องการปฏิเสธคำแนะนำโพสต์นี้ของ AI ใช่หรือไม่?')) return;
    setActionLoading(id);
    try {
      await postService.rejectPost(id, 'user_rejected');
      toast.success('ปฏิเสธโพสต์เรียบร้อยแล้ว');
      await loadPosts();
    } catch (err) {
      toast.error('ไม่สามารถดำเนินการปฏิเสธโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบโพสต์รายการนี้ออกจากคิวใช่หรือไม่?')) return;
    setActionLoading(id);
    try {
      await postService.deletePost(id);
      toast.success('ลบโพสต์ออกจากตารางเวลาสำเร็จ');
      setPosts(posts.filter((p) => p.id !== id));
    } catch (err) {
      toast.error('ไม่สามารถลบโพสต์ได้');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditModal = (post: Post) => {
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setEditLoading(true);
    try {
      // ยิงแก้ไข caption ไปหลังบ้าน
      const response = await postService.deletePost(editingPost.id); // ดึง mockup หรือ delete ชั่วคราว แต่ใน API patch คือ PATCH /posts/:id
      // เนื่องจากเราสร้างฟังก์ชัน update โพสต์ในหลังบ้าน (@Patch(':id')) เรามาต่อ API PATCH
      // ยิง API PATCH ตรงผ่าน apiClient
      const { default: apiClient } = await import('@/core/services/api-client');
      const res = await apiClient.patch<{ post: Post }>(`/posts/${editingPost.id}`, {
        caption: editCaption,
      });
      toast.success('ปรับปรุงข้อความโพสต์เรียบร้อยแล้ว');
      setPosts(posts.map((p) => (p.id === editingPost.id ? res.data.post : p)));
      setEditModalOpen(false);
    } catch (err) {
      toast.error('ไม่สามารถแก้ไขข้อความโพสต์ได้');
    } finally {
      setEditLoading(false);
    }
  };

  // กรองตามหมวดหมู่แท็บสถานะ
  const filteredPosts = posts.filter((post) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return post.status === 'pending_approval';
    if (activeFilter === 'scheduled') return post.status === 'approved';
    if (activeFilter === 'posted') return post.status === 'posted';
    if (activeFilter === 'failed_rejected') return post.status === 'failed' || post.status === 'rejected' || post.status === 'expired';
    return true;
  });

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
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
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Calendar className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ห้องทำงาน AI โพสต์</h1>
          <p className="text-sm text-muted-foreground">ปฏิทินแผนงานคอนเทนต์และเครื่องมือจัดการดูแลโพสต์ทั้งหมดของแบรนด์</p>
        </div>
      </div>

      {/* Filter Tabs Menu */}
      <div className="flex border-b border-border gap-1 overflow-x-auto pb-px">
        {(
          [
            { key: 'all', l: 'ทั้งหมด (All)' },
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

      {/* List Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">กำลังโหลดรายการแผนงานโพสต์ของคุณ...</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="glass-panel rounded-xl p-16 flex flex-col items-center justify-center text-center gap-3 max-w-lg mx-auto">
          <Building className="w-12 h-12 text-muted-foreground animate-pulse" />
          <span className="text-sm font-bold text-foreground">ไม่พบรายการโพสต์ในหมวดหมู่นี้</span>
          <p className="text-xs text-muted-foreground leading-normal max-w-sm">
            AI กำลังวิเคราะห์ข้อมูลและวางแผนตารางเวลาทำงานให้แบรนด์ของคุณตามแผนงานการตลาด
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const dateText = post.scheduledAt 
              ? new Date(post.scheduledAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
              : 'ไม่ได้กำหนดเวลา';
            const hasMedia = post.media && post.media.length > 0;
            const mediaUrl = hasMedia ? post.media![0].file.publicUrl : null;

            return (
              <div 
                key={post.id} 
                className="glass-panel rounded-xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 transition hover:border-white/12"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Post Media Preview */}
                  <div className="w-20 h-20 rounded-xl border border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center relative">
                    {mediaUrl ? (
                      <img src={mediaUrl} alt="Media" className="w-full h-full object-cover" />
                    ) : (
                      <Building className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
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
                      {getStatusBadge(post.status)}
                    </div>

                    <p className="text-xs text-foreground font-medium pr-4 leading-relaxed whitespace-pre-wrap">
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

                    <div className="flex items-center gap-4 text-xxs text-muted-foreground flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        กำหนดเผยแพร่: {dateText}
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

                {/* Controller Action buttons */}
                <div className="flex items-center gap-2 md:self-center shrink-0">
                  {post.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => handleReject(post.id)}
                        disabled={actionLoading !== null}
                        className="p-2 rounded-lg bg-secondary hover:bg-red-500/10 border border-border hover:border-red-500/20 text-muted-foreground hover:text-red-500 transition cursor-pointer disabled:opacity-50"
                        title="ปฏิเสธโพสต์"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(post)}
                        disabled={actionLoading !== null}
                        className="p-2 rounded-lg bg-secondary hover:bg-white/10 border border-border text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
                        title="แก้ไข Caption"
                      >
                        <Edit3 className="w-4.5 h-4.5" />
                      </button>
                      <button
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

                  {/* ลบโพสต์ออกจากคิวสำหรับโพสต์ที่ล้มเหลว หรือแบบร่าง */}
                  {(post.status === 'failed' || post.status === 'rejected' || post.status === 'expired' || post.status === 'draft') && (
                    <button
                      onClick={() => handleDelete(post.id)}
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

      {/* Edit Caption Dialog Modal */}
      {editModalOpen && editingPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full glass-panel glow-indigo rounded-2xl p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground">แก้ไขข้อความโพสต์ของ AI</h3>
                <p className="text-xs text-muted-foreground">ปรับคำอธิบายคำโฆษณาเพื่อให้เหมาะกับแบรนด์ของคุณที่สุด</p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditModalOpen(false)} 
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">ข้อความแคปชั่นโฆษณา</label>
                <textarea
                  rows={8}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="ป้อนคำโฆษณาตรงนี้..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
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
        </div>
      )}
    </div>
  );
}
