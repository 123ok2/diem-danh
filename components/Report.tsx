import React, { useState, useMemo } from 'react';
import { Student, AttendanceRecord, AppUser } from '../types';
import { 
  CheckCircle, AlertCircle, Calendar, 
  Users, UserCheck, UserX, FileSpreadsheet, Loader2, Building2, User,
  ChevronDown, ChevronRight, Filter, Clock, Download
} from 'lucide-react';

interface ReportProps {
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  currentDateStr: string;
  onToggleStatus: (studentId: string, sessionId: string) => void;
  onSwitchToScanner: () => void;
  appUser: AppUser;
  isSchoolView: boolean;
  onToggleSchoolView: (isSchool: boolean) => void;
}

type ExportRange = 'current' | 'custom' | 'all';

export const Report: React.FC<ReportProps> = ({
  students,
  attendanceRecords,
  currentDateStr,
  onToggleStatus,
  onSwitchToScanner,
  appUser,
  isSchoolView,
  onToggleSchoolView
}) => {
  // --- STATE ---
  const [selectedDate, setSelectedDate] = useState(currentDateStr);
  const [dailySessionView, setDailySessionView] = useState<'AM' | 'PM'>(() => {
    return new Date().getHours() < 12 ? 'AM' : 'PM';
  });
  
  // Export State
  const [isSyncing, setIsSyncing] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>('current');
  const [startDate, setStartDate] = useState(getIsoDate(currentDateStr)); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(getIsoDate(currentDateStr)); // YYYY-MM-DD

  // Grouping State (For School View)
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // --- HELPER FUNCTIONS ---
  function getIsoDate(d: string) {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  function formatDisplayDate(iso: string) {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${d}-${m}-${y}`;
  }

  const sessionId = `${selectedDate}_${dailySessionView}`;

  // --- COMPUTED DATA (Daily View) ---
  const { present, absent, presentCount, totalCount, absentCount, groupedClasses } = useMemo(() => {
    // 1. Filter students based on current session for the daily view
    const presentIds = new Set(
      attendanceRecords
        .filter(r => r.sessionId === sessionId)
        .map(r => r.studentId)
    );
    
    const presentList: Student[] = [];
    const absentList: Student[] = [];
    
    students.forEach(s => {
      if (presentIds.has(s.id)) {
        presentList.push(s);
      } else {
        absentList.push(s);
      }
    });

    // 2. Group by Class for School View
    const groups: Record<string, { students: Student[], present: number, total: number }> = {};
    
    if (isSchoolView) {
        students.forEach(s => {
            const cls = s.className || 'Chưa phân lớp';
            if (!groups[cls]) groups[cls] = { students: [], present: 0, total: 0 };
            groups[cls].students.push(s);
            groups[cls].total++;
            if (presentIds.has(s.id)) groups[cls].present++;
        });
    }

    // Sort class names nicely (10A1, 10A2...)
    const sortedClassNames = Object.keys(groups).sort();
    const sortedGroups = sortedClassNames.map(cls => ({
        className: cls,
        ...groups[cls]
    }));

    return {
      present: presentList,
      absent: absentList,
      presentCount: presentList.length,
      absentCount: absentList.length,
      totalCount: students.length,
      groupedClasses: sortedGroups
    };
  }, [students, attendanceRecords, sessionId, isSchoolView]);

  // --- HANDLERS ---
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const parts = e.target.value.split('-'); // YYYY-MM-DD
    setSelectedDate(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD-MM-YYYY
  };

  const toggleClassExpand = (cls: string) => {
      const newSet = new Set(expandedClasses);
      if (newSet.has(cls)) newSet.delete(cls);
      else newSet.add(cls);
      setExpandedClasses(newSet);
  };

  // --- ADVANCED EXCEL EXPORT LOGIC ---
  const handleExportExcel = () => {
    setIsSyncing(true);
    
    setTimeout(() => {
      try {
        let exportData = [];
        let exportSessionIds: string[] = [];
        let timeRangeLabel = "";

        // 1. Determine Range and Filter Sessions
        if (exportRange === 'current') {
            exportSessionIds = [sessionId];
            timeRangeLabel = `Ngày ${selectedDate} (${dailySessionView === 'AM' ? 'Sáng' : 'Chiều'})`;
        } else {
            // Get all unique sessionIds from records that match the date filter
            const allSessions = new Set<string>();
            attendanceRecords.forEach(r => {
                // Parse sessionId "DD-MM-YYYY_AM"
                const [datePart, sessPart] = r.sessionId.split('_');
                const [d, m, y] = datePart.split('-');
                const recordIso = `${y}-${m}-${d}`;

                if (exportRange === 'all') {
                    allSessions.add(r.sessionId);
                } else if (exportRange === 'custom') {
                    if (recordIso >= startDate && recordIso <= endDate) {
                        allSessions.add(r.sessionId);
                    }
                }
            });
            
            // Sort sessions chronologically
            exportSessionIds = Array.from(allSessions).sort((a, b) => {
                const [da, sa] = a.split('_');
                const [db, sb] = b.split('_');
                // ISO date compare
                const dateA = da.split('-').reverse().join('-');
                const dateB = db.split('-').reverse().join('-');
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return sa === 'AM' ? -1 : 1; 
            });

            if (exportRange === 'all') timeRangeLabel = "Toàn bộ lịch sử";
            else timeRangeLabel = `${formatDisplayDate(startDate)} đến ${formatDisplayDate(endDate)}`;
        }

        if (exportSessionIds.length === 0 && exportRange !== 'current') {
            alert("Không có dữ liệu điểm danh trong khoảng thời gian này.");
            setIsSyncing(false);
            return;
        }

        // 2. Build Matrix Data
        // Row: Student
        // Cols: Student Info | Session 1 | Session 2 ... | Summary
        
        let tableRows = '';
        let exportCount = 0; // Đếm số lượng học sinh được xuất (STT)
        
        // Group students by Class for the Excel report as well
        const studentsToExport = [...students].sort((a, b) => {
            if (a.className !== b.className) return (a.className || "").localeCompare(b.className || "");
            return a.name.localeCompare(b.name);
        });

        studentsToExport.forEach((s) => {
            let presentCount = 0;
            let cellsHtml = '';

            // Calculate presence and build cells concurrently
            exportSessionIds.forEach(sessId => {
                const isPresent = attendanceRecords.some(r => r.sessionId === sessId && r.studentId === s.id);
                if (isPresent) presentCount++;
                const cellColor = isPresent ? '#d1fae5' : '#fee2e2'; // green-100 : red-100
                const cellText = isPresent ? 'C' : 'V';
                const cellTextColor = isPresent ? '#047857' : '#b91c1c';

                cellsHtml += `<td style="padding:8px; border:1px solid #ddd; text-align:center; background-color:${cellColor}; color:${cellTextColor}; font-weight:bold;">${cellText}</td>`;
            });

            const totalSessions = exportSessionIds.length || 1;
            
            // --- LOGIC LỌC HỌC SINH VẮNG ---
            // Nếu số lần có mặt bằng tổng số buổi (đi học đủ 100%) -> BỎ QUA
            if (presentCount === totalSessions) {
                return;
            }

            // Tăng biến đếm STT
            exportCount++;
            const percent = Math.round((presentCount / totalSessions) * 100);
            const studentAbsentCount = totalSessions - presentCount;
            
            let rowHtml = `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">${exportCount}</td>
                <td style="padding:8px; border:1px solid #ddd;">${s.name}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">${s.id.substring(0,6)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">${s.className || '-'}</td>
                ${cellsHtml}
                <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold;">${presentCount}/${totalSessions}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#b91c1c;">${studentAbsentCount}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">${percent}%</td>
            </tr>`;
            
            tableRows += rowHtml;
        });

        // 3. Build Header Rows
        let headerSessions = '';
        exportSessionIds.forEach(sid => {
             headerSessions += `<th style="padding:10px; border:1px solid #999; background-color:#f8fafc; min-width:60px;">${sid.replace('_', '<br>')}</th>`;
        });

        // 4. Construct Full HTML
        const safeSchoolName = appUser?.schoolName ? appUser.schoolName.toUpperCase() : "TRƯỜNG HỌC";
        const safeTeacherName = appUser?.displayName || '...';
        const safeClassName = appUser?.className || '...';
        
        // Cập nhật tiêu đề báo cáo
        const reportTitle = isSchoolView 
             ? "DANH SÁCH HỌC SINH VẮNG (TOÀN TRƯỜNG)" 
             : `DANH SÁCH HỌC SINH VẮNG - LỚP ${safeClassName}`;
        
        const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
            <style>
                body { font-family: 'Times New Roman', serif; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1px solid #000; padding: 5px; }
            </style>
        </head>
        <body>
            <div style="text-align:center; margin-bottom: 20px;">
                <h3 style="margin:0; color:#475569;">${safeSchoolName}</h3>
                <h1 style="margin:5px 0; color:#b91c1c; font-size:24px;">${reportTitle}</h1>
                <p style="margin:0; color:#64748b;">Thời gian: ${timeRangeLabel}</p>
                <p style="margin:0; color:#64748b;">Giáo viên lập: ${safeTeacherName}</p>
            </div>

            <!-- OVERVIEW TABLE -->
            <table style="width: 50%; margin-bottom: 20px; border: 2px solid #000;">
                <tr style="background-color: #f1f5f9;">
                    <th colspan="2" style="padding:10px; text-align:left;">TỔNG HỢP NHANH</th>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Tổng sĩ số lớp:</td>
                    <td>${students.length}</td>
                </tr>
                 <tr>
                    <td style="font-weight:bold;">Số học sinh có vắng:</td>
                    <td style="color:#b91c1c; font-weight:bold;">${exportCount}</td>
                </tr>
                 <tr>
                    <td style="font-weight:bold;">Tổng số buổi:</td>
                    <td>${exportSessionIds.length}</td>
                </tr>
            </table>

            <br/>

            <!-- MAIN TABLE -->
            <table border="1" style="width:100%; border:1px solid #000;">
                <thead>
                    <tr style="background-color:#1e40af; color:white;">
                        <th style="padding:10px; border:1px solid #999;">STT</th>
                        <th style="padding:10px; border:1px solid #999;">Họ và Tên</th>
                        <th style="padding:10px; border:1px solid #999;">Mã SV</th>
                        <th style="padding:10px; border:1px solid #999;">Lớp</th>
                        ${headerSessions}
                        <th style="padding:10px; border:1px solid #999; background-color:#334155;">Có mặt</th>
                        <th style="padding:10px; border:1px solid #999; background-color:#b91c1c; color: white;">Số buổi vắng</th>
                        <th style="padding:10px; border:1px solid #999; background-color:#334155;">Tỷ lệ</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <br/>
            <div style="margin-top: 30px; display:flex; justify-content:space-between;">
                <div style="text-align:center; width: 40%;">
                    <p><em>Ngày ..... tháng ..... năm .......</em></p>
                    <p><strong>Người lập báo cáo</strong></p>
                    <br/><br/><br/>
                    <p>${safeTeacherName}</p>
                </div>
            </div>
        </body>
        </html>`;

        // 5. Trigger Download
        const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fileName = `DanhSachVang_${isSchoolView ? 'ToanTruong' : safeClassName}_${timeRangeLabel.replace(/\s/g,'_')}.xls`;
        
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setShowExportOptions(false);
      } catch (e) {
          console.error(e);
          alert("Có lỗi khi tạo file Excel.");
      } finally {
          setIsSyncing(false);
      }
    }, 500); // Small delay for UI feedback
  };

  // --- RENDER ---
  return (
    <div className="bg-slate-50 min-h-full flex flex-col">
        {/* Header Stats */}
        <div className="bg-white p-6 rounded-b-[2rem] shadow-sm border-b border-slate-100 mb-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-2xl font-black text-slate-800">Báo Cáo</h2>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                      {isSchoolView ? "Toàn Trường" : `Lớp ${appUser?.className || '...'}`}
                   </p>
                </div>
                
                <button 
                  onClick={() => onToggleSchoolView(!isSchoolView)}
                  className={`p-2 rounded-xl border transition-all ${isSchoolView ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  title={isSchoolView ? "Xem lớp của tôi" : "Xem toàn trường"}
                >
                   {isSchoolView ? <Building2 size={20}/> : <User size={20}/>}
                </button>
            </div>

            {/* Date & Session Controls (Only relevant for Daily View) */}
            <div className="flex gap-3 mb-6">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center relative">
                   <Calendar size={18} className="text-slate-400 mr-2"/>
                   <span className="font-bold text-slate-700 text-sm flex-1">{selectedDate}</span>
                   <input 
                      type="date" 
                      value={getIsoDate(selectedDate)}
                      onChange={handleDateChange}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                   />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                   <button 
                      onClick={() => setDailySessionView('AM')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dailySessionView==='AM' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}
                   >
                      Sáng
                   </button>
                   <button 
                      onClick={() => setDailySessionView('PM')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dailySessionView==='PM' ? 'bg-white text-indigo-500 shadow-sm' : 'text-slate-400'}`}
                   >
                      Chiều
                   </button>
                </div>
            </div>
            
            {/* Dashboard Stats */}
            {isSchoolView ? (
                // SCHOOL VIEW DASHBOARD
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg shadow-slate-900/20">
                         <div className="text-[10px] font-bold uppercase opacity-70 mb-1">Tổng học sinh</div>
                         <div className="text-3xl font-black">{totalCount}</div>
                    </div>
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                         <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Số lớp học</div>
                         <div className="text-3xl font-black text-slate-800">{groupedClasses.length}</div>
                    </div>
                </div>
            ) : (
                // CLASS VIEW DASHBOARD
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-100 text-center">
                         <div className="text-[9px] font-bold uppercase text-blue-500 mb-0.5">Sĩ số</div>
                         <div className="text-lg font-black text-blue-900">{totalCount}</div>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100 text-center">
                         <div className="text-[9px] font-bold uppercase text-emerald-500 mb-0.5">Có mặt</div>
                         <div className="text-lg font-black text-emerald-900">{presentCount}</div>
                    </div>
                    <div className="bg-red-50 p-2.5 rounded-2xl border border-red-100 text-center">
                         <div className="text-[9px] font-bold uppercase text-red-500 mb-0.5">Vắng</div>
                         <div className="text-lg font-black text-red-900">{absentCount}</div>
                    </div>
                     <div className="bg-white p-2.5 rounded-2xl border border-slate-100 text-center shadow-sm">
                         <div className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Tỉ lệ</div>
                         <div className="text-lg font-black text-slate-800">
                            {totalCount > 0 ? Math.round((presentCount/totalCount)*100) : 0}%
                         </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- EXPORT OPTIONS SECTION --- */}
        <div className="px-6 mb-6">
            <button 
               onClick={() => setShowExportOptions(!showExportOptions)}
               className={`w-full py-3 font-bold rounded-xl shadow-sm border flex items-center justify-center gap-2 transition-all ${showExportOptions ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'}`}
            >
               <FileSpreadsheet size={18}/>
               <span>Cấu Hình Xuất Báo Cáo</span>
               <ChevronDown size={16} className={`transition-transform ${showExportOptions ? 'rotate-180' : ''}`}/>
            </button>

            {showExportOptions && (
                <div className="mt-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xl animate-in slide-in-from-top-2">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Phạm vi thời gian</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={()=>setExportRange('current')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${exportRange==='current'?'bg-white shadow-sm text-blue-600':'text-slate-500'}`}>Hiện tại</button>
                                <button onClick={()=>setExportRange('custom')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${exportRange==='custom'?'bg-white shadow-sm text-blue-600':'text-slate-500'}`}>Tùy chọn</button>
                                <button onClick={()=>setExportRange('all')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${exportRange==='all'?'bg-white shadow-sm text-blue-600':'text-slate-500'}`}>Toàn bộ</button>
                            </div>
                        </div>

                        {exportRange === 'custom' && (
                             <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Từ ngày</label>
                                     <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700" />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Đến ngày</label>
                                     <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700" />
                                 </div>
                             </div>
                        )}
                        
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex items-start gap-2">
                            <AlertCircle size={14} className="text-yellow-600 mt-0.5 shrink-0"/>
                            <p className="text-[10px] text-yellow-800 font-medium">Hệ thống sẽ chỉ xuất danh sách những học sinh có ít nhất 1 buổi vắng trong khoảng thời gian đã chọn.</p>
                        </div>

                        <button 
                           onClick={handleExportExcel} 
                           disabled={isSyncing}
                           className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
                        >
                           {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Download size={18}/>}
                           <span>Tải File Excel (DS Vắng)</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* --- MAIN CONTENT LISTS --- */}
        <div className="px-6 space-y-6">
            
            {/* SCHOOL VIEW: Grouped by Class */}
            {isSchoolView && (
                <div className="space-y-3">
                    {groupedClasses.map((group) => {
                        const isExpanded = expandedClasses.has(group.className);
                        const percent = group.total > 0 ? Math.round((group.present / group.total) * 100) : 0;
                        
                        return (
                            <div key={group.className} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all">
                                <button 
                                    onClick={() => toggleClassExpand(group.className)}
                                    className="w-full p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${percent < 50 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {percent}%
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-slate-800 text-lg">{group.className}</div>
                                            <div className="text-xs text-slate-500 font-medium">{group.present}/{group.total} có mặt</div>
                                        </div>
                                    </div>
                                    <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}/>
                                </button>
                                
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-2 animate-in slide-in-from-top-2">
                                        {group.students.map((s, idx) => {
                                            const isPresent = attendanceRecords.some(r => r.sessionId === sessionId && r.studentId === s.id);
                                            return (
                                                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-slate-100 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-300 w-5">{idx+1}</span>
                                                        <div className="font-medium text-sm text-slate-700">{s.name}</div>
                                                    </div>
                                                    {isPresent ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Có mặt</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Vắng</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CLASS VIEW: Standard List */}
            {!isSchoolView && (
                <>
                    {/* Absent List */}
                    <div>
                       <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <AlertCircle size={18} className="text-red-500"/>
                          Danh sách vắng ({absentCount})
                       </h3>
                       
                       {absent.length === 0 ? (
                           <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 border-dashed">
                              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-2 opacity-50"/>
                              <p className="font-bold text-slate-600 text-sm">Tuyệt vời!</p>
                              <p className="text-xs text-slate-400">Lớp học đầy đủ.</p>
                           </div>
                        ) : (
                           <div className="space-y-2">
                              {absent.map((s, index) => (
                                 <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-red-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                       <div className="w-6 text-center font-bold text-red-300 text-xs">{index + 1}</div>
                                       <img 
                                          src={s.referencePhoto} 
                                          alt={s.name} 
                                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm bg-slate-200"
                                       />
                                       <div>
                                          <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                                          <div className="text-[10px] text-slate-400 font-mono">ID: {s.id.substring(0,6)}</div>
                                       </div>
                                    </div>
                                    <button 
                                       onClick={() => onToggleStatus(s.id, sessionId)}
                                       className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-red-100 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors whitespace-nowrap active:scale-95"
                                    >
                                       Điểm danh
                                    </button>
                                 </div>
                              ))}
                           </div>
                        )}
                    </div>

                    {/* Present List */}
                    {present.length > 0 && (
                        <div>
                           <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 mt-6">
                              <CheckCircle size={18} className="text-emerald-500"/>
                              Đã điểm danh ({presentCount})
                           </h3>
                           <div className="bg-white rounded-2xl border border-slate-100 p-2 grid grid-cols-4 gap-2">
                              {present.map((s) => (
                                  <div key={s.id} className="text-center p-2 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors group" onClick={() => onToggleStatus(s.id, sessionId)}>
                                     <div className="relative inline-block">
                                        <img src={s.referencePhoto} className="w-10 h-10 rounded-full object-cover mx-auto border-2 border-emerald-400 p-0.5" />
                                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                                           <CheckCircle size={8} strokeWidth={4} />
                                        </div>
                                     </div>
                                     <div className="text-[9px] font-medium text-slate-600 truncate mt-1 max-w-full group-hover:text-emerald-600">{s.name}</div>
                                  </div>
                              ))}
                           </div>
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Spacer to prevent bottom nav overlap */}
        <div className="h-40 shrink-0 w-full"></div>
    </div>
  );
};