export interface Student {
  id: string; // Firestore Document ID
  uid: string; // Teacher's User ID
  name: string;
  referencePhoto: string; // Base64
  createdAt: number;
  teacherName?: string;
  className?: string;
  schoolName?: string;
}

export interface AttendanceRecord {
  id?: string; // Firestore Document ID
  uid: string;
  sessionId: string;
  studentId: string;
  timestamp: number;
  teacherName?: string;
  className?: string;
  schoolName?: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  className: string | null;
  schoolName: string | null;
}

export enum AppTab {
  ROSTER = 'ROSTER',
  SCANNER = 'SCANNER',
  REPORT = 'REPORT'
}

export type SessionType = 'AM' | 'PM';

export interface UserProfile {
  className: string;
  teacherName: string;
  schoolName: string;
  scriptUrl?: string;
}

export interface SheetSyncPayload {
  className: string;
  teacherName: string;
  schoolName: string;
  date: string;
  attendance: {
    id: string;
    name: string;
    status: string;
  }[];
}