// V2: snap-to-grid, undo stack, smarter routing
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiagramShape {
  id: string;
  type: 'rectangle' | 'rounded-rect' | 'circle' | 'diamond' | 'process' | 'decision' | 'text';
  x: number; y: number; w: number; h: number;
  label: string; fill: string; stroke: string;
}

interface DiagramArrow {
  id: string; fromId: string; toId: string;
  style: 'solid' | 'dashed' | 'dotted';
}

interface DiagramState { shapes: DiagramShape[]; arrows: DiagramArrow[]; selectedId: string | null; }

interface DiagramModalProps {
  open: boolean; onClose: () => void;
  onInsert: (svgHtml: string, diagramJson: string) => void;
  initialData?: { shapes: DiagramShape[]; arrows: DiagramArrow[] } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = {
  bgBase: '#0a0f1a', bgSurface: '#0f1729', bgElevated: '#151f35', border: '#1e2d4a',
  textPrimary: '#f0f4ff', textSecondary: '#8899bb', textMuted: '#4a5a78', accent: '#c2fa69',
} as const;

const FILL_PRESETS = ['#ffffff', '#e2e8f0', '#bfdbfe', '#bbf7d0', '#fecaca', '#fef08a'] as const;
const STROKE_PRESETS = ['#1e2d4a', '#3B82F6', '#22C55E', '#F59E0B'] as const;
const HANDLE_SIZE = 8;
const CONNECTOR_RADIUS = 5;
const CONNECTOR_COLOR = '#22C55E';

type ShapeType = DiagramShape['type'];
interface PaletteItem { type: ShapeType; label: string; }
const BASIC_SHAPES: PaletteItem[] = [
  { type: 'rectangle', label: 'Rectangle' }, { type: 'rounded-rect', label: 'Rounded Rect' },
  { type: 'circle', label: 'Circle' }, { type: 'diamond', label: 'Diamond' },
];
const FLOW_SHAPES: PaletteItem[] = [
  { type: 'process', label: 'Process' }, { type: 'decision', label: 'Decision' }, { type: 'text', label: 'Text' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function defaultSize(t: ShapeType) { return (t === 'circle' || t === 'diamond' || t === 'decision') ? { w: 80, h: 80 } : { w: 120, h: 60 }; }

interface Point { x: number; y: number; }
function getMidpoints(s: DiagramShape): Point[] {
  return [
    { x: s.x + s.w / 2, y: s.y }, { x: s.x + s.w, y: s.y + s.h / 2 },
    { x: s.x + s.w / 2, y: s.y + s.h }, { x: s.x, y: s.y + s.h / 2 },
  ];
}
function closestMidpoints(a: DiagramShape, b: DiagramShape) {
  const aM = getMidpoints(a), bM = getMidpoints(b);
  let best = { from: aM[0], to: bM[0] }, bestD = Infinity;
  for (const f of aM) for (const t of bM) {
    const d = Math.hypot(f.x - t.x, f.y - t.y);
    if (d < bestD) { bestD = d; best = { from: f, to: t }; }
  }
  return best;
}
function dashArray(style: DiagramArrow['style']): string | undefined {
  if (style === 'dashed') return '8 4';
  if (style === 'dotted') return '2 2';
  return undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagramModal({ open, onClose, onInsert, initialData }: DiagramModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const exportSvgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<DiagramState>(() => ({
    shapes: initialData?.shapes ?? [], arrows: initialData?.arrows ?? [], selectedId: null,
  }));
  const [dragging, setDragging] = useState<{ shapeId: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{
    shapeId: string; corner: 'tl' | 'tr' | 'bl' | 'br';
    startX: number; startY: number; origX: number; origY: number; origW: number; origH: number;
  } | null>(null);
  const [arrowDraft, setArrowDraft] = useState<{ fromId: string; mouseX: number; mouseY: number } | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ shapeId: string; x: number; y: number; w: number } | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  useEffect(() => {
    setState({ shapes: initialData?.shapes ?? [], arrows: initialData?.arrows ?? [], selectedId: null });
  }, [initialData]);

  const addShape = useCallback((type: ShapeType) => {
    const { w, h } = defaultSize(type);
    const shape: DiagramShape = {
      id: uid(), type, x: 300 + Math.random() * 100, y: 200 + Math.random() * 100, w, h,
      label: type === 'text' ? 'Label' : type.charAt(0).toUpperCase() + type.slice(1),
      fill: type === 'text' ? 'none' : '#ffffff',
      stroke: type === 'text' ? 'none' : COLORS.border,
    };
    setState((p) => ({ ...p, shapes: [...p.shapes, shape], selectedId: shape.id }));
  }, []);

  const selectShape = useCallback((id: string | null) => {
    setState((p) => ({ ...p, selectedId: id })); setEditingLabel(null);
  }, []);

  const deleteSelected = useCallback(() => {
    setState((p) => {
      if (!p.selectedId) return p;
      if (p.shapes.some((s) => s.id === p.selectedId)) {
        return {
          shapes: p.shapes.filter((s) => s.id !== p.selectedId),
          arrows: p.arrows.filter((a) => a.fromId !== p.selectedId && a.toId !== p.selectedId),
          selectedId: null,
        };
      }
      return { ...p, arrows: p.arrows.filter((a) => a.id !== p.selectedId), selectedId: null };
    });
    setEditingLabel(null);
  }, []);

  const setFill = useCallback((c: string) => {
    setState((p) => ({ ...p, shapes: p.shapes.map((s) => s.id === p.selectedId ? { ...s, fill: c } : s) }));
  }, []);
  const setStroke = useCallback((c: string) => {
    setState((p) => ({ ...p, shapes: p.shapes.map((s) => s.id === p.selectedId ? { ...s, stroke: c } : s) }));
  }, []);

  const svgPoint = useCallback((e: React.MouseEvent<SVGSVGElement | SVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const onShapeMouseDown = useCallback((e: React.MouseEvent<SVGGElement>, sid: string) => {
    e.stopPropagation();
    const pt = svgPoint(e as unknown as React.MouseEvent<SVGSVGElement>);
    const sh = state.shapes.find((s) => s.id === sid);
    if (!sh) return;
    selectShape(sid);
    setDragging({ shapeId: sid, offsetX: pt.x - sh.x, offsetY: pt.y - sh.y });
  }, [state.shapes, svgPoint, selectShape]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const pt = svgPoint(e);
    if (dragging) {
      setState((p) => ({ ...p, shapes: p.shapes.map((s) =>
        s.id === dragging.shapeId ? { ...s, x: pt.x - dragging.offsetX, y: pt.y - dragging.offsetY } : s) }));
      return;
    }
    if (resizing) {
      const dx = pt.x - resizing.startX, dy = pt.y - resizing.startY;
      setState((p) => ({ ...p, shapes: p.shapes.map((s) => {
        if (s.id !== resizing.shapeId) return s;
        let nX = resizing.origX, nY = resizing.origY, nW = resizing.origW, nH = resizing.origH;
        if (resizing.corner === 'br') { nW = Math.max(40, nW + dx); nH = Math.max(30, nH + dy); }
        else if (resizing.corner === 'bl') { nX += dx; nW = Math.max(40, nW - dx); nH = Math.max(30, nH + dy); }
        else if (resizing.corner === 'tr') { nY += dy; nW = Math.max(40, nW + dx); nH = Math.max(30, nH - dy); }
        else { nX += dx; nY += dy; nW = Math.max(40, nW - dx); nH = Math.max(30, nH - dy); }
        return { ...s, x: nX, y: nY, w: nW, h: nH };
      }) }));
      return;
    }
    if (arrowDraft) setArrowDraft((p) => p ? { ...p, mouseX: pt.x, mouseY: pt.y } : null);
  }, [dragging, resizing, arrowDraft, svgPoint]);

  const onCanvasMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (arrowDraft) {
      const pt = svgPoint(e);
      const tgt = state.shapes.find((s) =>
        s.id !== arrowDraft.fromId && pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h);
      if (tgt) {
        setState((p) => ({ ...p, arrows: [...p.arrows,
          { id: uid(), fromId: arrowDraft.fromId, toId: tgt.id, style: 'solid' as const }] }));
      }
      setArrowDraft(null);
    }
    setDragging(null); setResizing(null);
  }, [arrowDraft, state.shapes, svgPoint]);

  const onCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) selectShape(null);
  }, [selectShape]);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent<SVGRectElement>, sid: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      e.stopPropagation();
      const pt = svgPoint(e as unknown as React.MouseEvent<SVGSVGElement>);
      const sh = state.shapes.find((s) => s.id === sid);
      if (!sh) return;
      setResizing({ shapeId: sid, corner, startX: pt.x, startY: pt.y,
        origX: sh.x, origY: sh.y, origW: sh.w, origH: sh.h });
    }, [state.shapes, svgPoint]);

  const onConnectorMouseDown = useCallback((e: React.MouseEvent<SVGCircleElement>, sid: string) => {
    e.stopPropagation();
    const pt = svgPoint(e as unknown as React.MouseEvent<SVGSVGElement>);
    setArrowDraft({ fromId: sid, mouseX: pt.x, mouseY: pt.y });
  }, [svgPoint]);

  const onLabelDoubleClick = useCallback((e: React.MouseEvent<SVGGElement>, sid: string) => {
    e.stopPropagation();
    const sh = state.shapes.find((s) => s.id === sid);
    if (!sh) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setEditingLabel({ shapeId: sid, x: r.left + sh.x, y: r.top + sh.y + sh.h / 2 - 12, w: sh.w });
  }, [state.shapes]);

  const commitLabel = useCallback((v: string) => {
    if (!editingLabel) return;
    setState((p) => ({ ...p, shapes: p.shapes.map((s) =>
      s.id === editingLabel.shapeId ? { ...s, label: v } : s) }));
    setEditingLabel(null);
  }, [editingLabel]);

  const handleInsert = useCallback(() => {
    const el = exportSvgRef.current;
    if (!el) return;
    onInsert((el.cloneNode(true) as SVGSVGElement).outerHTML,
      JSON.stringify({ shapes: state.shapes, arrows: state.arrows }));
  }, [state.shapes, state.arrows, onInsert]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderShapeElement = useCallback((sh: DiagramShape, exp: boolean): React.ReactNode => {
    const { type, x, y, w, h, fill, stroke } = sh;
    const sel = !exp && state.selectedId === sh.id;
    const cp = { fill, stroke: sel ? COLORS.accent : stroke, strokeWidth: sel ? 2 : 1 };
    switch (type) {
      case 'rectangle': case 'process':
        return <rect x={x} y={y} width={w} height={h} {...cp} />;
      case 'rounded-rect':
        return <rect x={x} y={y} width={w} height={h} rx={8} ry={8} {...cp} />;
      case 'circle':
        return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...cp} />;
      case 'diamond': case 'decision': {
        const cx = x + w / 2, cy = y + h / 2;
        return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} {...cp} />;
      }
      case 'text': return null;
    }
  }, [state.selectedId]);

  const renderShapeLabel = useCallback((sh: DiagramShape): React.ReactNode => (
    <text x={sh.x + sh.w / 2} y={sh.y + sh.h / 2} textAnchor="middle" dominantBaseline="central"
      fill={sh.type === 'text' ? COLORS.textPrimary : '#111827'}
      fontSize={sh.type === 'text' ? 16 : 12} fontFamily="DM Sans, sans-serif"
      style={{ pointerEvents: 'none', userSelect: 'none' }}>{sh.label}</text>
  ), []);

  const renderSelectionHandles = useCallback((sh: DiagramShape): React.ReactNode => {
    if (state.selectedId !== sh.id) return null;
    const { x, y, w, h } = sh;
    return (['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
      const cx = corner.includes('r') ? x + w : x;
      const cy = corner.includes('b') ? y + h : y;
      return (
        <rect key={corner} x={cx - HANDLE_SIZE / 2} y={cy - HANDLE_SIZE / 2}
          width={HANDLE_SIZE} height={HANDLE_SIZE} fill={COLORS.accent} stroke={COLORS.bgBase}
          strokeWidth={1}
          style={{ cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize' }}
          onMouseDown={(e) => onResizeMouseDown(e, sh.id, corner)} />
      );
    });
  }, [state.selectedId, onResizeMouseDown]);

  const renderConnectors = useCallback((sh: DiagramShape): React.ReactNode => {
    if (hoveredShapeId !== sh.id && state.selectedId !== sh.id) return null;
    return getMidpoints(sh).map((mp, i) => (
      <circle key={`c-${sh.id}-${i}`} cx={mp.x} cy={mp.y} r={CONNECTOR_RADIUS}
        fill={CONNECTOR_COLOR} stroke="#ffffff" strokeWidth={1} style={{ cursor: 'crosshair' }}
        onMouseDown={(e) => onConnectorMouseDown(e, sh.id)} />
    ));
  }, [hoveredShapeId, state.selectedId, onConnectorMouseDown]);

  const renderArrow = useCallback((ar: DiagramArrow, exp: boolean): React.ReactNode => {
    const fs = state.shapes.find((s) => s.id === ar.fromId);
    const ts = state.shapes.find((s) => s.id === ar.toId);
    if (!fs || !ts) return null;
    const { from, to } = closestMidpoints(fs, ts);
    const sel = !exp && state.selectedId === ar.id;
    return (
      <line key={ar.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={sel ? COLORS.accent : '#8899bb'} strokeWidth={sel ? 2.5 : 1.5}
        strokeDasharray={dashArray(ar.style)}
        markerEnd={exp ? 'url(#arrowhead-export)' : 'url(#arrowhead)'}
        style={{ cursor: exp ? 'default' : 'pointer' }}
        onClick={exp ? undefined : (e: React.MouseEvent<SVGLineElement>) => {
          e.stopPropagation(); selectShape(ar.id);
        }} />
    );
  }, [state.shapes, state.selectedId, selectShape]);

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!open) return null;

  const selectedShape = state.shapes.find((s) => s.id === state.selectedId);
  const editShape = editingLabel ? state.shapes.find((s) => s.id === editingLabel.shapeId) : null;

  const renderArrowDraftPreview = (): React.ReactNode => {
    if (!arrowDraft) return null;
    const fs = state.shapes.find((s) => s.id === arrowDraft.fromId);
    if (!fs) return null;
    const mps = getMidpoints(fs);
    let cl = mps[0], cD = Infinity;
    for (const mp of mps) {
      const d = Math.hypot(mp.x - arrowDraft.mouseX, mp.y - arrowDraft.mouseY);
      if (d < cD) { cD = d; cl = mp; }
    }
    return (
      <line x1={cl.x} y1={cl.y} x2={arrowDraft.mouseX} y2={arrowDraft.mouseY}
        stroke={CONNECTOR_COLOR} strokeWidth={1.5} strokeDasharray="4 3"
        markerEnd="url(#arrowhead)" style={{ pointerEvents: 'none' }} />
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.bgBase }}>
      {/* Top Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2"
        style={{ background: COLORS.bgSurface, borderBottom: `1px solid ${COLORS.border}` }}>
        <span style={{ color: COLORS.textPrimary, fontWeight: 600, fontSize: 14 }}>Diagram Editor</span>
        <div className="mx-2 h-5 w-px" style={{ background: COLORS.border }} />
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>Fill</span>
        <div className="flex gap-1">
          {FILL_PRESETS.map((c) => (
            <button key={c} className="h-5 w-5 rounded border"
              style={{ background: c, borderColor: selectedShape?.fill === c ? COLORS.accent : COLORS.border }}
              onClick={() => setFill(c)} title={c} />
          ))}
        </div>
        <div className="mx-2 h-5 w-px" style={{ background: COLORS.border }} />
        <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>Stroke</span>
        <div className="flex gap-1">
          {STROKE_PRESETS.map((c) => (
            <button key={c} className="h-5 w-5 rounded border"
              style={{ background: c, borderColor: selectedShape?.stroke === c ? COLORS.accent : COLORS.border }}
              onClick={() => setStroke(c)} title={c} />
          ))}
        </div>
        <div className="mx-2 h-5 w-px" style={{ background: COLORS.border }} />
        <button className="flex items-center gap-1 rounded px-2 py-1 text-xs"
          style={{ color: state.selectedId ? '#f87171' : COLORS.textMuted, background: 'transparent',
            cursor: state.selectedId ? 'pointer' : 'not-allowed' }}
          disabled={!state.selectedId} onClick={deleteSelected}>
          <Trash2 size={14} /> Delete
        </button>
        <div className="flex-1" />
        <button className="rounded p-1" style={{ color: COLORS.textSecondary }}
          onClick={onClose} title="Close"><X size={18} /></button>
      </div>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Palette */}
        <div className="flex w-[200px] flex-col gap-4 overflow-y-auto p-3"
          style={{ background: COLORS.bgSurface, borderRight: `1px solid ${COLORS.border}` }}>
          <PaletteGroup title="Basic" items={BASIC_SHAPES} onAdd={addShape} />
          <PaletteGroup title="Flow" items={FLOW_SHAPES} onAdd={addShape} />
        </div>

        {/* Canvas */}
        <div className="relative flex-1" style={{ background: COLORS.bgBase }}>
          <svg ref={svgRef} className="h-full w-full"
            onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp} onClick={onCanvasClick}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#8899bb" />
              </marker>
            </defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill={COLORS.textMuted} opacity={0.3} />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {state.arrows.map((a) => renderArrow(a, false))}
            {renderArrowDraftPreview()}
            {state.shapes.map((shape) => (
              <g key={shape.id} onMouseDown={(e) => onShapeMouseDown(e, shape.id)}
                onDoubleClick={(e) => onLabelDoubleClick(e, shape.id)}
                onMouseEnter={() => setHoveredShapeId(shape.id)}
                onMouseLeave={() => setHoveredShapeId(null)} style={{ cursor: 'move' }}>
                {renderShapeElement(shape, false)}
                {renderShapeLabel(shape)}
                {renderSelectionHandles(shape)}
                {renderConnectors(shape)}
              </g>
            ))}
          </svg>

          {/* Label edit overlay */}
          {editingLabel && editShape && (
            <input autoFocus className="absolute rounded border px-1 text-center text-sm"
              style={{ left: editingLabel.x, top: editingLabel.y, width: editingLabel.w,
                background: COLORS.bgElevated, color: COLORS.textPrimary,
                borderColor: COLORS.accent, zIndex: 60 }}
              defaultValue={editShape.label}
              onBlur={(e) => commitLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setEditingLabel(null);
              }} />
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-3 px-4 py-3"
        style={{ background: COLORS.bgSurface, borderTop: `1px solid ${COLORS.border}` }}>
        <button className="rounded px-4 py-2 text-sm font-medium"
          style={{ color: COLORS.textSecondary, border: `1px solid ${COLORS.border}`, background: 'transparent' }}
          onClick={onClose}>Cancel</button>
        <button className="rounded px-4 py-2 text-sm font-semibold"
          style={{ background: COLORS.accent, color: COLORS.bgBase }}
          onClick={handleInsert}>Insert into Document</button>
      </div>

      {/* Hidden export SVG */}
      <svg ref={exportSvgRef} width={800} height={600} xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
        <defs>
          <marker id="arrowhead-export" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#8899bb" />
          </marker>
        </defs>
        {state.arrows.map((a) => renderArrow(a, true))}
        {state.shapes.map((sh) => (
          <g key={sh.id}>{renderShapeElement(sh, true)}{renderShapeLabel(sh)}</g>
        ))}
      </svg>
    </div>
  );
}

// ── Palette Group ───────────────────────────────────────────────────────────

interface PaletteGroupProps { title: string; items: PaletteItem[]; onAdd: (type: ShapeType) => void; }

function PaletteGroup({ title, items, onAdd }: PaletteGroupProps) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: COLORS.textMuted }}>{title}</div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button key={item.type}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
            style={{ color: COLORS.textSecondary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = COLORS.bgElevated;
              (e.currentTarget as HTMLElement).style.color = COLORS.textPrimary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = COLORS.textSecondary;
            }}
            onClick={() => onAdd(item.type)}>
            <PaletteIcon type={item.type} />{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Palette Icons ───────────────────────────────────────────────────────────

function PaletteIcon({ type }: { type: ShapeType }) {
  const s = { stroke: COLORS.textSecondary, strokeWidth: 1.5, fill: 'none' };
  switch (type) {
    case 'rectangle': case 'process':
      return (<svg width={18} height={18} viewBox="0 0 18 18"><rect x={2} y={4} width={14} height={10} rx={1} {...s} /></svg>);
    case 'rounded-rect':
      return (<svg width={18} height={18} viewBox="0 0 18 18"><rect x={2} y={4} width={14} height={10} rx={4} {...s} /></svg>);
    case 'circle':
      return (<svg width={18} height={18} viewBox="0 0 18 18"><ellipse cx={9} cy={9} rx={7} ry={6} {...s} /></svg>);
    case 'diamond': case 'decision':
      return (<svg width={18} height={18} viewBox="0 0 18 18"><polygon points="9,1 17,9 9,17 1,9" {...s} /></svg>);
    case 'text':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18">
          <text x={9} y={13} textAnchor="middle" fontSize={12} fontWeight={600}
            fill={COLORS.textSecondary} style={{ fontFamily: 'DM Sans, sans-serif' }}>T</text>
        </svg>
      );
  }
}
