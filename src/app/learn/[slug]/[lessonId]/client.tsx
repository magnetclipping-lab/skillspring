"use client";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLessonCompleteAction } from "@/lib/actions/learning";
import { touchLessonAction } from "./actions";

export function TouchLesson({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void touchLessonAction(lessonId);
  }, [lessonId]);
  return null;
}

export function CompleteButton({ lessonId, completed, path }: { lessonId: string; completed: boolean; path: string }) {
  const [done, setDone] = useState(completed);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={done ? "secondary" : "primary"}
        disabled={pending}
        onClick={() => start(async () => {
          const r = await setLessonCompleteAction(lessonId, !done, path);
          if (r.ok) setDone(!done);
          else setError(r.message ?? "Could not update progress.");
        })}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : done ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4" />}
        {done ? "Completed" : "Mark as complete"}
      </Button>
      {error ? <p className="mt-1 text-[12px] text-red-400">{error}</p> : null}
    </div>
  );
}
