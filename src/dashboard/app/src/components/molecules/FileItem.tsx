import React from 'react';
import { Dot } from '@/components/atoms/Dot';
import { langColors, fmtSize } from '@/lib/utils';
import type { File } from '@/types';

interface FileItemProps {
  file: File;
  isActive: boolean;
  onClick: (id: number) => void;
}

export function FileItem({ file, isActive, onClick }: FileItemProps) {
  const color = langColors[file.language] ?? langColors.unknown;
  const name = file.path.split('/').pop() ?? file.path;

  return (
    <div
      className={`file-item${isActive ? ' active' : ''}`}
      onClick={() => onClick(file.id)}
      title={file.path}
    >
      <Dot color={color} />
      <span className="file-name">{name}</span>
      <span className="file-size">{fmtSize(file.size_bytes)}</span>
    </div>
  );
}
