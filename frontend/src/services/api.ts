import { get, post, put, del } from '@/utils/request'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    name: string
    role: string
    email?: string
    phone?: string
  }
}

export const authApi = {
  login: (params: LoginParams) => post<LoginResponse>('/auth/login', params),
  getCurrentUser: () => get('/user/me'),
  changePassword: (data: { old_password: string; new_password: string }) =>
    post('/user/password', data),
}

export const userApi = {
  list: () => get('/users'),
}

export interface Lead {
  id?: number
  name: string
  phone: string
  intention_course?: string
  source_channel?: string
  status?: string
  assigned_to?: number
  remarks?: string
}

export const leadApi = {
  list: (params?: any) => get('/leads', params),
  get: (id: number) => get(`/leads/${id}`),
  create: (data: Lead) => post('/leads', data),
  update: (id: number, data: Partial<Lead>) => put(`/leads/${id}`, data),
  delete: (id: number) => del(`/leads/${id}`),
  assign: (id: number, data: { assigned_to: number }) =>
    post(`/leads/${id}/assign`, data),
  followup: (id: number, data: any) => post(`/leads/${id}/followup`, data),
  convert: (id: number) => post(`/leads/${id}/convert`),
}

export interface Student {
  id?: number
  name: string
  phone: string
  gender?: string
  birth_date?: string
  parent_name?: string
  parent_phone?: string
  address?: string
  tags?: string
  remarks?: string
}

export const studentApi = {
  list: (params?: any) => get('/students', params),
  get: (id: number) => get(`/students/${id}`),
  create: (data: Student) => post('/students', data),
  update: (id: number, data: Partial<Student>) => put(`/students/${id}`, data),
  delete: (id: number) => del(`/students/${id}`),
  addTag: (id: number, tag: string) => post(`/students/${id}/tags`, { tag }),
  removeTag: (id: number, tag: string) =>
    del(`/students/${id}/tags`, { params: { tag } }),
}

export interface Course {
  id?: number
  name: string
  type: string
  price_per_hour: number
  total_hours: number
  description?: string
  status?: number
}

export const courseApi = {
  list: (params?: any) => get('/courses', params),
  get: (id: number) => get(`/courses/${id}`),
  create: (data: Course) => post('/courses', data),
  update: (id: number, data: Partial<Course>) => put(`/courses/${id}`, data),
  delete: (id: number) => del(`/courses/${id}`),
}

export interface Classroom {
  id?: number
  name: string
  capacity?: number
  location?: string
  status?: number
}

export const classroomApi = {
  list: () => get('/classrooms'),
  create: (data: Classroom) => post('/classrooms', data),
  update: (id: number, data: Partial<Classroom>) => put(`/classrooms/${id}`, data),
  delete: (id: number) => del(`/classrooms/${id}`),
}

export interface Teacher {
  id?: number
  name: string
  phone?: string
  qualification?: string
  subjects?: string
  hourly_rate: number
  status?: number
}

export const teacherApi = {
  list: (params?: any) => get('/teachers', params),
  get: (id: number) => get(`/teachers/${id}`),
  create: (data: Teacher) => post('/teachers', data),
  update: (id: number, data: Partial<Teacher>) => put(`/teachers/${id}`, data),
  delete: (id: number) => del(`/teachers/${id}`),
  performances: (params?: any) => get('/performances', params),
}

export interface Schedule {
  id?: number
  course_id: number
  teacher_id: number
  classroom_id: number
  date: string
  start_time: string
  end_time: string
  duration: number
  status?: string
  remarks?: string
}

export const scheduleApi = {
  list: (params?: any) => get('/schedules', params),
  get: (id: number) => get(`/schedules/${id}`),
  create: (data: Schedule) => post('/schedules', data),
  update: (id: number, data: Partial<Schedule>) => put(`/schedules/${id}`, data),
  delete: (id: number) => del(`/schedules/${id}`),
  takeAttendance: (id: number, data: any) => post(`/schedules/${id}/attendance`, data),
  getStudentSchedules: (params: { student_id: number; date?: string }) =>
    get('/student-schedules', params),
}

export interface Payment {
  id?: number
  student_id: number
  course_id?: number
  amount: number
  refunded_amount?: number
  pending_refund_amount?: number
  refundable_amount?: number
  payment_method: string
  payment_date: string
  type?: string
  status?: string
  receipt_no?: string
  remarks?: string
}

export const paymentApi = {
  list: (params?: any) => get('/payments', params),
  get: (id: number) => get(`/payments/${id}`),
  create: (data: Payment) => post('/payments', data),
  update: (id: number, data: Partial<Payment>) => put(`/payments/${id}`, data),
  delete: (id: number) => del(`/payments/${id}`),
  reports: (params?: any) => get('/finance/reports', params),
}

export interface Refund {
  id?: number
  student_id?: number
  payment_id: number
  amount: number
  reason?: string
  status?: string
  refund_date?: string
  processed_by?: number
  created_at?: string
  student?: { id: number; name: string }
  payment?: Payment & { student?: { id: number; name: string } }
  processor?: { id: number; name: string }
}

export const refundApi = {
  list: (params?: { status?: string; payment_id?: number; student_id?: number }) =>
    get('/refunds', params),
  create: (data: { payment_id: number; amount: number; reason?: string }) =>
    post('/refunds', data),
  process: (id: number, data: { status: 'approved' | 'rejected' }) =>
    post(`/refunds/${id}/process`, data),
}

export const dashboardApi = {
  stats: () => get('/dashboard/stats'),
  charts: () => get('/dashboard/charts'),
}
