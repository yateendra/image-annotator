import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Check,
  Circle,
  Clipboard,
  Copy,
  Download,
  Eraser,
  Image as ImageIcon,
  Layers3,
  LineChart,
  MousePointer2,
  Move,
  Moon,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";

type Tool = "select" | "arrow" | "line" | "box" | "oval" | "marker";
type Mark = {
  id: number;
  tool: Exclude<Tool, "select">;
  x: number;
  y: number;
  x2: number;
  y2: number;
  arrowWidth?: number;
  arrowStyle?: ArrowStyle;
};
type ContextMenu = { x: number; y: number };
type ArrowStyle = "solid" | "dashed" | "dotted";

const toolItems: { id: Tool; label: string; shortcut: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "arrow", label: "Arrow", shortcut: "A", icon: ArrowUpRight },
  { id: "line", label: "Line", shortcut: "L", icon: LineChart },
  { id: "box", label: "Box", shortcut: "B", icon: Square },
  { id: "oval", label: "Oval", shortcut: "O", icon: Circle },
  { id: "marker", label: "Marker", shortcut: "M", icon: WandSparkles },
];

export default function Home() {
  const [tool, setTool] = useState<Tool>(() => (localStorage.getItem("annotate:last-tool") as Tool) || "select");
  const [image, setImage] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [draft, setDraft] = useState<Mark | null>(null);
  const [history, setHistory] = useState<Mark[][]>([]);
  const [showLayers, setShowLayers] = useState(false);
  const [notice, setNotice] = useState("Ready to annotate");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [arrowWidth, setArrowWidth] = useState(() => Number(localStorage.getItem("annotate:arrow-width")) || 3);
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>(() => (localStorage.getItem("annotate:arrow-style") as ArrowStyle) || "solid");
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("annotate:theme") as "dark" | "light") || "dark");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("annotate:last-tool", tool);
    localStorage.setItem("annotate:arrow-width", String(arrowWidth));
    localStorage.setItem("annotate:arrow-style", arrowStyle);
    localStorage.setItem("annotate:theme", theme);
  }, [tool, arrowWidth, arrowStyle, theme]);

  const pushMarks = useCallback((next: Mark[]) => {
    setHistory((prev) => [...prev.slice(-19), marks]);
    setMarks(next);
  }, [marks]);

  const loadFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setMarks([]);
      setHistory([]);
      setNotice("Image loaded · ready to annotate");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) loadFile(file);
    };
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const found = toolItems.find((item) => item.shortcut.toLowerCase() === key);
      if (found && !event.metaKey && !event.ctrlKey) setTool(found.id);
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.metaKey || event.ctrlKey) && key === "o") {
        event.preventDefault();
        fileRef.current?.click();
      }
      if ((event.metaKey || event.ctrlKey) && key === "c" && image) {
        event.preventDefault();
        copyImage();
      }
      if ((event.metaKey || event.ctrlKey) && key === "s" && image) {
        event.preventDefault();
        downloadImage();
      }
      if (key === "escape") {
        setDraft(null);
        setContextMenu(null);
      }
    };
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", closeMenu);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", closeMenu);
    };
  });

  const pointFromEvent = (event: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!image || tool === "select") return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    setDraft({ id: Date.now(), tool, x: point.x, y: point.y, x2: point.x, y2: point.y, arrowWidth: tool === "arrow" ? arrowWidth : undefined, arrowStyle: tool === "arrow" ? arrowStyle : undefined });
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* Synthetic or unsupported pointer events can omit capture. */ }
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!draft) return;
    const point = pointFromEvent(event);
    setDraft({ ...draft, x2: point.x, y2: point.y });
  };
  const onPointerUp = () => {
    if (!draft) return;
    const dx = Math.abs(draft.x2 - draft.x);
    const dy = Math.abs(draft.y2 - draft.y);
    if (dx > 1 || dy > 1) pushMarks([...marks, draft]);
    setDraft(null);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setMarks(previous);
    setHistory((items) => items.slice(0, -1));
    setNotice("Last mark undone");
  };
  const clearAll = () => {
    if (!marks.length) return;
    pushMarks([]);
    setNotice("Annotations cleared");
  };
  const removeMark = (id: number) => pushMarks(marks.filter((mark) => mark.id !== id));
  const renderAnnotatedImage = async () => {
    if (!image) return null;
    const source = new Image();
    source.src = image;
    await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error("Unable to load image")); });
    const visibleCanvas = canvasRef.current;
    const sourceElement = visibleCanvas?.querySelector(".source-image") as HTMLImageElement | null;
    const canvasRect = visibleCanvas?.getBoundingClientRect();
    const imageRect = sourceElement?.getBoundingClientRect();
    if (!canvasRect || !imageRect) return null;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = source.naturalWidth;
    exportCanvas.height = source.naturalHeight;
    const context = exportCanvas.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0, source.naturalWidth, source.naturalHeight);
    const scaleX = source.naturalWidth / imageRect.width;
    const scaleY = source.naturalHeight / imageRect.height;
    const point = (x: number, y: number) => ({ x: ((x / 100) * canvasRect.width + canvasRect.left - imageRect.left) * scaleX, y: ((y / 100) * canvasRect.height + canvasRect.top - imageRect.top) * scaleY });
    const markScale = (scaleX + scaleY) / 2;
    context.save();
    context.beginPath();
    context.rect(0, 0, exportCanvas.width, exportCanvas.height);
    context.clip();
    marks.forEach((mark) => {
      const start = point(mark.x, mark.y);
      const end = point(mark.x2, mark.y2);
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = mark.tool === "arrow" ? "#ff5364" : mark.tool === "marker" ? "#f5c56d" : "#a7b4ff";
      context.lineWidth = mark.tool === "arrow" ? (mark.arrowWidth ?? arrowWidth) * markScale : mark.tool === "marker" ? 18 * markScale : 2.2 * markScale;
      const markArrowStyle = mark.arrowStyle ?? arrowStyle;
      if (mark.tool === "arrow" && markArrowStyle !== "solid") context.setLineDash(markArrowStyle === "dashed" ? [10 * markScale, 7 * markScale] : [2 * markScale, 7 * markScale]);
      if (mark.tool === "marker") context.globalAlpha = 0.28;
      context.beginPath();
      if (mark.tool === "box") context.rect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      else if (mark.tool === "oval") context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
      else { context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); }
      context.stroke();
      if (mark.tool === "arrow") {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const head = 13 * markScale;
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
        context.stroke();
      }
      context.restore();
    });
    context.restore();
    return await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, "image/png"));
  };
  const copyImage = async () => {
    if (!image) return;
    try {
      const blob = await renderAnnotatedImage();
      if (!blob) throw new Error("Unable to render image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setNotice(marks.length ? "Image and annotations copied" : "Image copied to clipboard");
    } catch {
      setNotice("Copy unavailable in this browser");
    }
    setContextMenu(null);
  };
  const downloadImage = () => {
    if (!image) return;
    renderAnnotatedImage().then((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `annotate-image-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setNotice(marks.length ? "Image and annotations download started" : "Image download started");
      setContextMenu(null);
    }).catch(() => setNotice("Download unavailable in this browser"));
  };
  const removeImage = () => {
    setImage(null);
    setMarks([]);
    setHistory([]);
    setNotice("Image removed");
    setContextMenu(null);
  };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    loadFile(Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")));
  };

  const renderMark = (mark: Mark, isDraft = false) => {
    const x = Math.min(mark.x, mark.x2), y = Math.min(mark.y, mark.y2);
    const width = Math.abs(mark.x2 - mark.x), height = Math.abs(mark.y2 - mark.y);
    const stroke = isDraft ? "#7c8cff" : "#a7b4ff";
    const common = { vectorEffect: "non-scaling-stroke" as const, stroke, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const };
    if (mark.tool === "box") return <rect key={mark.id} x={`${x}%`} y={`${y}%`} width={`${width}%`} height={`${height}%`} rx="8" {...common} />;
    if (mark.tool === "oval") return <ellipse key={mark.id} cx={`${x + width / 2}%`} cy={`${y + height / 2}%`} rx={`${width / 2}%`} ry={`${height / 2}%`} {...common} />;
    if (mark.tool === "marker") return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} stroke="#f5c56d" strokeWidth="18" strokeOpacity=".28" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
    if (mark.tool === "arrow") { const markArrowWidth = mark.arrowWidth ?? arrowWidth; const markArrowStyle = mark.arrowStyle ?? arrowStyle; return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} markerEnd="url(#arrowhead)" vectorEffect="non-scaling-stroke" stroke="#ff5364" strokeWidth={isDraft ? markArrowWidth + 1 : markArrowWidth} strokeDasharray={markArrowStyle === "dashed" ? "10 7" : markArrowStyle === "dotted" ? "2 7" : undefined} fill="none" strokeLinecap="round" />; }
    return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} {...common} />;
  };

  return (
    <main className={`app-shell ${theme === "light" ? "light-mode" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={15} strokeWidth={2.4} /></div>
          <div><div className="brand-name">Annotate</div><div className="brand-sub">visual workspace</div></div>
        </div>
        <div className="topbar-meta"><span className="live-dot" /> Local canvas <span className="meta-divider" /> {marks.length} {marks.length === 1 ? "mark" : "marks"}</div>
        <div className="top-actions">
          <button className="icon-button" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={16} /></button>
          <button className={`icon-button ${showLayers ? "active" : ""}`} title="Layers" onClick={() => setShowLayers((value) => !value)}><Layers3 size={16} /></button>
          <button className="icon-button" title={theme === "dark" ? "Switch to day mode" : "Switch to night mode"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button className="upload-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import <span className="kbd">⌘O</span></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
        </div>
      </header>

      <section className="toolstrip">
        <div className="tool-group">
          {toolItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={`tool-button ${tool === item.id ? "selected" : ""}`} onClick={() => setTool(item.id)} title={`${item.label} (${item.shortcut})`}><Icon size={15} /><span>{item.label}</span><kbd>{item.shortcut}</kbd></button>; })}
        </div>
        <div className="tool-divider" />
        <button className="clear-button" onClick={clearAll}><Eraser size={15} /> Clear</button>
        {tool === "arrow" && <div className="arrow-settings" aria-label="Arrow settings">
          <span className="settings-label">Arrow</span>
          <div className="settings-pills">
            {[2, 3, 5, 8].map((width) => <button key={width} className={`setting-pill width-pill ${arrowWidth === width ? "selected" : ""}`} onClick={() => setArrowWidth(width)} title={`${width}px arrow`}><span style={{ width: Math.min(width * 2.2, 16), height: width, background: "currentColor" }} /></button>)}
            <span className="settings-separator" />
            {(["solid", "dashed", "dotted"] as ArrowStyle[]).map((style) => <button key={style} className={`setting-pill style-pill ${arrowStyle === style ? "selected" : ""}`} onClick={() => setArrowStyle(style)} title={`${style} arrow`}><span className={`line-preview ${style}`} /></button>)}
          </div>
        </div>}
        <div className="tool-spacer" />
      </section>

      <div className="workspace">
        <div className="canvas-wrap" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDraft(null)} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onDoubleClick={() => !image && fileRef.current?.click()}>
          <div className={`canvas ${image ? "has-image" : ""}`} ref={canvasRef} onContextMenu={(event) => { if (!image) return; event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }); }}>
            {image ? <img className="source-image" draggable={false} onDragStart={(event) => event.preventDefault()} src={image} alt="Uploaded annotation source" /> : <div className="empty-state"><div className="empty-icon"><ImageIcon size={22} /></div><h1>Paste an image to start</h1><p>Drop an image here or press <kbd>⌘ V</kbd> to paste from clipboard</p><button className="empty-cta" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choose image</button><div className="empty-hint">PNG, JPG or WebP · everything stays in your browser</div></div>}
            <svg className="marks-layer" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#ff5364" strokeWidth="1.4" /></marker></defs>{marks.map((mark) => renderMark(mark))}{draft && renderMark(draft, true)}</svg>
            {image && <div className="canvas-corners"><span /><span /><span /><span /></div>}
          </div>
          <div className="canvas-footer"><span><span className="status-dot" /> {notice}</span><span>Drag to draw · right-click for options</span><span>{image ? "1 image" : "0 images"} · {marks.length} {marks.length === 1 ? "mark" : "marks"}</span></div>
        </div>
        {contextMenu && <div className="context-menu" style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 230)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 260)) }} onClick={(event) => event.stopPropagation()}>
          <div className="context-menu-title"><span><ImageIcon size={14} /> Image actions</span><kbd>ESC</kbd></div>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={copyImage}><Clipboard size={15} /><span>Copy with annotations</span><kbd>⌘ C</kbd></button>
          <button className="context-menu-item" onClick={downloadImage}><Download size={15} /><span>Download with annotations</span><kbd>⌘ S</kbd></button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={removeImage}><Trash2 size={15} /><span>Remove image</span></button>
        </div>}
        {showLayers && <aside className="layers-panel"><div className="panel-heading"><span>Layers</span><button onClick={() => setShowLayers(false)}><X size={14} /></button></div><div className="layer-row"><ImageIcon size={15} /><span>{image ? "Source image" : "No image yet"}</span><span className="layer-muted">{image ? "visible" : "—"}</span></div>{marks.map((mark, index) => <div className="layer-row" key={mark.id}><span className="layer-index">{index + 1}</span><span>{mark.tool[0].toUpperCase() + mark.tool.slice(1)}</span><button className="layer-delete" onClick={() => removeMark(mark.id)}><Trash2 size={13} /></button></div>)}{!marks.length && <div className="panel-empty">Marks you draw will appear here.</div>}</aside>}
      </div>
      <footer className="statusbar"><div><span className="shortcut-pill"><Move size={12} /> Select & move</span><span className="shortcut-pill"><Copy size={12} /> Paste image</span></div><div className="status-center">{image ? <><Check size={13} /> Autosaved locally</> : "No document open"}</div><div className="made-by">Built for fast visual feedback <span>•</span> v1.0</div></footer>
    </main>
  );
}
