// Shared appearance presets and CSS var writers, used by Settings' Appearance
// section (v1, local-only) — the only UI for this; the old Debug Style tab
// was removed in favor of Settings.
export const STORAGE_KEY = 'myfinance-debug-style-v2';

export const radiusPresets = [
  { id: 'sharp', label: 'Sharp', value: '6px' },
  { id: 'default', label: 'Default (current)', value: '8px' },
  { id: 'round', label: 'Round', value: '12px' },
  { id: 'pill', label: 'Pill', value: '20px' }
];

export const accentPresets = [
  {
    id: 'neutral', label: 'Neutral (current)', solid: '#7c8ba6', accent: 'rgba(203, 209, 224, 0.92)',
    soft: 'rgba(124, 139, 166, 0.16)', panel: 'rgba(69, 77, 97, 0.28)',
    ring: 'rgba(255, 255, 255, 0.04)', glowSoft: 'rgba(0, 0, 0, 0)', depth: 'rgba(0, 0, 0, 0)',
    ringH: 'rgba(255, 255, 255, 0.08)', glowSoftH: 'rgba(0, 0, 0, 0)', depthH: 'rgba(0, 0, 0, 0)'
  },
  {
    id: 'purple', label: 'Purple', solid: '#c084fc', accent: 'rgba(216, 180, 254, 0.92)',
    soft: 'rgba(168, 85, 247, 0.18)', panel: 'rgba(88, 28, 135, 0.3)',
    ring: 'rgba(190, 140, 255, 0.18)', glowSoft: 'rgba(168, 85, 247, 0.22)', depth: 'rgba(124, 58, 237, 0.14)',
    ringH: 'rgba(216, 180, 254, 0.28)', glowSoftH: 'rgba(192, 132, 252, 0.28)', depthH: 'rgba(147, 51, 234, 0.18)'
  },
  {
    id: 'blue', label: 'Blue', solid: '#60a5fa', accent: 'rgba(147, 197, 253, 0.92)',
    soft: 'rgba(59, 130, 246, 0.18)', panel: 'rgba(30, 58, 138, 0.3)',
    ring: 'rgba(96, 165, 250, 0.18)', glowSoft: 'rgba(59, 130, 246, 0.22)', depth: 'rgba(37, 99, 235, 0.14)',
    ringH: 'rgba(147, 197, 253, 0.28)', glowSoftH: 'rgba(96, 165, 250, 0.28)', depthH: 'rgba(37, 99, 235, 0.18)'
  },
  {
    id: 'green', label: 'Green', solid: '#34d399', accent: 'rgba(167, 243, 208, 0.92)',
    soft: 'rgba(16, 185, 129, 0.18)', panel: 'rgba(6, 78, 59, 0.3)',
    ring: 'rgba(52, 211, 153, 0.18)', glowSoft: 'rgba(16, 185, 129, 0.22)', depth: 'rgba(5, 150, 105, 0.14)',
    ringH: 'rgba(167, 243, 208, 0.28)', glowSoftH: 'rgba(52, 211, 153, 0.28)', depthH: 'rgba(5, 150, 105, 0.18)'
  },
  {
    id: 'amber', label: 'Amber', solid: '#fbbf24', accent: 'rgba(253, 224, 71, 0.92)',
    soft: 'rgba(245, 158, 11, 0.18)', panel: 'rgba(120, 53, 15, 0.3)',
    ring: 'rgba(251, 191, 36, 0.18)', glowSoft: 'rgba(245, 158, 11, 0.22)', depth: 'rgba(217, 119, 6, 0.14)',
    ringH: 'rgba(253, 224, 71, 0.28)', glowSoftH: 'rgba(251, 191, 36, 0.28)', depthH: 'rgba(217, 119, 6, 0.18)'
  },
  {
    id: 'teal', label: 'Teal', solid: '#2dd4bf', accent: 'rgba(153, 246, 228, 0.92)',
    soft: 'rgba(20, 184, 166, 0.18)', panel: 'rgba(19, 78, 74, 0.3)',
    ring: 'rgba(45, 212, 191, 0.18)', glowSoft: 'rgba(20, 184, 166, 0.22)', depth: 'rgba(15, 118, 110, 0.14)',
    ringH: 'rgba(153, 246, 228, 0.28)', glowSoftH: 'rgba(45, 212, 191, 0.28)', depthH: 'rgba(15, 118, 110, 0.18)'
  },
  {
    id: 'red', label: 'Red', solid: '#fb7185', accent: 'rgba(254, 205, 211, 0.92)',
    soft: 'rgba(244, 63, 94, 0.18)', panel: 'rgba(136, 19, 55, 0.3)',
    ring: 'rgba(251, 113, 133, 0.18)', glowSoft: 'rgba(244, 63, 94, 0.22)', depth: 'rgba(190, 18, 60, 0.14)',
    ringH: 'rgba(254, 205, 211, 0.28)', glowSoftH: 'rgba(251, 113, 133, 0.28)', depthH: 'rgba(190, 18, 60, 0.18)'
  },
  {
    id: 'indigo', label: 'Indigo', solid: '#818cf8', accent: 'rgba(199, 210, 254, 0.92)',
    soft: 'rgba(99, 102, 241, 0.18)', panel: 'rgba(49, 46, 129, 0.3)',
    ring: 'rgba(129, 140, 248, 0.18)', glowSoft: 'rgba(99, 102, 241, 0.22)', depth: 'rgba(67, 56, 202, 0.14)',
    ringH: 'rgba(199, 210, 254, 0.28)', glowSoftH: 'rgba(129, 140, 248, 0.28)', depthH: 'rgba(67, 56, 202, 0.18)'
  }
];

export const sidebarPresets = [
  { id: 'compact', label: 'Compact', value: '220px' },
  { id: 'default', label: 'Default (current)', value: '248px' },
  { id: 'wide', label: 'Wide', value: '288px' }
];

export const motionPresets = [
  { id: 'none', label: 'None', value: '0ms' },
  { id: 'fast', label: 'Fast', value: '90ms' },
  { id: 'default', label: 'Default (current)', value: '150ms' },
  { id: 'relaxed', label: 'Relaxed', value: '280ms' }
];

export const defaultAppearance = {
  radiusId: 'default', accentId: 'neutral', sidebarId: 'default', motionId: 'default'
};

function root() {
  return document.documentElement.style;
}

export function applyRadius(id) { root().setProperty('--radius', (radiusPresets.find((p) => p.id === id) || radiusPresets[1]).value); }

export function applyAccent(id) {
  const p = accentPresets.find((x) => x.id === id) || accentPresets[0];
  const s = root();
  s.setProperty('--accent-solid', p.solid);
  s.setProperty('--accent', p.accent);
  s.setProperty('--accent-soft', p.soft);
  s.setProperty('--accent-panel', p.panel);
  s.setProperty('--glow-ring', p.ring);
  s.setProperty('--glow-soft', p.glowSoft);
  s.setProperty('--glow-depth', p.depth);
  s.setProperty('--glow-ring-h', p.ringH);
  s.setProperty('--glow-soft-h', p.glowSoftH);
  s.setProperty('--glow-depth-h', p.depthH);
}

export function applySidebar(id) { root().setProperty('--sidebar-width', (sidebarPresets.find((p) => p.id === id) || sidebarPresets[1]).value); }
export function applyMotion(id) { root().setProperty('--motion-duration', (motionPresets.find((p) => p.id === id) || motionPresets[2]).value); }

export function applyAppearance(state) {
  if (!state) return;
  applyRadius(state.radiusId);
  applyAccent(state.accentId);
  applySidebar(state.sidebarId);
  applyMotion(state.motionId);
}

export function loadAppearance() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveAppearance(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
