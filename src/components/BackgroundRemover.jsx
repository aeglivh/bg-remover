import { useState, useRef, useCallback, useEffect } from "react";

export default function BackgroundRemover() {
  const [original, setOriginal] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState("result");
  const fileRef = useRef();
  const removeLib = useRef(null);

  // Preload the library + model in the background on mount
  useEffect(() => {
    import("@imgly/background-removal").then((mod) => {
      removeLib.current = mod.removeBackground;
    }).catch(() => {
      // will retry on first use
    });
  }, []);

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    setError("");
    setResult(null);
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
    setLoadingMsg("Loading AI model (first run may take ~10s)...");

    try {
      if (!removeLib.current) {
        const mod = await import("@imgly/background-removal");
        removeLib.current = mod.removeBackground;
      }

      setLoadingMsg("Removing background...");

      const blob = await removeLib.current(original.file, {
        model: "isnet_fp16",
        output: { format: "image/png", type: "foreground" },
      });

      const resultUrl = URL.createObjectURL(blob);
      setResult({ url: resultUrl, blob });
      setPreview("result");
    } catch (err) {
      setError("Something went wrong. Try a different image or refresh the page.");
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    const baseName = original.name.replace(/\.[^.]+$/, "");
    a.href = result.url;
    a.download = `${baseName}-no-bg.png`;
    a.click();
  };

  const reset = () => {
    setOriginal(null);
    setResult(null);
    setError("");
    setPreview("result");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">BG Remover</h1>
          <p className="text-xs text-gray-400 mt-0.5">100% free · runs in your browser · no uploads</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full font-medium">
          Private & free
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Upload Zone */}
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

        {/* Preview Area */}
        {original && (
          <div className="space-y-6">
            {/* Toggle */}
            {result && (
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

            {/* Image Display */}
            <div
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center min-h-80 p-6"
              style={{
                backgroundImage:
                  preview === "result" && result
                    ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='10' height='10' fill='%23f3f4f6'/%3E%3Crect x='10' y='10' width='10' height='10' fill='%23f3f4f6'/%3E%3Crect x='10' width='10' height='10' fill='%23e5e7eb'/%3E%3Crect y='10' width='10' height='10' fill='%23e5e7eb'/%3E%3C/svg%3E\")"
                    : "none",
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">{loadingMsg}</p>
                </div>
              ) : (
                <img
                  src={preview === "result" && result ? result.url : original.url}
                  alt="Preview"
                  className="max-h-[500px] max-w-full object-contain rounded-lg"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-all"
              >
                Upload new image
              </button>
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
          </div>
        )}

        {!original && error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}

        {/* Footer */}
        <p className="text-center text-gray-300 text-xs mt-12">
          Images never leave your device. Powered by IMG.LY background-removal.
        </p>
      </main>
    </div>
  );
}
