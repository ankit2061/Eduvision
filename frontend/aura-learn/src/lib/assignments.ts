// Shared assignment store using localStorage for cross-dashboard communication

export type Assignment = {
  id: string;
  materialId: string;
  materialTitle: string;
  materialContent: string;
  materialType: string;
  category: string;
  categoryLabel: string;
  assignedTo: "class" | string; // "class" or student name
  studentCategory: string; // disability/ability category id
  grade: string;
  dueDate: string;
  assignedDate: string;
  instructions: string;
  status: "pending" | "in_progress" | "submitted" | "reviewed";
  studentResponse?: string;
  score?: number;
  feedback?: string;
};

const STORAGE_KEY = "voicelift_assignments";

export function getAssignments(): Assignment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: Assignment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

export function addAssignment(assignment: Assignment) {
  const all = getAssignments();
  all.unshift(assignment);
  saveAssignments(all);
}

export function updateAssignment(id: string, updates: Partial<Assignment>) {
  const all = getAssignments();
  const idx = all.findIndex((a) => a.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates };
    saveAssignments(all);
  }
}

export function deleteAssignment(id: string) {
  const all = getAssignments().filter((a) => a.id !== id);
  saveAssignments(all);
}
