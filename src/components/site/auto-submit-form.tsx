"use client";
import type { ComponentProps } from "react";

/** GET form that re-submits when a select changes. Works without JS via the submit button. */
export function AutoSubmitForm(props: ComponentProps<"form">) {
  return (
    <form
      {...props}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") (e.currentTarget as HTMLFormElement).requestSubmit();
      }}
    />
  );
}
