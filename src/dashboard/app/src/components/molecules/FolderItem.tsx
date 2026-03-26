import React from 'react';
import { FileItem } from './FileItem';
import type { File, Directory } from '@/types';

interface FolderItemProps {
  dirPath: string;
  dirInfo: Directory;
  dirChildren: Map<string, string[]>;
  dirInfoMap: Map<string, Directory>;
  filesByDir: Map<string, File[]>;
  expandedFolders: Set<string>;
  selectedFileId: number | null;
  onToggle: (path: string) => void;
  onSelectFile: (id: number) => void;
  depth?: number;
}

export function FolderItem({
  dirPath,
  dirInfo,
  dirChildren,
  dirInfoMap,
  filesByDir,
  expandedFolders,
  selectedFileId,
  onToggle,
  onSelectFile,
  depth = 0,
}: FolderItemProps) {
  const isOpen = expandedFolders.has(dirPath);
  const childDirPaths = (dirChildren.get(dirPath) ?? []).slice().sort();
  const childFiles = (filesByDir.get(dirPath) ?? []).slice().sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="tree-folder" data-folder-path={dirPath}>
      <div
        className="tree-folder-head"
        onClick={() => onToggle(dirPath)}
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`chevron${isOpen ? ' open' : ''}`}
          style={{ width: 14, height: 14, flexShrink: 0, transition: 'transform .2s', color: isOpen ? 'var(--accent)' : 'var(--text3)', transform: isOpen ? 'rotate(90deg)' : undefined }}
        >
          <path d="M6 3l5 5-5 5z" />
        </svg>
        <span className="folder-icon">📁</span>
        <span className="folder-name">{dirInfo.name}</span>
        <span className="folder-count">{dirInfo.file_count}</span>
      </div>

      {isOpen && (
        <div className="tree-children">
          {childDirPaths.map((childPath) => {
            const childInfo = dirInfoMap.get(childPath);
            if (!childInfo) return null;
            return (
              <FolderItem
                key={childPath}
                dirPath={childPath}
                dirInfo={childInfo}
                dirChildren={dirChildren}
                dirInfoMap={dirInfoMap}
                filesByDir={filesByDir}
                expandedFolders={expandedFolders}
                selectedFileId={selectedFileId}
                onToggle={onToggle}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            );
          })}
          {childFiles.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              isActive={file.id === selectedFileId}
              onClick={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
