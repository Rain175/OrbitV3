const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from "react";
import { Calendar, ImagePlus, Loader2, Maximize2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image } from "@/components/ui/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ROTATIONS = ["-2.5deg", "1.8deg", "-1.2deg", "2.4deg", "-3deg", "1deg"];

export function ScrapbookTab({ room, memories = [] }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);

  async function upload(e) {
    e.preventDefault();
    if (!file || !title.trim()) {
      toast.error("Please pick an image and title");
      return;
    }

    try {
      setUploading(true);
      const res = await db.integrations.Core.UploadFile({ file });
      if (!res?.file_url) throw new Error("Upload failed");

      await db.entities.Memory.create({
        room_id: room.id,
        title: title.trim(),
        memory_date: date,
        image_url: res.file_url,
        caption: caption.trim() || null,
      });

      setTitle("");
      setCaption("");
      setFile(null);
      toast.success("Polaroid added!");
    } catch (err) {
      toast.error(err.message || "Failed to save memory");
    } finally {
      setUploading(false);
    }
  }

  async function remove(m) {
    await db.entities.Memory.delete(m.id);
    if (selectedMemory?.id === m.id) {
      setSelectedMemory(null);
    }
    toast.success("Memory removed");
  }

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      <form onSubmit={upload} className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] h-fit">
        <h3 className="font-display text-lg font-semibold">Add a memory</h3>
        <div className="space-y-1.5">
          <Label htmlFor="photo">Photo</Label>
          <Input id="photo" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption / Story</Label>
          <textarea
            id="caption"
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What made this day special? Write as much as you'd like..."
            className="flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>
        <Button type="submit" className="w-full rounded-2xl font-bold" disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Add to scrapbook
        </Button>
      </form>

      {memories.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          No polaroids yet — pin your first memory on the left.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 items-start">
          {memories.map((m, i) => {
            const isLongCaption = m.caption && m.caption.length > 90;
            return (
              <figure
                key={m.id}
                onClick={() => setSelectedMemory(m)}
                className="group bg-card p-3 pb-4 shadow-[var(--shadow-soft)] transition-all hover:rotate-0 hover:scale-[1.02] cursor-pointer rounded-sm border border-border/40 hover:shadow-xl hover:z-10 flex flex-col justify-between overflow-hidden"
                style={{ rotate: ROTATIONS[i % ROTATIONS.length] }}
              >
                <div className="relative aspect-square overflow-hidden bg-muted rounded-sm">
                  <Image
                    src={m.image_url}
                    alt={m.title}
                    fittingType="fill"
                    className="size-full transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-background/90 text-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 backdrop-blur-sm">
                      <Maximize2 className="size-3.5" /> Open memory
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 size-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100 z-10 shadow-md hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(m);
                    }}
                    aria-label="Delete memory"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <figcaption className="px-1 pt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-display text-base sm:text-lg font-semibold leading-snug break-words [overflow-wrap:anywhere] line-clamp-2">
                      {m.title}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                      {new Date(`${m.memory_date}T00:00:00`).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {m.caption && (
                      <p className="mt-2 text-xs sm:text-sm text-muted-foreground break-words [overflow-wrap:anywhere] line-clamp-3 leading-relaxed">
                        {m.caption}
                      </p>
                    )}
                  </div>
                  {isLongCaption && (
                    <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-primary group-hover:underline">
                      Read full story →
                    </span>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {/* Memory Details Pop Up Window */}
      {selectedMemory && (
        <Dialog open={!!selectedMemory} onOpenChange={(open) => !open && setSelectedMemory(null)}>
          <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl border border-border shadow-2xl bg-card text-card-foreground">
            <DialogHeader className="text-left space-y-1 pr-6">
              <DialogTitle className="font-display text-xl sm:text-2xl font-bold leading-snug break-words [overflow-wrap:anywhere]">
                {selectedMemory.title}
              </DialogTitle>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Calendar className="size-3.5" />
                <span>
                  {new Date(`${selectedMemory.memory_date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="relative w-full rounded-2xl overflow-hidden bg-muted/50 border border-border/40 max-h-[50vh] flex items-center justify-center">
                <Image
                  src={selectedMemory.image_url}
                  alt={selectedMemory.title}
                  fittingType="contain"
                  className="w-full max-h-[50vh] object-contain rounded-xl"
                />
              </div>

              {selectedMemory.caption ? (
                <div className="rounded-2xl bg-secondary/40 p-4 border border-border/50 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Description / Story
                  </h4>
                  <p className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {selectedMemory.caption}
                  </p>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">No description added for this memory.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-4">
              <Button
                variant="destructive"
                size="sm"
                className="rounded-2xl text-xs gap-1.5"
                onClick={() => remove(selectedMemory)}
              >
                <Trash2 className="size-3.5" /> Delete Memory
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl text-xs font-semibold"
                onClick={() => setSelectedMemory(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
