import React from 'react';
import { Composition } from 'remotion';
import { VisionVideo } from './VisionVideo.js';
import type { VisionProps } from './types.js';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VisionVideo"
        component={VisionVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          productName: 'vlm-code-context-mcp',
          vision: 'AI-powered virtual IT department via MCP',
          milestones: [
            { name: 'M1 — Foundation', status: 'completed' },
            { name: 'M2 — Scale', status: 'completed' },
            { name: 'M3 — Platform', status: 'completed' },
            { name: 'M11 — Linear Integration', status: 'completed' },
          ],
          stats: { sprints: 40, tickets: 316, points: 500, agents: 16 },
        } satisfies VisionProps}
      />
    </>
  );
};
