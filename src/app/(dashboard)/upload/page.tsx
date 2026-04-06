"use client";

import { PhotoUploader } from "@/components/photos/photo-uploader";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subir fotos</h1>
      </div>
      <PhotoUploader
        onUploadComplete={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
