import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface Student {
  id: string;
  phone_number: string;
  grade?: string;
  school_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  created_at: string;
}

export default function StudentsPage() {
  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Student[]) || [];
    },
  });

  return (
    <div>
      <h1 style={{ marginBottom: "30px" }}>Students</h1>

      {isLoading && <p>Loading...</p>}

      {!isLoading && !students?.length && <p>No students yet.</p>}

      {students && students.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Name</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                  Phone
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Grade</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>School</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px" }}>
                    {student.first_name || student.last_name
                      ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                      : "N/A"}
                  </td>
                  <td style={{ padding: "12px" }}>{student.phone_number}</td>
                  <td style={{ padding: "12px" }}>{student.grade || "N/A"}</td>
                  <td style={{ padding: "12px" }}>{student.school_name || "N/A"}</td>
                  <td style={{ padding: "12px", color: "#6b7280", fontSize: "14px" }}>
                    {new Date(student.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
