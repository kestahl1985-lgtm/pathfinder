export interface Student {
  id: string;
  phone_number: string;
  grade: string;
  school_name: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  student_id: string;
  current_question: number;
  status: "in_progress" | "completed" | "paused";
  riasec_scores: {
    R: number;
    I: number;
    A: number;
    S: number;
    E: number;
    C: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AssessmentResponse {
  id: string;
  assessment_id: string;
  question_number: number;
  answer_value: number;
  created_at: string;
}

export interface Recommendation {
  id: string;
  assessment_id: string;
  college_id: string;
  course_id: string;
  riasec_match_score: number;
  created_at: string;
}

export interface College {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  bursary_info: string;
  created_at: string;
}

export interface Course {
  id: string;
  college_id: string;
  name: string;
  required_subjects: string[];
  duration_years: number;
  description: string;
  riasec_match: {
    R: number;
    I: number;
    A: number;
    S: number;
    E: number;
    C: number;
  };
  created_at: string;
}

export interface Lead {
  id: string;
  student_id: string;
  college_id: string;
  status: "new" | "contacted" | "interested" | "enrolled" | "rejected";
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  hashed_password: string;
  college_id: string;
  role: "admin" | "college_admin";
  created_at: string;
}

export interface Question {
  number: number;
  text: string;
  options: QuestionOption[];
}

export interface QuestionOption {
  text: string;
  value: number;
  riasec_trait: "R" | "I" | "A" | "S" | "E" | "C";
}

export interface WhatsAppMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}
