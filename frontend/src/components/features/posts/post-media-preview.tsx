'use client';

import { PostMedia } from '@/core/types/post';

interface PostMediaPreviewProps {
  media?: PostMedia;
  className?: string;
}

export function PostMediaPreview({ media, className }: PostMediaPreviewProps) {
  if (!media || !media.file?.publicUrl) return null;
  const url = media.file.publicUrl;
  const cls = className ?? 'w-full h-full object-cover';
  if (media.kind === 'short_video') {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        className={cls}
      />
    );
  }
  return <img src={url} alt="Post media" className={cls} />;
}
