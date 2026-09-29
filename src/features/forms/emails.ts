import type { Answer } from "./fields";

/** Answers to a workspace's own questions, as label/value rows for an email. */
export const answerRows = (answers: Answer[]): [string, string][] =>
  answers.map((answer) => [answer.label, Array.isArray(answer.value) ? answer.value.join(", ") : answer.value]);
