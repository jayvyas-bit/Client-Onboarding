import { SECTIONS } from "./content.js";
import type { QuestionSpec, SectionSpec } from "./types.js";

export interface QuestionSlide {
  kind: "question";
  section: SectionSpec;
  sectionIndex: number;
  question: QuestionSpec;
  isFirstInSection: boolean;
}

export type Slide = QuestionSlide;

export function getActiveSections(answers: Record<string, unknown>): SectionSpec[] {
  return SECTIONS.filter((section) => !section.condition || section.condition(answers)).map((section) => ({
    ...section,
    questions: section.questions.filter((question) => !question.condition || question.condition(answers)),
  }));
}

export function buildSlides(sections: SectionSpec[]): Slide[] {
  return sections.flatMap((section, sectionIndex) =>
    section.questions.map(
      (question, questionIndex): QuestionSlide => ({
        kind: "question",
        section,
        sectionIndex,
        question,
        isFirstInSection: questionIndex === 0,
      }),
    ),
  );
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
