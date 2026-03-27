# REMOTION_VISION — Project Vision Animation Generator

## Overview
Generate animated videos showcasing your project's vision, milestones, and achievements using Remotion.

## Prerequisites
- Remotion installed: `npm install remotion @remotion/cli @remotion/renderer`
- Project must have: product vision set, at least one milestone, sprint data

## Quick Start
1. Run the MCP tool: `generate_vision_animation`
2. This outputs `vision-data.json` with your project's stats
3. Render the video: `npx remotion render src/remotion/index.tsx VisionVideo --props=./vision-data.json --output=vision.mp4`

## What Gets Animated
- **Scene 1 (0-3s)**: Product name and vision text with typewriter effect
- **Scene 2 (3-6s)**: Milestone cards flying in with SHIPPED badges
- **Scene 3 (6-9s)**: Animated stats — sprints, tickets, points, agents counting up
- **Scene 4 (9-10s)**: Closing tagline

## Customization
- Edit compositions in `src/remotion/VisionVideo.tsx`
- Change colors, timing, or add new scenes
- Preview in browser: `npx remotion preview src/remotion/index.tsx`

## Output Formats
- MP4 (default): `--codec h264`
- GIF: `--codec gif --image-format png`
- WebM: `--codec vp8`

## Data Schema
The `vision-data.json` file contains:
- `productName`: Project name from package.json
- `vision`: Product vision text from skills table
- `milestones`: Array of {name, status} from milestones table
- `stats`: {sprints, tickets, points, agents} counts from database
