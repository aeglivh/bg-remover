import { useState, useRef, useCallback, useEffect } from "react";

export default function BackgroundRemover() {
  const [original, setOriginal] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState("result");
  const [editing, setEditing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [brushMode, setBrushMode] = useState("erase"); // "erase" or "restore"
  const fileRef = useRef();
  const removeLib = useRef(null);
  const canvasRef = useRef();
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    import("@imgly/background-removal")
      .then((mod) => { removeLib.current = mod.removeBackground; })
      .catch((e) => console.warn("Preload failed, will retry:", e));
  }, []);

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    setError("");
    setResult(null);
    setEditing(false);
    const url = URL.createObjectURL(file);
    setOriginal({ file, url, name: file.name });
  }, []);

  const onFileChange = (e) => processFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const removeBackground = async () => {
    if (!original) return setError("Please upload an image first.");
    setLoading(true);
    setError("");
    setLoadingMsg("Loading AI model...");

    try {
      if (!removeLib.current) {
        const mod = await import("@imgly/background-removal");
        removeLib.current = mod.removeBackground;
      }
      setLoadingMsg("Removing background...");
      const blob = await removeLib.current(original.file, {
        model: "isnet",
        output: { format: "image/png" },
        proxyToWorker: false,
        progress: (key, current, total) => {
          setLoadingMsg(`${key} ${Math.round((current / total) * 100)}%`);
        },
      });
      const resultUrl = URL.createObjectURL(blob);
      setResult({ url: resultUrl, blob });
      setPreview("result");
    } catch (err) {
      setError(`Error: ${err?.message || err}`);
      console.error("BG removal error:", err);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Initialize canvas for editing
  const startEditing = () => {
    setEditing(true);
    setPreview("result");
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = result.url;
  };

  useEffect(() => {
    if (editing && result && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = result.url;
    }
  }, [editing, result]);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const drawBrush = (from, to) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const size = brushSize * scale;

    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (brushMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      // Restore mode: draw original image through a clipping path
      ctx.globalCompositeOperation = "source-over";
    }

    if (brushMode === "erase") {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else {
      // For restore: stamp original image pixels back
      const origImg = new Image();
      origImg.src = result.url;
      // We need to draw from the original result, so use a temp approach
      ctx.save();
      ctx.beginPath();
      ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(origImg, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getCanvasPos(e);
    lastPos.current = pos;
    // Draw a dot at the start position
    drawBrush(pos, pos);
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const pos = getCanvasPos(e);
    drawBrush(lastPos.current, pos);
    lastPos.current = pos;
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  };

  const saveEdits = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setResult({ url, blob });
      setEditing(false);
    }, "image/png");
  };

  const cancelEdits = () => {
    setEditing(false);
  };

  const download = () => {
    if (!result) return;
    if (editing && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        const a = document.createElement("a");
        const baseName = original.name.replace(/\.[^.]+$/, "");
        a.href = URL.createObjectURL(blob);
        a.download = `${baseName}-no-bg.png`;
        a.click();
      }, "image/png");
    } else {
      const a = document.createElement("a");
      const baseName = original.name.replace(/\.[^.]+$/, "");
      a.href = result.url;
      a.download = `${baseName}-no-bg.png`;
      a.click();
    }
  };

  const reset = () => {
    setOriginal(null);
    setResult(null);
    setError("");
    setPreview("result");
    setEditing(false);
  };

  const checkerBg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='10' height='10' fill='%23f3f4f6'/%3E%3Crect x='10' y='10' width='10' height='10' fill='%23f3f4f6'/%3E%3Crect x='10' width='10' height='10' fill='%23e5e7eb'/%3E%3Crect y='10' width='10' height='10' fill='%23e5e7eb'/%3E%3C/svg%3E\")";

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">BG Remover</h1>
          <p className="text-xs text-gray-400 mt-0.5">Free AI background removal · runs in your browser</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full font-medium">
          Private & free
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {!original && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
            }`}
          >
            <div className="text-4xl mb-4">🖼️</div>
            <p className="text-gray-700 font-medium">Drag & drop an image here</p>
            <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            <p className="text-gray-300 text-xs mt-4">JPG, PNG, WebP · processed locally in your browser</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          </div>
        )}

        {original && (
          <div className="space-y-6">
            {/* View toggle */}
            {result && !editing && (
              <div className="flex items-center justify-center gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit mx-auto shadow-sm">
                {["original", "result"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setPreview(v)}
                    className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                      preview === v ? "bg-indigo-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {v === "result" ? "Removed" : "Original"}
                  </button>
                ))}
              </div>
            )}

            {/* Brush toolbar */}
            {editing && (
              <div className="flex items-center justify-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-2.5 w-fit mx-auto shadow-sm">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBrushMode("erase")}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      brushMode === "erase" ? "bg-red-500 text-white" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Eraser
                  </button>
                  <button
                    onClick={() => setBrushMode("restore")}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      brushMode === "restore" ? "bg-green-500 text-white" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Restore
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Size</span>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-24 accent-indigo-500"
                  />
                  <span className="text-xs text-gray-500 w-6">{brushSize}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={cancelEdits}
                    className="px-3 py-1 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdits}
                    className="px-3 py-1 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Image / Canvas display */}
            <div
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center min-h-80 p-6"
              style={{
                backgroundImage: (preview === "result" && result) || editing ? checkerBg : "none",
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">{loadingMsg}</p>
                </div>
              ) : editing ? (
                <canvas
                  ref={canvasRef}
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                  className="max-h-[500px] max-w-full object-contain rounded-lg"
                  style={{ cursor: "crosshair", touchAction: "none" }}
                />
              ) : (
                <img
                  src={preview === "result" && result ? result.url : original.url}
                  alt="Preview"
                  className="max-h-[500px] max-w-full object-contain rounded-lg"
                />
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Actions */}
            {!editing && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                >
                  Upload new image
                </button>
                {result && (
                  <button
                    onClick={startEditing}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                  >
                    Clean up
                  </button>
                )}
                {result ? (
                  <button
                    onClick={download}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-sm"
                  >
                    Download PNG
                  </button>
                ) : (
                  <button
                    onClick={removeBackground}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Remove Background
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!original && error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}

        <p className="text-center text-gray-300 text-xs mt-12">
          Images never leave your device. Powered by IMG.LY background-removal.
        </p>
      </main>
    </div>
  );
}
