"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/shared/form";

/** Narrow the portal to one project (kept in the URL, so the link can be shared). */
export function ProjectFilter({ projects, value }: { projects: { id: string; name: string }[]; value: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (
    <NativeSelect
      aria-label="Project"
      value={value ?? ""}
      className="h-8 w-auto max-w-64 text-sm"
      onChange={(event) => {
        const next = new URLSearchParams(search);
        if (event.target.value) next.set("project", event.target.value);
        else next.delete("project");
        router.replace(`${pathname}?${next}`, { scroll: false });
      }}
    >
      <option value="">All projects</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </NativeSelect>
  );
}
