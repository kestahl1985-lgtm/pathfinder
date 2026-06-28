import { createClient } from "@supabase/supabase-js";
import type {
  Student,
  Assessment,
  AssessmentResponse,
  Recommendation,
  Lead,
  College,
  Course,
  AdminUser,
} from "./types.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function findOrCreateStudent(
  phoneNumber: string
): Promise<Student> {
  let { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error && error.code === "PGRST116") {
    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert([{ phone_number: phoneNumber }])
      .select()
      .single();

    if (insertError) throw insertError;
    return newStudent;
  }

  if (error) throw error;
  return student;
}

export async function getActiveAssessment(
  studentId: string
): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return data;
}

export async function createAssessment(studentId: string): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .insert([
      {
        student_id: studentId,
        current_question: 1,
        status: "in_progress",
        riasec_scores: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAssessmentScore(
  assessmentId: string,
  questionNumber: number,
  answerValue: number,
  riasecTrait: string
): Promise<void> {
  const { data: assessment, error: fetchError } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (fetchError) throw fetchError;

  const updatedScores = assessment.riasec_scores;
  updatedScores[riasecTrait as keyof typeof updatedScores] += answerValue;

  await supabase
    .from("assessments")
    .update({
      riasec_scores: updatedScores,
      current_question: questionNumber + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);

  await supabase.from("assessment_responses").insert([
    {
      assessment_id: assessmentId,
      question_number: questionNumber,
      answer_value: answerValue,
    },
  ]);
}

export async function completeAssessment(assessmentId: string): Promise<void> {
  await supabase
    .from("assessments")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);
}

export async function updateStudent(
  studentId: string,
  updates: Partial<Student>
): Promise<void> {
  await supabase
    .from("students")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", studentId);
}

export async function getRecommendations(
  assessmentId: string
): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("riasec_match_score", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data || [];
}

export async function saveLead(
  studentId: string,
  collegeId: string,
  status: string = "new"
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .insert([{ student_id: studentId, college_id: collegeId, status }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDashboardStats() {
  const [
    students,
    assessments,
    leads,
    colleges,
    leadsContacted,
    leadsEnrolled,
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact" }),
    supabase
      .from("assessments")
      .select("id", { count: "exact" })
      .eq("status", "completed"),
    supabase.from("leads").select("id", { count: "exact" }),
    supabase.from("colleges").select("id", { count: "exact" }),
    supabase
      .from("leads")
      .select("id", { count: "exact" })
      .eq("status", "contacted"),
    supabase
      .from("leads")
      .select("id", { count: "exact" })
      .eq("status", "enrolled"),
  ]);

  return {
    total_students: students.count || 0,
    completed_assessments: assessments.count || 0,
    qualified_leads: leads.count || 0,
    colleges_connected: colleges.count || 0,
    leads_contacted: leadsContacted.count || 0,
    leads_enrolled: leadsEnrolled.count || 0,
  };
}
