import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Search, Filter } from "lucide-react";
import { useState } from "react";

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
  const [searchTerm, setSearchTerm] = useState("");

  const { data: students = [], isLoading } = useQuery({
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

  const filteredStudents = students.filter(
    (student) =>
      student.phone_number.includes(searchTerm) ||
      student.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.school_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Students</h1>
        <p className="text-gray-600">Manage and track student assessments</p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or school..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 font-medium text-gray-700">
          <Filter size={18} />
          Filter
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading students...</div>}

      {!isLoading && filteredStudents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">No students found</p>
          <p className="text-sm text-gray-500">
            {searchTerm ? "Try adjusting your search" : "Students will appear here once they join"}
          </p>
        </div>
      )}

      {filteredStudents.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Grade</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">School</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-700">
                            {(student.first_name?.[0] || student.last_name?.[0] || "?").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {student.first_name || student.last_name
                            ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                            : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{student.phone_number}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {student.grade || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{student.school_name || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{student.email || "—"}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredStudents.length}</span> of{" "}
              <span className="font-semibold">{students.length}</span> students
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
