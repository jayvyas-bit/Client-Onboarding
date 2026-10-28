import { SECTIONS } from "./content";
import type { QuestionSpec, SectionSpec } from "./types";

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
}

export type Slide = DividerSlide | QuestionSlide;

export const SLIDES: Slide[] = SECTIONS.flatMap((section, sectionIndex) => [
  { kind: "divider", section, sectionIndex } satisfies DividerSlide,
  ...section.questions.map(
    (question): QuestionSlide => ({
      kind: "question",
      section,
      sectionIndex,
      question,
    }),
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
