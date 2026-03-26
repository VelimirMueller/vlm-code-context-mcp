import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML entities first to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (triple backtick) — before inline code
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\n/, '');
    return `<pre style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow-x:auto;font-family:var(--mono);font-size:12px;color:var(--text2);margin:8px 0;"><code>${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-family:var(--mono);font-size:12px;color:var(--accent2);">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:var(--text);margin:16px 0 6px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;color:var(--text);margin:20px 0 8px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;color:var(--text);margin:24px 0 10px;">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);font-weight:600;">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links — sanitize href to only allow http/https
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => {
    const safeHref = /^https?:\/\//.test(href) ? href : '#';
    return `<a href="${safeHref}" style="color:var(--accent2);text-decoration:none;" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border2);margin:16px 0;" />');

  // Unordered lists
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map((line) => {
      const text = line.replace(/^[-*] /, '');
      return `<li style="margin:3px 0;">${text}</li>`;
    }).join('');
    return `<ul style="list-style:disc;padding-left:20px;margin:8px 0;">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map((line) => {
      const text = line.replace(/^\d+\. /, '');
      return `<li style="margin:3px 0;">${text}</li>`;
    }).join('');
    return `<ol style="list-style:decimal;padding-left:20px;margin:8px 0;">${items}</ol>`;
  });

  // Paragraphs
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const isHtmlBlock = /^<(h[1-6]|ul|ol|pre|hr|p)/.test(line.trim());
    if (isHtmlBlock) {
      result.push(line);
    } else {
      result.push(`<p style="margin:6px 0;color:var(--text2);line-height:1.7;">${line}</p>`);
    }
  }

  return result.join('\n');
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const html = renderMarkdown(content);
  // Content is server-controlled markdown; HTML entities are escaped before processing
  // eslint-disable-next-line react/no-danger
  return (
    <div
      className={`md-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
