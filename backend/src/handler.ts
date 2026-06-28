import {
  findOrCreateStudent,
  getActiveAssessment,
  createAssessment,
  updateAssessmentScore,
  completeAssessment,
  updateStudent,
  getDashboardStats,
} from "./db.js";
import { getQuestion, getTotalQuestions } from "./questions.js";
import { sendText, sendQuestion } from "./twilio.js";
import { generateMidwayInsight, generateFinalReport } from "./claude.js";

const GRADES = ["10", "11", "12"];

export async function handleWebhook(
  fromPhone: string,
  messageBody: string
): Promise<void> {
  const student = await findOrCreateStudent(fromPhone);
  let assessment = await getActiveAssessment(student.id);

  if (!student.grade) {
    await handleGradeSelection(student.id, messageBody);
    return;
  }

  if (!assessment) {
    assessment = await createAssessment(student.id);
    const question = getQuestion(1);
    if (question) {
      await sendQuestion(fromPhone, question);
    }
    return;
  }

  const questionNum = assessment.current_question;
  const totalQuestions = getTotalQuestions();

  if (questionNum > totalQuestions) {
    await completeAssessment(assessment.id);
    await sendFinalReport(student, assessment);
    return;
  }

  const question = getQuestion(questionNum);
  if (!question) return;

  const selectedOptionIdx = parseInt(messageBody);
  if (isNaN(selectedOptionIdx) || selectedOptionIdx < 0 || selectedOptionIdx >= question.options.length) {
    await sendText(
      fromPhone,
      "Invalid selection. Please choose 0, 1, or 2."
    );
    return;
  }

  const selectedOption = question.options[selectedOptionIdx];
  await updateAssessmentScore(
    assessment.id,
    questionNum,
    selectedOption.value,
    selectedOption.riasec_trait
  );

  if (questionNum === 12 || questionNum === 26) {
    const updatedAssessment = await getActiveAssessment(student.id);
    if (updatedAssessment) {
      const insight = await generateMidwayInsight(
        updatedAssessment.riasec_scores,
        questionNum
      );
      await sendText(
        fromPhone,
        `📊 Insight at Question ${questionNum}:\n\n${insight}\n\nLet's continue...`
      );
    }
  }

  const nextQuestionNum = questionNum + 1;
  if (nextQuestionNum <= totalQuestions) {
    const nextQuestion = getQuestion(nextQuestionNum);
    if (nextQuestion) {
      await sendQuestion(fromPhone, nextQuestion);
    }
  }
}

async function handleGradeSelection(
  studentId: string,
  gradeInput: string
): Promise<void> {
  const selectedGradeIdx = parseInt(gradeInput);

  if (
    isNaN(selectedGradeIdx) ||
    selectedGradeIdx < 0 ||
    selectedGradeIdx >= GRADES.length
  ) {
    await sendText(
      (await findOrCreateStudent("")).id,
      "Invalid selection. Please choose 0 for Grade 10, 1 for Grade 11, or 2 for Grade 12."
    );
    return;
  }

  const selectedGrade = GRADES[selectedGradeIdx];
  await updateStudent(studentId, { grade: selectedGrade });

  await sendText(
    (await findOrCreateStudent("")).id,
    `Great! Grade ${selectedGrade} selected. Let's start the RIASEC assessment!\n\n📋 Answer each question by selecting:\n0 for the first option\n1 for the second\n2 for the third`
  );
}

async function sendFinalReport(
  student: any,
  assessment: any
): Promise<void> {
  const report = await generateFinalReport(
    student.first_name || "Student",
    assessment.riasec_scores,
    []
  );

  const chunks = splitMessage(report, 1600);
  for (const chunk of chunks) {
    await sendText(student.phone_number, chunk);
  }

  await sendText(
    student.phone_number,
    "✅ Assessment complete! Your results have been sent. Institutions will reach out with opportunities.\n\nThank you for using Pathfinder!"
  );
}

function splitMessage(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) return [message];

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > maxLength) {
    let splitIdx = remaining.lastIndexOf(" ", maxLength);
    if (splitIdx === -1) splitIdx = maxLength;

    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
