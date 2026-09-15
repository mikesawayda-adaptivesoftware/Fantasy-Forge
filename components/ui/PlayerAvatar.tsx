'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getHeadshotUrl } from '@/lib/nfl';

const SIZES = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-32 h-32 text-3xl',
} as const;

interface PlayerAvatarProps {
  id: string;
  name: string;
  position?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Player headshot (or team logo for defenses) with an initials fallback */
export default function PlayerAvatar({ id, name, position, size = 'md', className = '' }: PlayerAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = getHeadshotUrl(id, position);
  const initials = name
    .replace(/ DEF$/, '')
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative rounded-full overflow-hidden bg-field-elevated flex-shrink-0 flex items-center justify-center ${SIZES[size]} ${className}`}>
      {failedSrc === src ? (
        <span className="font-semibold text-text-muted">{initials}</span>
      ) : (
        <Image src={src} alt={name} fill sizes="128px" className="object-cover" onError={() => setFailedSrc(src)} />
      )}
    </div>
  );
}
