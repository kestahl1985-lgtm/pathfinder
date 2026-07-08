import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { TrendingUp, GraduationCap } from "lucide-react";

// Keep in sync with lib/careers.js TRAIT_NAMES.
const TRAIT_NAMES: Record<string, string> = {
  R: "Hands-on & practical",
  I: "Curious & analytical",
  A: "Creative & expressive",
  S: "Caring & people-focused",
  E: "Driven & enterprising",
  C: "Organised & detail-focused",
};

interface MatchRow {
  id: string;
  college_id: string;
  course_id: string;
  career_id: string;
  top_traits: string[] | null;
  grade: number | null;
  province: string | null;
  created_at: string;
  colleges: { name: string } | null;
  courses: { name: string } | null;
}

interface CourseStats {
  courseId: string;
  courseName: string;
  count: number;
  careers: Record<string, number>;
  traits: Record<string, number>;
  grades: Record<string, number>;
  provinces: Record<string, number>;
  lastMatchedAt: string;
}

interface CollegeStats {
  collegeId: string;
  collegeName: string;
  count: number;
  courses: CourseStats[];
}

function tally(counts: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
}

function topEntry(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : null;
}

function groupMatches(rows: MatchRow[]): CollegeStats[] {
  const colleges = new Map<string, CollegeStats>();

  for (const row of rows) {
    let college = colleges.get(row.college_id);
    if (!college) {
      college = { collegeId: row.college_id, collegeName: row.colleges?.name || "Unknown sponsor", count: 0, courses: [] };
      colleges.set(row.college_id, college);
    }
    college.count += 1;

    let course = college.courses.find((c) => c.courseId === row.course_id);
    if (!course) {
      course = {
        courseId: row.course_id,
        courseName: row.courses?.name || "Unknown course",
        count: 0,
        careers: {},
        traits: {},
        grades: {},
        provinces: {},
        lastMatchedAt: row.created_at,
      };
      college.courses.push(course);
    }
    course.count += 1;
    tally(course.careers, row.career_id);
    tally(course.traits, row.top_traits?.[0]);
    tally(course.grades, row.grade ? `Grade ${row.grade}` : null);
    tally(course.provinces, row.province);
    if (new Date(row.created_at) > new Date(course.lastMatchedAt)) course.lastMatchedAt = row.created_at;
  }

  return Array.from(colleges.values()).sort((a, b) => b.count - a.count);
}

export default function SponsorImpactPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sponsor_matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsor_matches")
        .select("*, colleges(name), courses(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MatchRow[]) || [];
    },
  });

  const stats = useMemo(() => groupMatches(rows), [rows]);
  const totalMatches = rows.length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Sponsor Impact</h1>
        <p className="text-gray-600">
          What sponsors are actually getting for their fee — every time a matching learner explores a career and a
          sponsor's course is shown, it's logged here.
        </p>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading impact data…</div>}

      {!isLoading && totalMatches === 0 && (
        <div className="text-center py-12">
          <TrendingUp size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 mb-2">No sponsor matches logged yet</p>
          <p className="text-sm text-gray-500">
            This fills up automatically once a learner exploring a career gets shown an active sponsor's course.
          </p>
        </div>
      )}

      {!isLoading && totalMatches > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm px-6 py-4">
            <span className="text-sm text-gray-600">Total impressions across all sponsors: </span>
            <span className="font-semibold text-navy">{totalMatches}</span>
          </div>

          {stats.map((college) => (
            <div key={college.collegeId} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <GraduationCap size={18} className="text-brand" />
                </div>
                <div>
                  <div className="font-semibold text-navy">{college.collegeName}</div>
                  <div className="text-sm text-gray-500">
                    {college.count} match{college.count !== 1 ? "es" : ""} across {college.courses.length} course
                    {college.courses.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {college.courses
                  .sort((a, b) => b.count - a.count)
                  .map((course) => {
                    const topTrait = topEntry(course.traits);
                    const topCareer = topEntry(course.careers);
                    return (
                      <div key={course.courseId} className="px-5 py-3.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-navy text-sm">{course.courseName}</span>
                          <span className="text-xs font-semibold text-brand bg-brand/10 rounded-full px-2.5 py-0.5">
                            {course.count} match{course.count !== 1 ? "es" : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {topCareer && <span>Mostly matched via <span className="font-medium text-gray-700">{topCareer}</span></span>}
                          {topTrait && <span>Top strength: <span className="font-medium text-gray-700">{TRAIT_NAMES[topTrait] || topTrait}</span></span>}
                          {Object.keys(course.grades).length > 0 && (
                            <span>Grades: <span className="font-medium text-gray-700">{Object.entries(course.grades).map(([g, n]) => `${g} (${n})`).join(", ")}</span></span>
                          )}
                          {Object.keys(course.provinces).length > 0 && (
                            <span>Provinces: <span className="font-medium text-gray-700">{Object.entries(course.provinces).map(([p, n]) => `${p} (${n})`).join(", ")}</span></span>
                          )}
                          <span>Last matched {new Date(course.lastMatchedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
