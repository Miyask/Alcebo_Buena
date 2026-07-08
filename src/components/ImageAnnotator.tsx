import React, { useState, useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  type: 'pencil' | 'arrow' | 'circle' | 'text' | 'line';
  points: Point[];
  color: string;
  size: number;
  text?: string;
}

interface ImageAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedBase64: string) => void;
  onClose: () => void;
}

export default function ImageAnnotator({ imageUrl, onSave, onClose }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drawing configurations
  const [tool, setTool] = useState<Shape['type']>('pencil');
  const [color, setColor] = useState<string>('#009FE3'); // Default Alcebo Blue
  const [size, setSize] = useState<number>(4);
  const [textInput] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1.0);
  
  // Undo/redo and shapes state
  const [shapes, setShapes] = useState<Shape[]>([]);
  
  // Refs to avoid heavy React state updates on every mouseMove (60 FPS drawing)
  const currentPointsRef = useRef<Point[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  
  // Image element ref to redraw
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Load image on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Avoid tainted canvas
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      adjustCanvasSize(img);
    };
  }, [imageUrl]);

  const adjustCanvasSize = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    // Use full image size for crisp rendering, scaled in view by CSS/max-width
    const maxWidth = Math.max(img.naturalWidth || 800, 800);
    const maxHeight = Math.max(img.naturalHeight || 600, 600);
    
    canvas.width = maxWidth;
    canvas.height = maxHeight;

    drawAll();
  };

  // Redraw image and all shapes
  const drawAll = (previewPoints?: Point[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw saved shapes
    shapes.forEach(shape => {
      drawShape(ctx, shape);
    });

    // Draw current preview shape if drawing and points are available
    if (previewPoints && previewPoints.length > 0) {
      const tempShape: Shape = {
        id: 'preview',
        type: tool,
        points: previewPoints,
        color,
        size,
        text: tool === 'text' ? textInput : undefined
      };
      drawShape(ctx, tempShape);
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (shape.points.length === 0) return;

    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    if (shape.type === 'pencil') {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.stroke();
    } else if (shape.type === 'line' && shape.points.length >= 2) {
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
      ctx.stroke();
    } else if (shape.type === 'circle' && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'arrow' && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      
      // Draw main shaft
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrow head
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.max(12, shape.size * 3);
      
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === 'text') {
      const start = shape.points[0];
      ctx.font = `bold ${Math.max(16, shape.size * 4)}px sans-serif`;
      ctx.textBaseline = 'middle';
      
      if (shape.text) {
        const metrics = ctx.measureText(shape.text);
        const bgPadding = 6;
        ctx.fillStyle = 'rgba(26, 26, 26, 0.85)';
        ctx.fillRect(
          start.x - bgPadding, 
          start.y - Math.max(16, shape.size * 4) / 2 - bgPadding, 
          metrics.width + bgPadding * 2, 
          Math.max(16, shape.size * 4) + bgPadding * 2
        );
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(shape.text, start.x, start.y);
      }
    }
  };

  // Redraw when shapes array changes (e.g. undo, clear)
  useEffect(() => {
    if (imageLoaded) {
      drawAll();
    }
  }, [shapes, imageLoaded]);

  // Helper to get coordinates, accounting for canvas dimensions and CSS scale zoom
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert screen coordinates back to logical canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    isDrawingRef.current = true;
    currentPointsRef.current = [coords];
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const prevPoints = currentPointsRef.current;
    if (tool === 'pencil') {
      const prevCoords = prevPoints[prevPoints.length - 1];
      prevPoints.push(coords);
      
      // Direct draw to canvas without React render cycles (60+ FPS performance)
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(prevCoords.x, prevCoords.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      }
    } else {
      // Shape preview - clear and redraw canvas with temporary preview coords
      currentPointsRef.current = [prevPoints[0], coords];
      drawAll(currentPointsRef.current);
    }
  };

  const handleEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const finalPoints = currentPointsRef.current;
    if (finalPoints.length > 0) {
      if (tool === 'text') {
        const textValue = prompt('Introduce el texto para la etiqueta:') || '';
        if (textValue.trim()) {
          const newShape: Shape = {
            id: 'shape_' + Date.now(),
            type: 'text',
            points: [finalPoints[0]],
            color,
            size,
            text: textValue,
          };
          setShapes((prev) => [...prev, newShape]);
        } else {
          drawAll();
        }
      } else {
        const newShape: Shape = {
          id: 'shape_' + Date.now(),
          type: tool,
          points: [...finalPoints],
          color,
          size,
        };
        setShapes((prev) => [...prev, newShape]);
      }
    }
    currentPointsRef.current = [];
  };

  const handleUndo = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm('¿Deseas eliminar todas las anotaciones de este dibujo?')) {
      setShapes([]);
    }
  };

  const handleSaveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#009FE3] text-2xl">gesture</span>
            <div>
              <h3 className="font-bold text-sm tracking-wide uppercase">Editor de Planos y Croquis Alcebo</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Dibuja flechas, marcas o escribe anotaciones técnicas directamente sobre la foto de campo.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-all cursor-pointer w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center border border-slate-800"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Drawing Tools Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-3xs">
            {[
              { id: 'pencil', label: 'Lápiz', icon: 'edit' },
              { id: 'arrow', label: 'Flecha', icon: 'trending_flat' },
              { id: 'circle', label: 'Círculo', icon: 'radio_button_unchecked' },
              { id: 'line', label: 'Línea', icon: 'horizontal_rule' },
              { id: 'text', label: 'Texto', icon: 'title' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as Shape['type'])}
                title={t.label}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  tool === t.id 
                    ? 'bg-[#009FE3] text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Color Picker Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden md:inline">Color:</span>
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {[
                { hex: '#009FE3', name: 'Azul Alcebo' },
                { hex: '#EF4444', name: 'Rojo Peligro' },
                { hex: '#22C55E', name: 'Verde OK' },
                { hex: '#F59E0B', name: 'Naranja Cota' },
                { hex: '#FFEC3D', name: 'Amarillo' },
                { hex: '#1A1A1A', name: 'Negro' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className="w-6 h-6 rounded-md border transition-all cursor-pointer relative flex items-center justify-center"
                  style={{ 
                    backgroundColor: c.hex,
                    borderColor: color === c.hex ? '#1A1A1A' : 'transparent',
                    borderWidth: color === c.hex ? '2px' : '1px'
                  }}
                >
                  {color === c.hex && (
                    <span className="material-symbols-outlined text-white text-[11px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-3xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 ml-1.5 hidden md:inline">Lupa:</span>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.4))}
              title="Alejar Imagen (Zoom Out)"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg">zoom_out</span>
            </button>
            <span className="text-xs font-mono font-bold text-slate-600 px-2 select-none min-w-[45px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.2, 3.0))}
              title="Acercar Imagen (Zoom In)"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg">zoom_in</span>
            </button>
            {zoom !== 1.0 && (
              <button
                onClick={() => setZoom(1.0)}
                title="Restablecer Lupa a 100%"
                className="p-1 px-2 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer ml-1"
              >
                100%
              </button>
            )}
          </div>

          {/* Line Weight Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grosor:</span>
            <input 
              type="range" 
              min="2" 
              max="12" 
              value={size} 
              onChange={(e) => setSize(parseInt(e.target.value, 10))}
              className="w-16 sm:w-24 accent-[#009FE3] cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-slate-600">{size}px</span>
          </div>

          {/* History Management */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-3xs">
            <button
              onClick={handleUndo}
              disabled={shapes.length === 0}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                shapes.length > 0
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Deshacer"
            >
              <span className="material-symbols-outlined text-lg">undo</span>
            </button>
            <button
              onClick={handleClear}
              disabled={shapes.length === 0}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                shapes.length > 0
                  ? 'text-rose-600 hover:bg-rose-50'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Limpiar Todo"
            >
              <span className="material-symbols-outlined text-lg">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div 
          ref={containerRef}
          className="bg-slate-800 flex-1 p-6 flex items-center justify-center overflow-auto min-h-[380px] relative border-y border-slate-700"
        >
          {!imageLoaded && (
            <div className="text-center text-white space-y-3">
              <div className="w-10 h-10 border-4 border-t-white border-slate-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400">Cargando lienzo de imagen técnica...</p>
            </div>
          )}
          
          {/* Scrollable, Zoomable Wrapper */}
          <div 
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: 'center center',
              transition: 'transform 0.1s ease-out'
            }}
            className="flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              className={`bg-white rounded-2xl shadow-2xl max-w-none ${
                tool === 'text' ? 'cursor-text' : 'cursor-crosshair'
              } select-none`}
              style={{ 
                display: imageLoaded ? 'block' : 'none',
                maxWidth: '100%', 
                height: 'auto' 
              }}
            />
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200/80 flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-4 py-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSaveCanvas}
            className="bg-[#009FE3] hover:bg-[#006491] text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-[#009fe3]/15 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            Aplicar y Sellar Anotaciones
          </button>
        </div>
      </div>
    </div>
  );
}
