import {
  getTrainingLessons,
  normalizeCurriculumLocale,
  type TrainingAudience,
  type TrainingLocale,
} from './curriculum';

export type TrainingQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  lessonId: string;
};

const COPY: Record<TrainingLocale, {
  actionPrompt: string;
  resultPrompt: string;
  checklistPrompt: string;
}> = {
  en: {
    actionPrompt: 'Which action belongs to “{{title}}”?',
    resultPrompt: 'Which result should be verified after “{{title}}”?',
    checklistPrompt: 'Which checklist item is required for “{{title}}”?',
  },
  el: {
    actionPrompt: 'Ποια ενέργεια ανήκει στο «{{title}}»;',
    resultPrompt: 'Ποιο αποτέλεσμα πρέπει να επιβεβαιωθεί μετά το «{{title}}»;',
    checklistPrompt: 'Ποιο στοιχείο ελέγχου απαιτείται για το «{{title}}»;',
  },
  de: {
    actionPrompt: 'Welche Aktion gehört zu „{{title}}“?',
    resultPrompt: 'Welches Ergebnis muss nach „{{title}}“ geprüft werden?',
    checklistPrompt: 'Welcher Prüfpunkt ist für „{{title}}“ erforderlich?',
  },
  es: {
    actionPrompt: '¿Qué acción pertenece a «{{title}}»?',
    resultPrompt: '¿Qué resultado debe verificarse después de «{{title}}»?',
    checklistPrompt: '¿Qué elemento de control se requiere para «{{title}}»?',
  },
  tr: {
    actionPrompt: '“{{title}}” için hangi işlem doğrudur?',
    resultPrompt: '“{{title}}” sonrasında hangi sonuç doğrulanmalıdır?',
    checklistPrompt: '“{{title}}” için hangi kontrol öğesi gereklidir?',
  },
};

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (value, [key, replacement]) => value.replaceAll(`{{${key}}}`, replacement),
    template,
  );
}

function rotate<T>(items: T[], shift: number) {
  if (!items.length) return items;
  const normalized = ((shift % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function uniqueOptions(correct: string, distractors: string[]) {
  const result = [correct];
  for (const option of distractors) {
    if (!result.includes(option)) result.push(option);
    if (result.length === 4) break;
  }
  return result;
}

export function buildTrainingQuiz(
  audience: TrainingAudience,
  language?: string | null,
): TrainingQuizQuestion[] {
  const locale = normalizeCurriculumLocale(language);
  const lessons = getTrainingLessons(audience, locale);
  const copy = COPY[locale];

  return Array.from({ length: 50 }, (_, index) => {
    const target = lessons[index % lessons.length];
    const mode = index % 3;
    const comparisonLessons = rotate(lessons, index + 3).filter((lesson) => lesson.id !== target.id);

    let prompt = '';
    let correct = '';
    let distractors: string[] = [];

    if (mode === 0) {
      prompt = interpolate(copy.actionPrompt, { title: target.title });
      correct = target.action;
      distractors = comparisonLessons.map((lesson) => lesson.action);
    } else if (mode === 1) {
      prompt = interpolate(copy.resultPrompt, { title: target.title });
      correct = target.result;
      distractors = comparisonLessons.map((lesson) => lesson.result);
    } else {
      prompt = interpolate(copy.checklistPrompt, { title: target.title });
      correct = target.checklist[index % target.checklist.length];
      distractors = comparisonLessons.flatMap((lesson) => lesson.checklist);
    }

    const baseOptions = uniqueOptions(correct, distractors);
    const optionShift = (index * 7 + 3) % 4;
    const options = rotate(baseOptions, optionShift);

    return {
      id: `${audience}-quiz-${String(index + 1).padStart(2, '0')}`,
      prompt,
      options,
      correctIndex: options.indexOf(correct),
      lessonId: target.id,
    };
  });
}

export function calculateTrainingQuizScore(
  questions: TrainingQuizQuestion[],
  answers: Record<string, number>,
) {
  const correct = questions.reduce(
    (total, question) => total + (answers[question.id] === question.correctIndex ? 1 : 0),
    0,
  );
  return Math.round((correct / questions.length) * 100);
}
