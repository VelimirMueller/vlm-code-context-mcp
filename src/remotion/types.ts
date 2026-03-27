export interface VisionProps {
  productName: string;
  vision: string;
  milestones: { name: string; status: string }[];
  stats: { sprints: number; tickets: number; points: number; agents: number };
}
