import api from "@/lib/api";

export interface Appointment {
  id: number;
  scheduled_at: string;
  duration_minutes: number;
  topic: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  created_at: string;
}

export const appointmentsService = {
  list: () => api.get<Appointment[]>("/appointments").then(r => r.data),
  create: (data: { scheduled_at: string; topic?: string; notes?: string }) =>
    api.post<Appointment>("/appointments", data).then(r => r.data),
  cancel: (id: number) => api.delete(`/appointments/${id}`).then(r => r.data),
};
