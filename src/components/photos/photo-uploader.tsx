"use client";

import { useCallback, useState } from "react";

interface UploadingFile {
  file: File;
  progress: "pending" | "uploading" | "done" | "error" | "duplicate";
  preview: string;
}

export function PhotoUploader({
  onUploadComplete,
}: {
  onUploadComplete?: () => void;
}) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((fileList: FileList) => {
    const imageFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );

    const newFiles: UploadingFile[] = imageFiles.map((file) => ({
      file,
      progress: "pending",
      preview: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading each file
    for (const uf of newFiles) {
      uploadFile(uf);
    }
  }, []);

  const uploadFile = async (uf: UploadingFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.file === uf.file ? { ...f, progress: "uploading" } : f))
    );

    const formData = new FormData();
    formData.append("file", uf.file);

    try {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (res.status === 409) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uf.file ? { ...f, progress: "duplicate" } : f
          )
        );
        return;
      }

      if (!res.ok) throw new Error("Upload failed");

      setFiles((prev) =>
        prev.map((f) => (f.file === uf.file ? { ...f, progress: "done" } : f))
      );
      onUploadComplete?.();
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.file === uf.file ? { ...f, progress: "error" } : f))
      );
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const completedCount = files.filter((f) => f.progress === "done").length;
  const totalCount = files.length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
          isDragging
            ? "border-white bg-neutral-800"
            : "border-neutral-700 hover:border-neutral-500"
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = "image/*";
          input.onchange = () => {
            if (input.files) addFiles(input.files);
          };
          input.click();
        }}
      >
        <svg
          className="mb-3 h-10 w-10 text-neutral-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-neutral-400">
          Arrastra fotos aquí o haz click para seleccionar
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          JPEG, PNG, WebP, AVIF, TIFF
        </p>
      </div>

      {/* Upload progress */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-400">
            {completedCount}/{totalCount} subidas
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {files.map((uf, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                <img
                  src={uf.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${
                    uf.progress === "uploading"
                      ? "bg-black/60"
                      : uf.progress === "done"
                        ? "bg-green-900/60"
                        : uf.progress === "error"
                          ? "bg-red-900/60"
                          : uf.progress === "duplicate"
                            ? "bg-yellow-900/60"
                            : "bg-black/40"
                  }`}
                >
                  {uf.progress === "uploading" && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {uf.progress === "done" && "✓"}
                  {uf.progress === "error" && "Error"}
                  {uf.progress === "duplicate" && "Dup"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
