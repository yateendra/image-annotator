import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  Circle,
  Clipboard,
  Copy,
  Download,
  Eraser,
  ImagePlus,
  Image as ImageIcon,
  Layers3,
  LineChart,
  MousePointer2,
  Move,
  Redo2,
  RotateCcw,
  ScanLine,
  Sparkles,
  Square,
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
  const [tool, setTool] = useState<Tool>("select");
  const [image, setImage] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [draft, setDraft] = useState<Mark | null>(null);
  const [history, setHistory] = useState<Mark[][]>([]);
  const [showLayers, setShowLayers] = useState(false);
  const [notice, setNotice] = useState("Ready to annotate");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [arrowWidth, setArrowWidth] = useState(3);
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>("solid");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pushMarks = useCallback((next: Mark[]) => {
    setHistory((prev) => [...prev.slice(-19), marks]);
    setMarks(next);
  }, [marks]);

  const loadFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
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
    const point = pointFromEvent(event);
    setDraft({ id: Date.now(), tool, x: point.x, y: point.y, x2: point.x, y2: point.y });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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
  const copyImage = async () => {
    if (!image) return;
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      setNotice("Image copied to clipboard");
    } catch {
      setNotice("Copy unavailable in this browser");
    }
    setContextMenu(null);
  };
  const downloadImage = () => {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `annotate-image-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    setNotice("Image download started");
    setContextMenu(null);
  };
  const duplicateImage = () => {
    if (!image) return;
    setImage(image);
    setNotice("Image duplicated");
    setContextMenu(null);
  };
  const removeImage = () => {
    setImage(null);
    setMarks([]);
    setHistory([]);
    setNotice("Image removed");
    setContextMenu(null);
  };

  const renderMark = (mark: Mark, isDraft = false) => {
    const x = Math.min(mark.x, mark.x2), y = Math.min(mark.y, mark.y2);
    const width = Math.abs(mark.x2 - mark.x), height = Math.abs(mark.y2 - mark.y);
    const stroke = isDraft ? "#7c8cff" : "#a7b4ff";
    const common = { vectorEffect: "non-scaling-stroke" as const, stroke, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const };
    if (mark.tool === "box") return <rect key={mark.id} x={`${x}%`} y={`${y}%`} width={`${width}%`} height={`${height}%`} rx="8" {...common} />;
    if (mark.tool === "oval") return <ellipse key={mark.id} cx={`${x + width / 2}%`} cy={`${y + height / 2}%`} rx={`${width / 2}%`} ry={`${height / 2}%`} {...common} />;
    if (mark.tool === "marker") return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} stroke="#f5c56d" strokeWidth="18" strokeOpacity=".28" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
    if (mark.tool === "arrow") return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} markerEnd="url(#arrowhead)" vectorEffect="non-scaling-stroke" stroke="#ff5364" strokeWidth={isDraft ? arrowWidth + 1 : arrowWidth} strokeDasharray={arrowStyle === "dashed" ? "10 7" : arrowStyle === "dotted" ? "2 7" : undefined} fill="none" strokeLinecap="round" />;
    return <line key={mark.id} x1={`${mark.x}%`} y1={`${mark.y}%`} x2={`${mark.x2}%`} y2={`${mark.y2}%`} {...common} />;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={15} strokeWidth={2.4} /></div>
          <div><div className="brand-name">Annotate</div><div className="brand-sub">visual workspace</div></div>
        </div>
        <div className="topbar-meta"><span className="live-dot" /> Local canvas <span className="meta-divider" /> {marks.length} {marks.length === 1 ? "mark" : "marks"}</div>
        <div className="top-actions">
          <button className="icon-button" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={16} /></button>
          <button className="icon-button" title="Redo" disabled><Redo2 size={16} /></button>
          <button className={`icon-button ${showLayers ? "active" : ""}`} title="Layers" onClick={() => setShowLayers((value) => !value)}><Layers3 size={16} /></button>
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
        <button className="canvas-mode"><ScanLine size={14} /> Fit canvas <ChevronDown size={13} /></button>
      </section>

      <div className="workspace">
        <div className="canvas-wrap" ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onContextMenu={(event) => { if (!image) return; event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }); }} onDoubleClick={() => !image && fileRef.current?.click()}>
          <div className={`canvas ${image ? "has-image" : ""}`}>
            {image ? <img className="source-image" src={image} alt="Uploaded annotation source" /> : <div className="empty-state"><div className="empty-icon"><ImageIcon size={22} /></div><h1>Paste an image to start</h1><p>Drop an image here or press <kbd>⌘ V</kbd> to paste from clipboard</p><button className="empty-cta" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choose image</button><div className="empty-hint">PNG, JPG or WebP · everything stays in your browser</div></div>}
            <svg className="marks-layer" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#ff5364" strokeWidth="1.4" /></marker></defs>{marks.map((mark) => renderMark(mark))}{draft && renderMark(draft, true)}</svg>
            {image && <div className="canvas-corners"><span /><span /><span /><span /></div>}
          </div>
          <div className="canvas-footer"><span><span className="status-dot" /> {notice}</span><span>Drag to draw · right-click for options</span><span>{image ? "1 image" : "0 images"} · {marks.length} {marks.length === 1 ? "mark" : "marks"}</span></div>
        </div>
        {contextMenu && <div className="context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 230), top: Math.min(contextMenu.y, window.innerHeight - 260) }} onClick={(event) => event.stopPropagation()}>
          <div className="context-menu-title"><span><ImageIcon size={14} /> Image actions</span><kbd>ESC</kbd></div>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={copyImage}><Clipboard size={15} /><span>Copy image</span><kbd>⌘ C</kbd></button>
          <button className="context-menu-item" onClick={downloadImage}><Download size={15} /><span>Download image</span><kbd>⌘ S</kbd></button>
          <button className="context-menu-item" onClick={duplicateImage}><ImagePlus size={15} /><span>Duplicate image</span></button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={removeImage}><Trash2 size={15} /><span>Remove image</span></button>
        </div>}
        {showLayers && <aside className="layers-panel"><div className="panel-heading"><span>Layers</span><button onClick={() => setShowLayers(false)}><X size={14} /></button></div><div className="layer-row"><ImageIcon size={15} /><span>{image ? "Source image" : "No image yet"}</span><span className="layer-muted">{image ? "visible" : "—"}</span></div>{marks.map((mark, index) => <div className="layer-row" key={mark.id}><span className="layer-index">{index + 1}</span><span>{mark.tool[0].toUpperCase() + mark.tool.slice(1)}</span><button className="layer-delete" onClick={() => removeMark(mark.id)}><Trash2 size={13} /></button></div>)}{!marks.length && <div className="panel-empty">Marks you draw will appear here.</div>}</aside>}
      </div>
      <footer className="statusbar"><div><span className="shortcut-pill"><Move size={12} /> Select & move</span><span className="shortcut-pill"><Copy size={12} /> Paste image</span></div><div className="status-center">{image ? <><Check size={13} /> Autosaved locally</> : "No document open"}</div><div className="made-by">Built for fast visual feedback <span>•</span> v1.0</div></footer>
    </main>
  );
}
