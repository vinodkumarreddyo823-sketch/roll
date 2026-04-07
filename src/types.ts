export interface UserProfile {
  uid: string;
  role: 'student' | 'professor' | 'parent';
  email: string;
  name: string;
  rollNumber?: string; // For students
  aadharNumber?: string; // For students
  professorId?: string; // For professors
  childRollNumber?: string; // For parents
  isVerified?: boolean;
  createdAt?: any;
}

export interface Student {
  id: string;
  name: string;
  avatar?: string;
  attentionScore: number; // 0-100
  status: 'focused' | 'distracted' | 'away';
  lastSeen: string;
  rollNumber?: string;
  age?: number;
  grade?: string;
  parentContact?: string;
  feedback?: string;
  feedbackUpdatedAt?: any;
  isVerified?: boolean;
}

export interface AttentionDataPoint {
  timestamp: string;
  averageAttention: number;
  focusedCount: number;
  distractedCount: number;
}

export interface SessionReport {
  id: string;
  date: string;
  duration: number; // minutes
  averageAttention: number;
  peakAttention: number;
  lowAttention: number;
  summary: string;
}
