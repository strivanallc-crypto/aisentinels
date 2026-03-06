import { Qualy } from './qualy';
import { Envi } from './envi';
import { Saffy } from './saffy';
import { Doki } from './doki';
import { Audie } from './audie';
import { Nexus } from './nexus';
import { Risko } from './risko';

// Named re-exports
export { Qualy, Envi, Saffy, Doki, Audie, Nexus, Risko };

// Dynamic lookup map — used by SentinelAvatar for SVG fallback
type SvgComponent = React.ComponentType<{ size?: number; className?: string }>;

export const SvgSentinels: Record<string, SvgComponent> = {
  qualy: Qualy,
  envi: Envi,
  saffy: Saffy,
  doki: Doki,
  audie: Audie,
  nexus: Nexus,
};
