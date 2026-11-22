"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="main" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-ink-muted">Please try again. If the problem continues, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
