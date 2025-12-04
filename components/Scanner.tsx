import React, { useEffect, useRef, useState } from 'react';
import { identifyStudentsInFrame } from '../services/geminiService';
import { Student, AttendanceRecord, SessionType } from '../types';
import { RefreshCw, Users, AlertCircle, Loader2, VideoOff, Maximize2, Zap, Camera, X } from 'lucide-react';

interface ScannerProps {
  students: Student[];
  sessionId: string;
  attendanceRecords: AttendanceRecord[];
  onAttendanceUpdate: (newIds: string[]) => void;
  className: string;
  schoolName: string;
  sessionType: SessionType;
}

export const Scanner: React.FC<ScannerProps> = ({ 
  students, sessionId, attendanceRecords, onAttendanceUpdate, className, schoolName, sessionType 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [foundNames, setFoundNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Camera Init
  useEffect(() => {
    let stream: MediaStream | null = null;
    const initCamera = async () => {
      try {
        if (stream) (stream as MediaStream).getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        if (videoRef.current) {
           videoRef.current.srcObject = stream;
           videoRef.current.play().catch(console.error);
        }
        setHasPermission(true);
      } catch (e) { 
        console.error(e); 
        setHasPermission(false); 
      }
    };
    initCamera();
    return () => { if (stream) (stream as MediaStream).getTracks().forEach(t => t.stop()); };
  }, [facingMode]);

  // Scanning Logic
  const handleScan = async () => {
    if (isScanning || !videoRef.current || !students.length) {
      if (!students.length) setErrorMsg("Chưa có dữ liệu học sinh.");
      return;
    }

    setIsScanning(true);
    setFoundNames([]);
    setErrorMsg(null);

    try {
      const canvas = document.createElement('canvas');
      const vid = videoRef.current;
      const scale = 1024 / vid.videoWidth; // Resize for API
      canvas.width = 1024;
      canvas.height = vid.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(vid, 0, 0, canvas.width, canvas.height);
      
      const ids = await identifyStudentsInFrame(canvas.toDataURL('image/jpeg', 0.8), students);
      
      if (ids.length) {
        onAttendanceUpdate(ids);
        setFoundNames(students.filter(s => ids.includes(s.id)).map(s => s.name));
      } else {
        setErrorMsg("Không nhận diện được khuôn mặt nào.");
      }
    } catch (e) {
      setErrorMsg("Lỗi kết nối AI hoặc mạng yếu.");
    } finally {
      setIsScanning(false);
    }
  };

  const presentCount = attendanceRecords.filter(r => r.sessionId === sessionId).length;

  if (hasPermission === false) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-slate-400 p-6 text-center">
      <VideoOff size={48} className="mb-4 opacity-50"/>
      <p>Vui lòng cấp quyền Camera để sử dụng tính năng này.</p>
    </div>
  );

  return (
    <div className="relative h-screen bg-black overflow-hidden flex flex-col">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-12 z-20 flex justify-between items-start bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <div>
          <div className="flex items-center space-x-2 mb-1">
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded border backdrop-blur-md ${sessionType==='AM' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                {sessionType === 'AM' ? 'BUỔI SÁNG' : 'BUỔI CHIỀU'}
             </span>
             <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">{schoolName}</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">Lớp {className}</h2>
        </div>
        <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-lg">
           <Users size={16} className="text-white/90" />
           <span className="text-lg font-bold text-white leading-none">{presentCount} <span className="text-sm text-white/50 font-medium">/ {students.length}</span></span>
        </div>
      </div>

      {/* Main Viewfinder */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
         <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-90" autoPlay playsInline muted />
         
         {/* Professional Guidelines */}
         <div className="absolute inset-0 p-8 pointer-events-none opacity-80">
            <div className="w-full h-full border border-white/20 rounded-[3rem] relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)_inset]">
               {/* Grid */}
               <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/10"></div><div className="border-r border-b border-white/10"></div><div className="border-b border-white/10"></div>
                  <div className="border-r border-b border-white/10"></div><div className="border-r border-b border-white/10"></div><div className="border-b border-white/10"></div>
                  <div className="border-r border-white/10"></div><div className="border-r border-white/10"></div><div></div>
               </div>
               
               {/* Corners - Glowing */}
               <div className="absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-blue-400 rounded-tl-[2rem] m-0 shadow-[0_0_15px_rgba(96,165,250,0.5)]"></div>
               <div className="absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-blue-400 rounded-tr-[2rem] m-0 shadow-[0_0_15px_rgba(96,165,250,0.5)]"></div>
               <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-blue-400 rounded-bl-[2rem] m-0 shadow-[0_0_15px_rgba(96,165,250,0.5)]"></div>
               <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-blue-400 rounded-br-[2rem] m-0 shadow-[0_0_15px_rgba(96,165,250,0.5)]"></div>
               
               {/* Center Focus */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/30 rounded-full flex items-center justify-center">
                   <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-pulse"></div>
               </div>
            </div>
         </div>

         {/* Scanning Animation Overlay */}
         {isScanning && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
               <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-30 animate-pulse"></div>
                  <div className="w-20 h-20 border-t-4 border-blue-400 rounded-full animate-spin"></div>
               </div>
               <p className="text-white text-xs font-bold uppercase tracking-[0.3em] mt-8 animate-pulse text-shadow-lg">Đang phân tích AI...</p>
            </div>
         )}

         {/* Result Toast */}
         {!isScanning && foundNames.length > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] z-30 animate-in zoom-in-95 duration-300">
               <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-2xl border border-white text-center ring-1 ring-white/50">
                  <div className="inline-flex bg-gradient-to-tr from-green-400 to-emerald-600 p-4 rounded-full mb-4 text-white shadow-lg shadow-green-400/30 ring-4 ring-green-100">
                      <Users size={32} />
                  </div>
                  <h3 className="font-black text-slate-800 text-2xl mb-1">Thành công!</h3>
                  <p className="text-slate-500 text-sm font-medium mb-4">Đã ghi nhận <span className="text-green-600 font-bold">{foundNames.length}</span> học sinh.</p>
                  
                  <div className="flex flex-wrap justify-center gap-2 mb-6 max-h-32 overflow-y-auto px-2 custom-scrollbar">
                     {foundNames.map((n,i) => (
                        <span key={i} className="text-[11px] font-bold bg-white border border-slate-100 text-slate-700 px-3 py-1.5 rounded-full shadow-sm animate-in zoom-in duration-300" style={{animationDelay: `${i*50}ms`}}>{n}</span>
                     ))}
                  </div>
                  
                  <button onClick={()=>setFoundNames([])} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-transform shadow-xl hover:shadow-2xl">Tiếp tục</button>
               </div>
            </div>
         )}
         
         {!isScanning && errorMsg && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] z-30 animate-in zoom-in-95 duration-300">
               <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border border-white/10 text-center text-white ring-1 ring-white/10">
                  <AlertCircle size={40} className="mx-auto mb-4 text-red-400"/>
                  <h3 className="font-bold text-lg mb-2">Thông báo</h3>
                  <p className="font-medium text-sm text-slate-300 mb-6 leading-relaxed">{errorMsg}</p>
                  <button onClick={()=>setErrorMsg(null)} className="px-8 py-3 bg-white/10 rounded-xl font-bold text-xs hover:bg-white/20 border border-white/10 transition-colors">Đóng</button>
               </div>
            </div>
         )}
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-0 left-0 right-0 h-52 bg-gradient-to-t from-black via-black/80 to-transparent z-20 flex items-end justify-center pb-28 pointer-events-none">
         <div className="flex items-center gap-12 pointer-events-auto mb-2">
            <button 
                onClick={()=>setFacingMode(p => p==='user'?'environment':'user')} 
                className="p-4 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90 border border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
               <RefreshCw size={24} />
            </button>
            
            <button onClick={handleScan} className="relative group scale-110">
               <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500 animate-pulse"></div>
               <div className="relative w-24 h-24 bg-white rounded-full border-[6px] border-slate-200 shadow-2xl flex items-center justify-center active:scale-95 transition-transform duration-200 ring-4 ring-white/20">
                  <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                      <Camera size={32} className="text-white fill-current" />
                  </div>
               </div>
            </button>
            
            <div className="w-14 h-14"></div> {/* Spacer for symmetry */}
         </div>
      </div>

    </div>
  );
};