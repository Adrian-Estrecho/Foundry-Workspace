import { ExternalLinkIcon } from "lucide-react";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { WIDE_TYPES, readAnswers, type Answer } from "../fields";

/**
 * Answers to the workspace's own form questions, on an applicant or a lead.
 * Labels are the ones the form had when it was sent.
 */
export function AnswerList({ answers: raw, className }: { answers: unknown; className?: string }) {
  const answers = readAnswers(raw);
  if (answers.length === 0) return null;

  return (
    <div className={cn("border-t pt-5", className)}>
      <p className="text-xs font-medium text-muted-foreground">More answers</p>
      <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {answers.map((answer) => (
          <div key={answer.id || answer.label} className={cn("min-w-0", WIDE_TYPES.includes(answer.type) && "sm:col-span-2")}>
            <dt className="text-xs text-muted-foreground">{answer.label}</dt>
            <dd className="mt-1 text-sm">
              <AnswerValue answer={answer} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AnswerValue({ answer }: { answer: Answer }) {
  if (Array.isArray(answer.value)) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {answer.value.map((value) => (
          <li key={value} className="rounded-full bg-surface px-2.5 py-0.5 ring-1 ring-border">
            {value}
          </li>
        ))}
      </ul>
    );
  }
  if (answer.type === "url" && /^https?:\/\//.test(answer.value)) {
    return (
      <a href={answer.value} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 font-medium hover:text-primary">
        <ExternalLinkIcon className="size-3.5 shrink-0" />
        <span className="truncate">{answer.value}</span>
      </a>
    );
  }
  if (answer.type === "email") {
    return (
      <a href={`mailto:${answer.value}`} className="font-medium hover:text-primary">
        {answer.value}
      </a>
    );
  }
  if (answer.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(answer.value)) {
    return <span className="font-medium">{formatDay(answer.value, { month: "short", day: "numeric", year: "numeric" })}</span>;
  }
  if (answer.type === "long_text") {
    return <p className="rounded-2xl bg-surface p-3 whitespace-pre-line ring-1 ring-border">{answer.value}</p>;
  }
  return <span className="font-medium break-words">{answer.value}</span>;
}
