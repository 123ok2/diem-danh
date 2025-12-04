import React, { useState, useRef } from 'react';
import { Student } from '../types';
import { Trash2, UserPlus, Camera, X, Upload, Loader2, School, UserCircle, Settings, Building2, Check, ImagePlus, MoreHorizontal, FolderUp, CalendarDays, GraduationCap, Users, Pencil, Save, ChevronRight, User, LogOut } from 'lucide-react';
import { addStudentToFirestore, deleteStudentFromFirestore, updateUserProfile, updateStudentName, logoutUser } from '../services/firebaseService';

interface StudentListProps {
  students: Student[];
  uid: string;
  className: string;
  teacherName: string;
  schoolName: string;
  onUpdateProfile: (n: string, c: string, s: string) => void;
}

interface BatchItem {
  id: string;
  file: File;
  name: string; 
}

export const StudentList: React.FC<StudentListProps> = ({ students, uid, className, teacherName, schoolName, onUpdateProfile }) => {
  // State
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Add Student State
  const [newName, setNewName] = useState('');
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  
  // Edit Student Name State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  
  // Batch Upload State
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');

  // Profile Edit State
  const [editTeacher, setEditTeacher] = useState(teacherName);
  const [editClass, setEditClass] = useState(className);
  const [editSchool, setEditSchool] = useState(schoolName);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Helpers
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const academicYear = currentMonth >= 8 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

  // --- Logic Helpers (Identical to previous) ---
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Không thể mở camera. Vui lòng cấp quyền.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const scale = 512 / videoRef.current.videoWidth;
    canvas.width = 512;
    canvas.height = videoRef.current.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      setTempPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const handleSingleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file).then(setTempPhoto).catch(err => alert((err as Error).message));
  };

  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error("File không phải ảnh"));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 512;
          let w = img.width, h = img.height;
          if (w > h) { if (w > max) { h *= max/w; w = max; } }
          else { if (h > max) { w *= max/h; h = max; } }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBatchSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newItems = files.map((f: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      name: f.name.replace(/\.[^/.]+$/, "").trim()
    }));
    setBatchQueue(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const executeBatch = async () => {
    if (!batchQueue.length) return;
    setIsBatchUploading(true);
    let success = 0, fail = 0;
    
    for (let i = 0; i < batchQueue.length; i++) {
      const item = batchQueue[i];
      if (!item) continue;
      setBatchProgress(`Đang xử lý ${i+1}/${batchQueue.length}: ${item.name}`);
      try {
        const base64 = await processImageFile(item.file);
        await addStudentToFirestore(uid, item.name, base64, teacherName, className, schoolName);
        success++;
      } catch (e: any) {
        console.error(e);
        fail++;
      }
    }
    setIsBatchUploading(false);
    setBatchQueue([]);
    setBatchProgress('');
    alert(`Hoàn tất! Thành công: ${success}, Lỗi: ${fail}`);
    setIsAdding(false);
  };

  const saveStudent = async () => {
    if (!newName || !tempPhoto) return;
    setIsSaving(true);
    try {
      await addStudentToFirestore(uid, newName, tempPhoto, teacherName, className, schoolName);
      setNewName(''); setTempPhoto(null); setIsAdding(false);
    } catch (e) { alert("Lỗi lưu: " + (e as Error).message); }
    setIsSaving(false);
  };

  const removeStudent = async (id: string) => {
    if (confirm("Xóa học sinh này?")) await deleteStudentFromFirestore(id);
  };

  const startEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditStudentName(student.name);
  };

  const handleUpdateStudentName = async () => {
    if (!editingStudent || !editStudentName.trim()) return;
    try {
      await updateStudentName(editingStudent.id, editStudentName);
      setEditingStudent(null);
    } catch (e) {
      alert("Lỗi cập nhật tên: " + (e as Error).message);
    }
  };

  const saveProfile = async () => {
    try {
      await updateUserProfile(editTeacher, editClass, editSchool);
      onUpdateProfile(editTeacher, editClass, editSchool);
      setIsEditingProfile(false);
    } catch(e) { alert("Lỗi cập nhật profile"); }
  };

  return (
    <div className="bg-slate-50 min-h-full flex flex-col">
      
      {/* --- COLORFUL HEADER --- */}
      <div className="relative z-30 bg-gradient-to-r from-blue-600 to-indigo-700 text-white pt-10 pb-16 px-6 rounded-b-[2.5rem] shadow-xl shadow-blue-900/10">
         {/* Top Bar */}
         <div className="flex justify-between items-start mb-6">
             <div>
                <div className="flex items-center space-x-2 text-blue-200 text-sm font-medium mb-1">
                   <School size={16} />
                   <span className="opacity-90">{schoolName || "Chưa có tên trường"}</span>
                </div>
                <h2 className="text-4xl font-black tracking-tight text-white">{className || "Lớp Mới"}</h2>
                <div className="flex items-center space-x-2 text-blue-200 text-sm font-medium mt-1">
                   <UserCircle size={16} />
                   <span className="opacity-90">{teacherName || "Chưa có tên GV"}</span>
                </div>
             </div>
             <div className="flex gap-2">
               <button onClick={() => { setEditTeacher(teacherName); setEditClass(className); setEditSchool(schoolName); setIsEditingProfile(true); }} className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white">
                  <Settings size={20} />
               </button>
               <button onClick={logoutUser} className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl hover:bg-red-500/80 hover:border-red-500/50 transition-colors text-white">
                  <LogOut size={20} />
               </button>
             </div>
         </div>

         {/* Decorative Circles */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
      </div>
      
      {/* --- OVERLAPPING STATS BAR --- */}
      <div className="px-6 -mt-10 relative z-40 mb-6">
         <div className="bg-white p-2 rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-3">
             <div className="flex-1 bg-slate-50 p-4 rounded-2xl flex items-center border border-slate-100 relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-16 h-16 bg-blue-100 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                 <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 mr-3 shadow-sm ring-1 ring-slate-100 z-10">
                    <Users size={20} />
                 </div>
                 <div className="z-10">
                    <div className="text-xl font-black text-slate-800 leading-none">{students.length}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Học sinh</div>
                 </div>
             </div>
             
             <button onClick={() => setIsAdding(true)} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all hover:bg-slate-800">
                 <UserPlus size={18} className="mr-2"/>
                 Thêm Mới
             </button>
         </div>
      </div>
      
      {/* --- LIST --- */}
      <div className="px-4 space-y-3">
         {students.length === 0 ? (
            <div className="text-center py-20 animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200 rotate-6 border border-slate-100">
                  <User size={40} className="text-slate-300"/>
               </div>
               <h3 className="text-slate-600 font-bold mb-2 text-lg">Danh sách trống</h3>
               <p className="text-slate-400 text-sm px-10">Bấm nút "Thêm Mới" ở trên để bắt đầu nhập dữ liệu học sinh.</p>
            </div>
         ) : (
            students.map((s, index) => (
               <div key={s.id} className="group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 flex items-center">
                  <div className="w-8 flex justify-center">
                    <span className="text-xs font-bold text-slate-300 group-hover:text-blue-500 transition-colors">{index + 1}</span>
                  </div>
                  
                  <div className="relative ml-2">
                     <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-0 group-hover:opacity-20 transition-opacity"></div>
                     <img src={s.referencePhoto} alt={s.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md relative z-10" />
                  </div>
                  
                  <div className="ml-4 flex-1 min-w-0">
                     <h3 className="font-bold text-slate-700 text-base truncate leading-tight group-hover:text-blue-700 transition-colors">{s.name}</h3>
                     <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate uppercase tracking-wider">ID: {s.id.substr(0,8)}</p>
                  </div>
                  
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100 mr-1">
                    <button onClick={() => startEditStudent(s)} className="p-2 mr-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                       <Pencil size={18} />
                    </button>
                    <button onClick={() => removeStudent(s.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                       <Trash2 size={18} />
                    </button>
                  </div>
               </div>
            ))
         )}
      </div>
      
      {/* Spacer to prevent bottom nav overlap */}
      <div className="h-40 shrink-0 w-full"></div>

      {/* --- MODAL EDIT NAME --- */}
      {editingStudent && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="glass-card bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-white">
              <div className="text-center mb-6">
                 <img src={editingStudent.referencePhoto} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-xl shadow-blue-500/20" />
                 <h3 className="text-xl font-black text-slate-800">Đổi Tên Học Sinh</h3>
              </div>
              <input 
                 value={editStudentName} 
                 onChange={e => setEditStudentName(e.target.value)} 
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg mb-6 text-slate-700" 
                 autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setEditingStudent(null)} className="py-3.5 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                 <button onClick={handleUpdateStudentName} className="py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all">Lưu</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL ADD STUDENT --- */}
      {isAdding && (
         <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-10 duration-300 border border-white/50">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-xl z-10">
                  <h2 className="text-2xl font-black text-slate-800">Thêm Học Sinh</h2>
                  <button onClick={() => { setIsAdding(false); stopCamera(); setBatchQueue([]); }} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20}/></button>
               </div>
               
               <div className="p-6 space-y-8">
                  <div className="space-y-4">
                     <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> <span>Thêm Thủ Công</span>
                     </div>
                     <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nhập tên học sinh..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                     <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] overflow-hidden relative group hover:border-blue-400 transition-colors">
                        {tempPhoto ? (
                           <>
                              <img src={tempPhoto} className="w-full h-full object-cover" />
                              <button onClick={()=>setTempPhoto(null)} className="absolute bottom-4 right-4 bg-white/90 text-red-500 p-3 rounded-2xl shadow-lg backdrop-blur hover:scale-105 transition-transform"><Trash2 size={24}/></button>
                           </>
                        ) : cameraActive ? (
                           <div className="w-full h-full relative bg-black">
                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                              <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white p-1.5 rounded-full shadow-xl"><div className="w-16 h-16 rounded-full border-[6px] border-blue-500 bg-white"></div></button>
                           </div>
                        ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                              <button onClick={startCamera} className="px-8 py-4 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl font-bold flex items-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 transition-all"><Camera size={24} className="mr-2"/> Chụp Ảnh</button>
                              <button onClick={()=>fileInputRef.current?.click()} className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold flex items-center hover:bg-slate-50 transition-colors"><Upload size={24} className="mr-2"/> Tải Lên</button>
                              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleSingleFile} />
                           </div>
                        )}
                     </div>
                     <button disabled={!newName || !tempPhoto || isSaving} onClick={saveStudent} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl disabled:opacity-50 hover:shadow-lg hover:shadow-slate-500/30 transition-all">
                        {isSaving ? <Loader2 className="animate-spin mx-auto"/> : "Lưu Học Sinh"}
                     </button>
                  </div>

                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                     <div className="flex items-center space-x-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-4">
                        <FolderUp size={14} /> <span>Nạp Nhanh (Batch)</span>
                     </div>
                     {!batchQueue.length ? (
                        <button onClick={()=>batchInputRef.current?.click()} className="w-full py-4 bg-white text-indigo-600 font-bold rounded-2xl border-2 border-dashed border-indigo-200 flex items-center justify-center hover:bg-indigo-50 transition-colors">
                           <ImagePlus size={24} className="mr-2"/> Chọn nhiều ảnh
                        </button>
                     ) : (
                        <div>
                           <div className="flex justify-between items-center mb-3">
                              <span className="font-bold text-indigo-900 text-sm">{batchQueue.length} ảnh đã chọn</span>
                              <button onClick={()=>setBatchQueue([])} className="text-xs text-red-500 font-bold bg-white px-2 py-1 rounded-lg">Xóa hết</button>
                           </div>
                           <button onClick={executeBatch} disabled={isBatchUploading} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors">
                              {isBatchUploading ? batchProgress : "Bắt đầu tải lên"}
                           </button>
                        </div>
                     )}
                     <input type="file" ref={batchInputRef} hidden multiple accept="image/*" onChange={handleBatchSelect} />
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* --- MODAL EDIT PROFILE --- */}
      {isEditingProfile && (
         <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white">
               <div className="text-center mb-6">
                  <h3 className="text-2xl font-black text-slate-800">Cập Nhật</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Thông tin lớp học</p>
               </div>
               <div className="space-y-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-3 mb-1 block">Giáo viên</label>
                      <input value={editTeacher} onChange={e=>setEditTeacher(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-3 mb-1 block">Lớp (Ví dụ: 10A1)</label>
                      <input value={editClass} onChange={e=>setEditClass(e.target.value.toUpperCase())} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="10A1" />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-3 mb-1 block">Trường</label>
                      <input value={editSchool} onChange={e=>setEditSchool(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4 mt-8">
                  <button onClick={()=>setIsEditingProfile(false)} className="py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Hủy</button>
                  <button onClick={saveProfile} className="py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all">Lưu</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};