import { SECTIONS } from "./content.js";
import type { QuestionSpec, SectionSpec } from "./types.js";

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

export function getActiveSections(answers: Record<string, unknown>): SectionSpec[] {
  return SECTIONS.filter((section) => !section.condition || section.condition(answers)).map((section) => ({
    ...section,
    questions: section.questions.filter((question) => !question.condition || question.condition(answers)),
  }));
}

export function buildSlides(sections: SectionSpec[]): Slide[] {
  return sections.flatMap((section, sectionIndex) => [
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
}

export function getQuestionOrdinals(slides: Slide[]): number[] {
  let count = 0;
  return slides.map((slide) => {
    if (slide.kind === "question") count += 1;
    return count;
  });
}

export function getTotalQuestions(questionOrdinals: number[]): number {
  return questionOrdinals[questionOrdinals.length - 1] ?? 0;
}
