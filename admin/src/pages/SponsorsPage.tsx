import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";

// Keep in sync with lib/provinces.js PROVINCES.
const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
  "Other",
];

// Keep in sync with lib/careers.js TRAIT_NAMES.
const TRAITS: { code: string; label: string }[] = [
  { code: "R", label: "Hands-on & practical" },
  { code: "I", label: "Curious & analytical" },
  { code: "A", label: "Creative & expressive" },
  { code: "S", label: "Caring & people-focused" },
  { code: "E", label: "Driven & enterprising" },
  { code: "C", label: "Organised & detail-focused" },
];

interface Course {
  id: string;
  college_id: string;
  name: string;
  required_subjects: string[] | null;
  duration_years: number | null;
  riasec_match: Record<string, number>;
  active: boolean;
}

interface College {
  id: string;
  name: string;
  province: string | null;
  location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  active: boolean;
  courses?: Course[];
}

function traitsFromMatch(m: Record<string, number> | null | undefined): { primary: string; secondary: string } {
  const entries = Object.entries(m || {}).sort((a, b) => b[1] - a[1]);
  return { primary: entries[0]?.[1] ? entries[0][0] : "R", secondary: entries[1]?.[1] ? entries[1][0] : "" };
}

function buildRiasecMatch(primary: string, secondary: string): Record<string, number> {
  const m: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  if (primary) m[primary] = 10;
  if (secondary) m[secondary] = 5;
  return m;
}

export default function SponsorsPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingCollege, setEditingCollege] = useState<Partial<College> | null>(null);
  const [editingCourse, setEditingCourse] = useState<{ collegeId: string; course: Partial<Course> } | null>(null);
  const [error, setError] = useState("");

  const { data: colleges = [], isLoading } = useQuery({
    queryKey: ["colleges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colleges")
        .select("*, courses(*)")
        .order("name");
      if (error) throw error;
      return (data as College[]) || [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["colleges"] });

  const saveCollege = async (c: Partial<College>) => {
    setError("");
    const payload = {
      name: c.name?.trim(),
      province: c.province || null,
      location: c.location?.trim() || null,
      contact_email: c.contact_email?.trim() || null,
      contact_phone: c.contact_phone?.trim() || null,
      website: c.website?.trim() || null,
      active: c.active ?? true,
    };
    if (!payload.name) { setError("Sponsor name is required."); return; }
    const { error } = c.id
      ? await supabase.from("colleges").update(payload).eq("id", c.id)
      : await supabase.from("colleges").insert(payload);
    if (error) { setError(error.message); return; }
    setEditingCollege(null);
    refresh();
  };

  const deleteCollege = async (id: string) => {
    if (!confirm("Delete this sponsor and all its courses?")) return;
    const { error } = await supabase.from("colleges").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    refresh();
  };

  const saveCourse = async (collegeId: string, c: Partial<Course> & { primary?: string; secondary?: string }) => {
    setError("");
    if (!c.name?.trim()) { setError("Course name is required."); return; }
    const payload = {
      college_id: collegeId,
      name: c.name.trim(),
      required_subjects: c.required_subjects?.length ? c.required_subjects : null,
      duration_years: c.duration_years || null,
      riasec_match: buildRiasecMatch(c.primary || "R", c.secondary || ""),
      active: c.active ?? true,
    };
    const { error } = c.id
      ? await supabase.from("courses").update(payload).eq("id", c.id)
      : await supabase.from("courses").insert(payload);
    if (error) { setError(error.message); return; }
    setEditingCourse(null);
    refresh();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    refresh();
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">Sponsors</h1>
          <p className="text-gray-600">Colleges and courses shown to matching learners in their WhatsApp results</p>
        </div>
        <button
          onClick={() => setEditingCollege({ active: true })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-lg transition"
        >
          <Plus size={18} /> Add sponsor
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {isLoading && <div className="text-center py-12 text-gray-500">Loading sponsors…</div>}

      {!isLoading && colleges.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">No sponsors yet</p>
          <p className="text-sm text-gray-500">Add a college and its courses to start surfacing them to learners</p>
        </div>
      )}

      <div className="space-y-3">
        {colleges.map((college) => (
          <div key={college.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                className="flex items-center gap-3 flex-1 text-left"
                onClick={() => setExpanded((e) => ({ ...e, [college.id]: !e[college.id] }))}
              >
                {expanded[college.id] ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <GraduationCap size={18} className="text-brand" />
                </div>
                <div>
                  <div className="font-semibold text-navy">{college.name}</div>
                  <div className="text-sm text-gray-500">
                    {college.province || "National"} · {(college.courses || []).length} course{(college.courses || []).length !== 1 ? "s" : ""}
                    {!college.active && " · inactive"}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingCollege(college)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit">
                  <Pencil size={16} />
                </button>
                <button onClick={() => deleteCollege(college.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {expanded[college.id] && (
              <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-navy">Courses</h3>
                  <button
                    onClick={() => setEditingCourse({ collegeId: college.id, course: { active: true } })}
                    className="flex items-center gap-1.5 text-sm font-medium text-brand hover:opacity-80"
                  >
                    <Plus size={14} /> Add course
                  </button>
                </div>
                {(college.courses || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No courses added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(college.courses || []).map((course) => {
                      const { primary, secondary } = traitsFromMatch(course.riasec_match);
                      return (
                        <div key={course.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5">
                          <div>
                            <div className="font-medium text-navy text-sm">{course.name}</div>
                            <div className="text-xs text-gray-500">
                              {TRAITS.find((t) => t.code === primary)?.label}
                              {secondary ? ` + ${TRAITS.find((t) => t.code === secondary)?.label}` : ""}
                              {course.duration_years ? ` · ${course.duration_years} yr${course.duration_years !== 1 ? "s" : ""}` : ""}
                              {!course.active && " · inactive"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingCourse({ collegeId: college.id, course: { ...course, primary, secondary } as any })}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                            >
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteCourse(course.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingCollege && (
        <CollegeModal
          college={editingCollege}
          onClose={() => setEditingCollege(null)}
          onSave={saveCollege}
        />
      )}

      {editingCourse && (
        <CourseModal
          course={editingCourse.course}
          onClose={() => setEditingCourse(null)}
          onSave={(c) => saveCourse(editingCourse.collegeId, c)}
        />
      )}
    </div>
  );
}

function CollegeModal({ college, onClose, onSave }: { college: Partial<College>; onClose: () => void; onSave: (c: Partial<College>) => void }) {
  const [form, setForm] = useState<Partial<College>>(college);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-navy">{college.id ? "Edit sponsor" : "Add sponsor"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          <input
            placeholder="College / institution name"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <select
            value={form.province || ""}
            onChange={(e) => setForm({ ...form, province: e.target.value || null })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">National (shown to all provinces)</option>
            {PROVINCES.filter((p) => p !== "Other").map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            placeholder="Full address / campus location (optional)"
            value={form.location || ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            placeholder="Website (optional)"
            value={form.website || ""}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            placeholder="Contact email (optional)"
            value={form.contact_email || ""}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            placeholder="Contact phone (optional)"
            value={form.contact_phone || ""}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Currently sponsoring (shown to learners)
          </label>
          <button
            onClick={() => onSave(form)}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-lg transition"
          >
            Save sponsor
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseModal({ course, onClose, onSave }: { course: Partial<Course> & { primary?: string; secondary?: string }; onClose: () => void; onSave: (c: Partial<Course> & { primary?: string; secondary?: string }) => void }) {
  const [form, setForm] = useState(course);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-navy">{course.id ? "Edit course" : "Add course"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          <input
            placeholder="Course name"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Primary fit</label>
              <select
                value={form.primary || "R"}
                onChange={(e) => setForm({ ...form, primary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                {TRAITS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Secondary fit (optional)</label>
              <select
                value={form.secondary || ""}
                onChange={(e) => setForm({ ...form, secondary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">None</option>
                {TRAITS.filter((t) => t.code !== form.primary).map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <input
            placeholder="Required subjects, comma-separated (optional)"
            value={(form.required_subjects || []).join(", ")}
            onChange={(e) => setForm({ ...form, required_subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            type="number"
            placeholder="Duration in years (optional)"
            value={form.duration_years || ""}
            onChange={(e) => setForm({ ...form, duration_years: e.target.value ? parseInt(e.target.value, 10) : null })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active (shown to learners)
          </label>
          <button
            onClick={() => onSave(form)}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-lg transition"
          >
            Save course
          </button>
        </div>
      </div>
    </div>
  );
}
