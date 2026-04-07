import { Student, AttentionDataPoint } from './types';

export const MOCK_STUDENTS: Student[] = [
  { id: '1', name: 'C sai charitesh', attentionScore: 85, status: 'focused', lastSeen: new Date().toISOString(), rollNumber: '1001', age: 19, grade: 'A', parentContact: '+91 98480 12345' },
  { id: '2', name: 'Kuntumuri shanmugam', attentionScore: 92, status: 'focused', lastSeen: new Date().toISOString(), rollNumber: '1002', age: 20, grade: 'A+', parentContact: '+91 98480 23456' },
  { id: '3', name: 'Jana sruthi', attentionScore: 45, status: 'distracted', lastSeen: new Date().toISOString(), rollNumber: '1003', age: 19, grade: 'B+', parentContact: '+91 98480 34567' },
  { id: '4', name: 'Burra Tejaswini', attentionScore: 78, status: 'focused', lastSeen: new Date().toISOString(), rollNumber: '1004', age: 20, grade: 'A', parentContact: '+91 98480 45678' },
  { id: '5', name: 'koncha Venkata Nandini', attentionScore: 12, status: 'distracted', lastSeen: new Date().toISOString(), rollNumber: '1005', age: 19, grade: 'C', parentContact: '+91 98480 56789' },
  { id: '6', name: 'Mannaru Varun Teja', attentionScore: 95, status: 'focused', lastSeen: new Date().toISOString(), rollNumber: '1006', age: 21, grade: 'A+', parentContact: '+91 98480 67890' },
  { id: '7', name: 'Kanchi Thilak', attentionScore: 0, status: 'away', lastSeen: new Date().toISOString(), rollNumber: '1007', age: 20, grade: 'B', parentContact: '+91 98480 78901' },
  { id: '8', name: 'Ooduru vinod kumar Reddy', attentionScore: 88, status: 'focused', lastSeen: new Date().toISOString(), rollNumber: '1008', age: 20, grade: 'A', parentContact: '+91 98480 89012' },
];

export const MOCK_HISTORY: AttentionDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
  timestamp: `${9 + Math.floor(i / 4)}:${(i % 4) * 15}`,
  averageAttention: 60 + Math.random() * 30,
  focusedCount: 15 + Math.floor(Math.random() * 10),
  distractedCount: 2 + Math.floor(Math.random() * 5),
}));
