const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image } from "@/components/ui/image";
import { toast } from "sonner";

const ROTATIONS = ["-2.5deg", "1.8deg", "-1.2deg", "2.4deg", "-3deg", "1deg"];

export default function ScrapbookTab({ room, memories }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!file) {
      toast.error("Pick a photo first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Give this memory a title.");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      await db.entities.Memory.create({
        room_id: room.id,
        title: title.trim(),
        memory_date: date,
        caption: caption.trim() || null,
        image_url: file_url,
      });
      setTitle("");
      setCaption("");
      setFile(null);
      toast.success("Memory added to the scrapbook");
    } catch {
      toast.error("Upload failed. Try a smaller photo?");
    } finally {
      setUploading(false);
    }
  }

  async function remove(m) {
    await db.entities.Memory.delete(m.id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form onSubmit={upload} className="card-cute h-fit space-y-4 p-6">
        <h2 className="text-xl font-semibold">Add a memory</h2>
        <div className="space-y-1.5">
          <Label htmlFor="photo">Photo</Label>
          <Input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <textarea
            id="caption"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What made this day special?"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button type="submit" className="w-full" disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Add to scrapbook
        </Button>
      </form>

      {memories.length === 0 ? (
        <div className="card-cute flex min-h-60 items-center justify-center p-10 text-center text-muted-foreground">
          No polaroids yet — pin your first memory on the left.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {memories.map((m, i) => (
            <figure
              key={m.id}
              className="group bg-card p-3 pb-4 shadow-[var(--shadow-soft)] transition-transform hover:rotate-0 hover:scale-[1.02]"
              style={{ rotate: ROTATIONS[i % ROTATIONS.length] }}
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <Image
                  src={m.image_url}
                  alt={m.title}
                  fittingType="fill"
                  className="size-full"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove(m)}
                  aria-label="Delete memory"
                >
                  <Trash2 />
                </Button>
              </div>
              <figcaption className="px-1 pt-3">
                <p className="font-display text-lg font-semibold leading-tight">{m.title}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {new Date(`${m.memory_date}T00:00:00`).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {m.caption && <p className="mt-1.5 text-sm text-muted-foreground">{m.caption}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}