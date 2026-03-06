'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SENTINELS, type SentinelId } from '@/lib/sentinels';
import { SvgSentinels } from '@/components/sentinels';

interface SentinelAvatarProps {
  sentinelId: SentinelId;
  size?: number;
  ring?: boolean;
  pulse?: boolean;
  className?: string;
}

export function SentinelAvatar({
  sentinelId,
  size = 48,
  ring = false,
  pulse = false,
  className,
}: SentinelAvatarProps) {
  const sentinel = SENTINELS[sentinelId];
  const [imgError, setImgError] = useState(false);
  const SvgFallback = SvgSentinels[sentinelId];

  const usePng = sentinel.avatarPath && !imgError;
  const ringPad = ring ? 6 : 0;

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className ?? ''}`}
      style={{
        width: size + ringPad,
        height: size + ringPad,
        ...(ring
          ? { borderRadius: '50%', border: `2px solid ${sentinel.color}`, padding: 1 }
          : {}),
      }}
    >
      {usePng ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Image
            src={sentinel.avatarPath!}
            alt={`${sentinel.name} – ${sentinel.title}`}
            fill
            sizes={`${size}px`}
            className="object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : SvgFallback ? (
        <SvgFallback size={size} />
      ) : (
        /* Ultimate fallback: colored initial circle */
        <div
          className="flex items-center justify-center rounded-full text-white font-bold"
          style={{
            width: size,
            height: size,
            backgroundColor: sentinel.color,
            fontSize: size * 0.4,
          }}
        >
          {sentinel.initial}
        </div>
      )}

      {pulse && (
        <span
          className="absolute bottom-0 right-0 flex"
          style={{ width: size * 0.25, height: size * 0.25 }}
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: '#22C55E' }}
          />
          <span
            className="relative inline-flex h-full w-full rounded-full"
            style={{ background: '#22C55E' }}
          />
        </span>
      )}
    </div>
  );
}
