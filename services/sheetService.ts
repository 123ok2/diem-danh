import { Student, AttendanceRecord, UserProfile, SheetSyncPayload } from '../types';

export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztcsEGnbN_bFVZMB_MLVDfa5bW4AyOm01CpYHztDLS9iHb1uGuGviIMtHgsA-UmImbqg/exec";

export const syncAttendanceToSheet = async (
  profile: UserProfile,
  sessionId: string,
  students: Student[],
  attendanceRecords: AttendanceRecord[]
): Promise<{ success: boolean; message?: string }> => {
  
  const url = profile.scriptUrl || DEFAULT_SCRIPT_URL;

  // 1. Prepare Payload
  const attendanceList = students.map(student => {
    const isPresent = attendanceRecords.some(r => r.sessionId === sessionId && r.studentId === student.id);
    return {
      id: student.id,
      name: student.name,
      status: isPresent ? "CÓ MẶT" : "VẮNG"
    };
  });

  const payload: SheetSyncPayload = {
    className: profile.className,
    teacherName: profile.teacherName,
    schoolName: profile.schoolName,
    date: sessionId,
    attendance: attendanceList
  };

  try {
    // 2. Send Data
    // Note: We use 'no-cors' mode because standard CORS often fails with GAS from client-side without complex setup.
    // 'no-cors' means we can send data but cannot read the response body. 
    // We assume success if no network error is thrown.
    
    // However, to make it robust, we try to use standard POST with text/plain to avoid preflight if possible.
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify(payload)
    });

    return { success: true };

  } catch (error) {
    console.error("Sync Error:", error);
    return { success: false, message: "Không thể kết nối đến Google Sheet. Vui lòng kiểm tra mạng." };
  }
};