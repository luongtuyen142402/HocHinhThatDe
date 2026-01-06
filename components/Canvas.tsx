
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GeometryData, Point3D, Point2D, Edge, FreehandStroke } from '../types';
import { projectPoint, get2DCentroid, getLabelPosition, get3DCentroid } from '../utils/geometryUtils';
import { ZoomIn, ZoomOut, RotateCw, X, Palette, RotateCcw as ResetIcon, PenTool, Eraser, MousePointer2, Hand, Focus } from 'lucide-react';

interface CanvasProps {
  data: GeometryData | null;
  currentStepIndex: number;
  onDataUpdate: (newData: GeometryData) => void;
  onSpeak?: (text: string) => void;
}

const getPointOnVector = (start: Point3D, end: Point3D, distance: number): Point3D => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length === 0) return start;
  const ratio = distance / length;
  return {
    id: `temp_${Math.random()}`,
    x: start.x + dx * ratio,
    y: start.y + dy * ratio,
    z: start.z + dz * ratio
  };
};

const getMarkerPath = (type: string, p1: Point2D, p2: Point2D) => {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return '';
  const nx = -dy / len;
  const ny = dx / len;
  const size = 6;
  if (type === 'tick') return `M ${midX - nx*size} ${midY - ny*size} L ${midX + nx*size} ${midY + ny*size}`;
  if (type === 'double-tick') {
    const gap = 3;
    const m1x = midX - (dx/len)*gap; const m1y = midY - (dy/len)*gap;
    const m2x = midX + (dx/len)*gap; const m2y = midY + (dy/len)*gap;
    return `M ${m1x - nx*size} ${m1y - ny*size} L ${m1x + nx*size} ${m1y + ny*size} M ${m2x - nx*size} ${m2y - ny*size} L ${m2x + nx*size} ${m2y + ny*size}`;
  }
  return '';
};

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#cbd5e1'];

interface SelectedElement { id: string; type: 'point' | 'edge' | 'face' | 'circle'; }

const Canvas: React.FC<CanvasProps> = ({ data, currentStepIndex, onDataUpdate, onSpeak }) => {
  const [scale, setScale] = useState(30);
  const [angleX, setAngleX] = useState(15);
  const [angleY, setAngleY] = useState(30);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [labelOffsets, setLabelOffsets] = useState<Record<string, { dx: number, dy: number }>>({});
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingLabel, setIsDraggingLabel] = useState<string | null>(null);

  const lastPointerPos = useRef({ x: 0, y: 0 });
  const pointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const [currentStroke, setCurrentStroke] = useState<{x: number, y: number}[]>([]);
  const [drawingColor, setDrawingColor] = useState('#ef4444'); 

  useEffect(() => {
    const updateSize = () => { if (containerRef.current) setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => { resetView(); }, [data?.type]);

  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    if (data?.type === '2D') { setAngleX(0); setAngleY(0); setScale(30); }
    else { setAngleX(15); setAngleY(45); setScale(25); }
    setSelectedElements([]);
    setLabelOffsets({});
    setTimeout(centerView, 50);
  };

  const centerView = () => {
      if (!data || data.points.length === 0) return;
      const center3D = get3DCentroid(data.points);
      const proj = projectPoint(center3D, angleX, angleY, scale, dimensions.width, dimensions.height);
      setPanOffset({ x: dimensions.width / 2 - proj.x, y: dimensions.height / 2 - proj.y });
  };

  const projectedPoints = useMemo<Map<string, Point2D>>(() => {
    const map = new Map<string, Point2D>();
    if (!data) return map;
    data.points.forEach((p) => {
      const pt = projectPoint(p, angleX, angleY, scale, dimensions.width, dimensions.height);
      map.set(p.id, { x: pt.x + panOffset.x, y: pt.y + panOffset.y });
    });
    return map;
  }, [data, angleX, angleY, scale, dimensions, panOffset]);

  const geometryCentroid2D = useMemo(() => {
    return get2DCentroid(Array.from(projectedPoints.values()));
  }, [projectedPoints]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    // Check if clicking a label
    for (const p of data?.points || []) {
        const pt = projectedPoints.get(p.id);
        if (pt && p.label) {
            const offset = labelOffsets[p.id] || { dx: 0, dy: 0 };
            const basePos = getLabelPosition(pt, geometryCentroid2D, 22);
            const lx = basePos.x + offset.dx; const ly = basePos.y + offset.dy;
            if (Math.abs(x - lx) < 20 && Math.abs(y - ly) < 20) {
                setIsDraggingLabel(p.id);
                return;
            }
        }
    }

    if (!isDrawingMode && !isPanMode && pointersRef.current.size === 1) {
        for (const p of data?.points || []) {
            const pt = projectedPoints.get(p.id);
            if (pt && Math.abs(pt.x - x) < 15 && Math.abs(pt.y - y) < 15) {
                setSelectedElements([{ id: p.id, type: 'point' }]);
                if (onSpeak && p.label) onSpeak(`Điểm ${p.label}`);
                return;
            }
        }
    }

    if (isPanMode || pointersRef.current.size === 2) setIsPanning(true);
    else if (isDrawingMode) setCurrentStroke([{x, y}]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dx = e.clientX - lastPointerPos.current.x; const dy = e.clientY - lastPointerPos.current.y;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    if (isDraggingLabel) {
        setLabelOffsets(prev => ({ ...prev, [isDraggingLabel]: { dx: (prev[isDraggingLabel]?.dx || 0) + dx, dy: (prev[isDraggingLabel]?.dy || 0) + dy } }));
        return;
    }

    if (isPanning) setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    else if (isDrawingMode && currentStroke.length > 0) {
        const rect = containerRef.current!.getBoundingClientRect();
        setCurrentStroke(prev => [...prev, {x: e.clientX - rect.left, y: e.clientY - rect.top}]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (isDraggingLabel) {
        // Snap logic: if very close to original, clear offset
        const current = labelOffsets[isDraggingLabel];
        if (current && Math.hypot(current.dx, current.dy) < 5) {
            const newOffsets = { ...labelOffsets }; delete newOffsets[isDraggingLabel]; setLabelOffsets(newOffsets);
        }
        setIsDraggingLabel(null);
    }
    if (pointersRef.current.size === 0) setIsPanning(false);
    if (isDrawingMode && currentStroke.length > 0) {
        if (data) onDataUpdate({ ...data, drawings: [...(data.drawings || []), { id: Date.now().toString(), points: currentStroke, color: drawingColor, width: 2 }] });
        setCurrentStroke([]);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!data) return <div ref={containerRef} className="flex-1 h-full bg-slate-50 flex items-center justify-center text-slate-400 font-medium">📐 Nhập đề bài để bắt đầu học tập</div>;

  return (
    <div 
      ref={containerRef} 
      className={`flex-1 h-full bg-white relative overflow-hidden touch-none ${isDrawingMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
      onWheel={(e) => setScale(s => Math.min(Math.max(5, s * (1 - e.deltaY * 0.001)), 200))}
    >
      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
        {/* Render Faces (Polygons) */}
        {(data.faces || []).map((face) => {
           const pathData = (face.pointIds || []).map((pid, idx) => {
             const pt = projectedPoints.get(pid); return pt ? `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}` : '';
           }).join(' ') + ' Z';
           return <path key={face.id} d={pathData} fill={face.color || '#cbd5e1'} fillOpacity={face.opacity || 0.2} stroke="none" />;
        })}

        {/* Render Circles */}
        {(data.circles || []).map((circle) => {
          const center = projectedPoints.get(circle.centerId);
          if (!center) return null;
          const r = circle.radius * scale;
          return (
            <g key={circle.id}>
              <circle
                cx={center.x}
                cy={center.y}
                r={r}
                fill="none"
                stroke={circle.color || '#1e293b'}
                strokeWidth="1.8"
                strokeDasharray={circle.isDashed ? "5,5" : "none"}
                className="transition-all duration-300"
              />
              {circle.label && (
                <text x={center.x} y={center.y - r - 8} fontSize="11" fontWeight="600" textAnchor="middle" fill="#475569" style={{textShadow: '1px 1px 0 white'}}>
                  {circle.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render Angles */}
        {(data.angles || []).map((angle) => {
           const center = data.points.find(p => p.id === angle.centerId);
           const p1 = data.points.find(p => p.id === angle.arm1Id);
           const p2 = data.points.find(p => p.id === angle.arm2Id);
           if (!center || !p1 || !p2) return null;
           const sizeUnit = 0.3;
           const arm1Pt = getPointOnVector(center, p1, sizeUnit); 
           const arm2Pt = getPointOnVector(center, p2, sizeUnit);
           const cp = projectedPoints.get(center.id);
           const a1pRaw = projectPoint(arm1Pt, angleX, angleY, scale, dimensions.width, dimensions.height);
           const a2pRaw = projectPoint(arm2Pt, angleX, angleY, scale, dimensions.width, dimensions.height);
           const a1p = { x: a1pRaw.x + panOffset.x, y: a1pRaw.y + panOffset.y };
           const a2p = { x: a2pRaw.x + panOffset.x, y: a2pRaw.y + panOffset.y };
           if (!cp) return null;
           
           if (angle.type === 'right') {
               const corner = { x: a1p.x + (a2p.x - cp.x), y: a1p.y + (a2p.y - cp.y) };
               return <path key={angle.id} d={`M ${a1p.x} ${a1p.y} L ${corner.x} ${corner.y} L ${a2p.x} ${a2p.y}`} fill="none" stroke="#1e293b" strokeWidth="1.5" />;
           }
           return <path key={angle.id} d={`M ${a1p.x} ${a1p.y} Q ${(a1p.x+a2p.x)/2} ${(a1p.y+a2p.y)/2} ${a2p.x} ${a2p.y}`} fill="none" stroke="#1e293b" strokeWidth="1" />;
        })}

        {/* Render Edges */}
        {(data.edges || []).map((edge) => {
          const p1 = projectedPoints.get(edge.from); const p2 = projectedPoints.get(edge.to);
          if (!p1 || !p2) return null;
          return (
            <g key={edge.id}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={edge.color || '#1e293b'} strokeWidth="2" strokeLinecap="round" />
              {edge.marker && <path d={getMarkerPath(edge.marker, p1, p2)} stroke={edge.color || '#1e293b'} strokeWidth="2" fill="none" />}
            </g>
          );
        })}

        {/* Render Points and Draggable Labels */}
        {data.points.map((point) => {
          const pt = projectedPoints.get(point.id);
          if (!pt) return null;
          const isSelected = selectedElements.some(e => e.id === point.id);
          const offset = labelOffsets[point.id] || { dx: 0, dy: 0 };
          const baseLabelPos = getLabelPosition(pt, geometryCentroid2D, 22);
          
          return (
            <g key={point.id}>
              <circle cx={pt.x} cy={pt.y} r={isSelected ? 6 : 4} fill={isSelected ? '#3b82f6' : 'white'} stroke="#1e293b" strokeWidth="2" />
              {point.label && (
                <text 
                  x={baseLabelPos.x + offset.dx} 
                  y={baseLabelPos.y + offset.dy} 
                  className={`text-sm font-bold fill-slate-800 select-none ${isDraggingLabel === point.id ? 'fill-blue-600' : ''}`}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ pointerEvents: 'auto', cursor: 'move', textShadow: '1px 1px 0 white' }}
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render Freehand Drawings */}
        {(data.drawings || []).map(s => <polyline key={s.id} points={s.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />)}
        {currentStroke.length > 0 && <polyline points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={drawingColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>

      {/* Toolbar Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto">
        <button onClick={resetView} className="p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors" title="Về vị trí ban đầu"><ResetIcon size={24} /></button>
        <button onClick={() => setScale(s => Math.min(s * 1.2, 200))} className="p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors" title="Phóng to"><ZoomIn size={24} /></button>
        <button onClick={() => setScale(s => Math.max(s / 1.2, 5))} className="p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors" title="Thu nhỏ"><ZoomOut size={24} /></button>
        <div className="h-px bg-slate-200 my-1" />
        <button onClick={() => { setIsPanMode(!isPanMode); setIsDrawingMode(false); }} className={`p-3 rounded-full shadow-lg border transition-colors ${isPanMode ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-700'}`} title="Di chuyển hình"><Hand size={24} /></button>
        <button onClick={() => { setIsDrawingMode(!isDrawingMode); setIsPanMode(false); }} className={`p-3 rounded-full shadow-lg border transition-colors ${isDrawingMode ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-700'}`} title="Vẽ tự do"><PenTool size={24} /></button>
        {data.drawings && data.drawings.length > 0 && <button onClick={() => onDataUpdate({...data, drawings: []})} className="p-3 bg-white text-red-500 rounded-full shadow-lg border border-slate-200 hover:bg-red-50 transition-colors" title="Xóa hình vẽ tự do"><Eraser size={24} /></button>}
      </div>
      
      {data.type === '3D' && !isDrawingMode && (
          <div className="absolute bottom-4 right-4 flex gap-2">
              <button onClick={() => setAngleY(y => (y + 15) % 360)} className="p-2 bg-white rounded-lg shadow border text-slate-600 flex items-center gap-2 font-medium hover:bg-slate-50 transition-colors"><RotateCw size={20} /> Xoay 3D</button>
          </div>
      )}
    </div>
  );
};

export default Canvas;
