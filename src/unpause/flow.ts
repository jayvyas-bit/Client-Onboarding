import { SECTIONS } from "./content";
import type { QuestionPart, QuestionSpec, SectionSpec } from "./types";

export interface DividerSlide {
  kind: "divider";
  section: SectionSpec;
  sectionIndex: number;
}

export interface QuestionSlide {
  kind: "question";
  section: SectionSpec;
  sectionIndex: number;
  question: QuestionSpec;
  part: QuestionPart;
  partPosition: number;
  partCount: number;
}

export type Slide = DividerSlide | QuestionSlide;

export const SLIDES: Slide[] = SECTIONS.flatMap((section, sectionIndex) => [
  { kind: "divider", section, sectionIndex } satisfies DividerSlide,
  ...section.questions.flatMap((question) =>
    question.parts.map(
      (part, i): QuestionSlide => ({
        kind: "question",
        section,
        sectionIndex,
        question,
        part,
        partPosition: i + 1,
        partCount: question.parts.length,
      }),
    ),
  ),
]);

export const QUESTION_ORDINALS: number[] = (() => {
  let count = 0;
  return SLIDES.map((slide) => {
    if (slide.kind === "question") count += 1;
    return count;
  });
})();

export const TOTAL_QUESTIONS = QUESTION_ORDINALS[QUESTION_ORDINALS.length - 1] ?? 0;
