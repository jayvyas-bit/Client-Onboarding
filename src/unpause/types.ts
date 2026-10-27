export interface FieldSpec {
  id: string;
  label: string;
  placeholder?: string;
}

export type AnswerPart =
  | { kind: "fields"; fields: FieldSpec[] }
  | { kind: "short-text"; placeholder?: string }
  | { kind: "long-text"; placeholder?: string }
  | { kind: "single-select"; options: string[]; allowOther?: boolean }
  | {
      kind: "multi-select";
      options: string[];
      maxSelect?: number;
      allowOther?: boolean;
    }
  | { kind: "scale-pairs"; pairs: [string, string][] }
  | { kind: "upload-or-text"; placeholder?: string };

export interface QuestionPart {
  id: string;
  label?: string;
  helper?: string;
  part: AnswerPart;
}

export interface QuestionSpec {
  id: string;
  number: number;
  prompt: string;
  helper?: string;
  parts: QuestionPart[];
}

export interface SectionSpec {
  id: string;
  number: string;
  title: string;
  host: string;
  intro?: string;
  questions: QuestionSpec[];
}

export interface UploadedFileRef {
  name: string;
  size: number;
  path: string;
}

export type FieldsValue = Record<string, string>;

export interface UploadOrTextValue {
  text: string;
  files: UploadedFileRef[];
}

export interface ScalePairsValue {
  [pairIndex: number]: number;
}

export type AnswerValue =
  | string
  | string[]
  | FieldsValue
  | UploadOrTextValue
  | ScalePairsValue;

export type Answers = Record<string, AnswerValue>;

export interface IntakeSubmission {
  id: string;
  submittedAt: string;
  answers: Answers;
}
