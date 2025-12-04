import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Loader2, School, Mail, Lock, UserCircle, ShieldAlert, Copy, Check, 
  Sun, Moon, Building2, LayoutGrid, ScanLine, PieChart, Camera, Sparkles, LogOut
} from 'lucide-react';
import { StudentList } from './components/StudentList';
import { Scanner } from './components/Scanner';
import { Report } from './components/Report';
import { Student, AttendanceRecord, AppTab, AppUser, SessionType } from './types';
import { 
  subscribeToAuthChanges, 
  subscribeToStudents, 
  subscribeToAttendance, 
  loginUser, 
  registerUser,
  markAttendanceBatch,
  toggleAttendanceFirestore,
  logoutUser
} from './services/firebaseService';
import { User } from 'firebase/auth';

// --- Configuration Help Screen ---
const ConfigErrorScreen = () => {
  const [copied, setCopied] = useState(false);
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    match /attendance/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center font-sans">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-8 border border-red-100">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <ShieldAlert size={48} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cấu Hình Bảo Mật</h1>
          <p className="text-slate-500 mt-2">Kết nối cơ sở dữ liệu bị từ chối do thiếu quyền.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-blue-900 text-sm uppercase mb-1">Bước 1: Authentication</h3>
            <p className="text-xs text-blue-700">Firebase Console &gt; Authentication &gt; Sign-in method &gt; Bật <b>Email/Password</b>.</p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
               <h3 className="font-bold text-slate-800 text-sm uppercase">Bước 2: Firestore Rules</h3>
               <button 
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {copied ? <Check size={14}/> : <Copy size={14}/>}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
            </div>
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-2xl text-[10px] overflow-x-auto font-mono leading-relaxed">
              {rules}
            </pre>
          </div>
        </div>
        
        <button onClick={() => window.location.reload()} className="mt-8 w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95">
           Đã Cấu Hình Xong - Tải Lại
        </button>
      </div>
    </div>
  );
};

// --- Auth Component ---
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [schoolName, setSchoolName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        if (!name || !className || !schoolName) throw new Error("Vui lòng điền đầy đủ thông tin.");
        await registerUser(email, password, name, className, schoolName);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Đã có lỗi xảy ra.";
      if (err.code === 'auth/invalid-email') msg = "Email không hợp lệ.";
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = "Sai tài khoản hoặc mật khẩu.";
      if (err.code === 'auth/email-already-in-use') msg = "Email này đã được đăng ký.";
      if (err.code === 'auth/weak-password') msg = "Mật khẩu quá yếu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      
      {/* Animated Background Blobs - Modified for Gradient */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-700 relative z-10 border border-white/60">
        
        <div className="text-center mb-8">
           {/* LOGO */}
           <div className="w-24 h-24 mx-auto mb-6 relative group">
              <div className="absolute inset-0 bg-blue-500 rounded-[1.8rem] rotate-6 opacity-20 group-hover:rotate-12 transition-transform duration-500"></div>
              <div className="w-full h-full rounded-[1.8rem] bg-gradient-to-br from-blue-600 to-indigo-600 relative flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:scale-105 transition-transform duration-500">
                <Sparkles className="text-white w-10 h-10" />
              </div>
           </div>

           <h1 className="text-1xl font-blUE text-slate-800 tracking-tight">{isLogin ? 'PTDTBT THCS THU CÚC' : 'Tạo Tài Khoản'}</h1>

<p className="text-slate-500 text-sm font-medium">Hệ thống điểm danh thông minh</p>
   <p className="text-slate-500 text-xs mt-1">
    Phát triển bởi:
    <span className="ml-1">
        <a href="#" className="text-blue-600 hover:underline">Duy Hạnh</a>
    </span>
    |
    Liên hệ:
    <span className="ml-1">
        <a href="tel:0868640898" className="text-blue-600 hover:underline">0868.640.898</a>
    </span>
    </p>


        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="relative group">
                  <UserCircle className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" placeholder="Họ tên giáo viên" required />
              </div>
              <div className="flex gap-3">
                 <div className="relative group flex-1">
                    <School className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                    <input type="text" value={className} onChange={e=>setClassName(e.target.value.toUpperCase())} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" placeholder="Lớp (10A1)" required />
                 </div>
              </div>
              <div className="relative group">
                  <Building2 className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input type="text" value={schoolName} onChange={e=>setSchoolName(e.target.value)} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" placeholder="Tên trường" required />
              </div>
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" placeholder="Email" required />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400" placeholder="Mật khẩu" required />
          </div>

          {error && (
            <div className="bg-red-50/80 backdrop-blur-sm text-red-600 text-xs font-bold p-3 rounded-xl flex items-center border border-red-100 animate-in slide-in-from-top-2">
              <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0"/>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] flex justify-center items-center">
            {loading ? <Loader2 className="animate-spin" size={20}/> : (isLogin ? 'Đăng Nhập' : 'Đăng Ký Ngay')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">
            {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <span className="text-blue-600 font-bold hover:underline underline-offset-4">{isLogin ? 'Đăng ký' : 'Đăng nhập'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.ROSTER);
  const [isSchoolView, setIsSchoolView] = useState(false);
  
  // Session Logic: Default based on current hour
  const [sessionType, setSessionType] = useState<SessionType>(() => {
    return new Date().getHours() < 12 ? 'AM' : 'PM';
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Derived Session ID
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  const sessionId = `${dateStr}_${sessionType}`;

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      if (u) {
        const parts = u.displayName?.split('|') || [];
        setAppUser({
          uid: u.uid,
          email: u.email,
          displayName: parts[0] || u.email,
          className: parts[1] || '',
          schoolName: parts[2] || ''
        });
        setDbError(false);
      } else {
        setAppUser(null);
        setStudents([]);
        setAttendanceRecords([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listener
  useEffect(() => {
    if (!user) return;

    const handleDbError = (err: any) => {
      if (err.code === 'permission-denied') setDbError(true);
    };

    const queryUid = isSchoolView ? null : user.uid;

    const unsubStudents = subscribeToStudents(queryUid, setStudents, handleDbError);
    const unsubAttendance = subscribeToAttendance(queryUid, null, setAttendanceRecords, handleDbError);

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, [user, isSchoolView]);

  const myStudents = useMemo(() => {
    if (!user) return [];
    if (!isSchoolView) return students;
    return students.filter(s => s.uid === user.uid);
  }, [students, user, isSchoolView]);

  const handleAttendanceUpdate = (newFoundIds: string[]) => {
    if (!user) return;
    const existingIds = attendanceRecords
      .filter(r => r.sessionId === sessionId)
      .map(r => r.studentId);
    
    const idsToAdd = newFoundIds.filter(id => !existingIds.includes(id));
    if (idsToAdd.length > 0) {
      markAttendanceBatch(
        user.uid, 
        sessionId, 
        idsToAdd,
        appUser?.displayName || '',
        appUser?.className || '',
        appUser?.schoolName || ''
      );
    }
  };

  const handleManualToggle = (studentId: string, targetSessionId: string) => {
    if (!user) return;
    toggleAttendanceFirestore(
      user.uid, 
      targetSessionId, 
      studentId, 
      attendanceRecords,
      appUser?.displayName || '',
      appUser?.className || '',
      appUser?.schoolName || ''
    );
  };

  const handleUpdateProfile = (n: string, c: string, s: string) => {
    if (appUser) setAppUser({ ...appUser, displayName: n, className: c, schoolName: s });
  };

  const handleSwitchToScanner = () => {
    setCurrentTab(AppTab.SCANNER);
  };

  // --- Render ---
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
  if (dbError) return <ConfigErrorScreen />;
  if (!user) return <AuthScreen />;

  // Navigation Item Component
  const isScanner = currentTab === AppTab.SCANNER;
  
  const NavItem = ({ tab, icon: Icon, label }: { tab: AppTab, icon: any, label: string }) => {
    const isActive = currentTab === tab;
    // Determine colors based on active state AND whether we are in Scanner mode (dark) or Light mode
    const activeColor = isScanner ? 'text-blue-400' : 'text-blue-600';
    const inactiveColor = isScanner ? 'text-slate-500' : 'text-slate-400';
    const bgColor = isScanner ? 'bg-white/10' : 'bg-blue-50';

    return (
      <button 
        onClick={() => setCurrentTab(tab)}
        className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 group`}
      >
        <div className={`relative p-1.5 rounded-2xl transition-all duration-300 ${isActive ? `${bgColor} -translate-y-1` : ''}`}>
           <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? activeColor : inactiveColor} />
        </div>
        <span className={`text-[10px] font-bold mt-1 transition-colors ${isActive ? activeColor : inactiveColor}`}>
           {label}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-slate-50 h-[100dvh] font-sans selection:bg-blue-100 relative overflow-hidden flex flex-col">
      
      {/* Background Decor - Only visible for transparency */}
      <div className="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-100/30 to-transparent -z-10 pointer-events-none"></div>

      {/* Main Content Area - Full width within constraint */}
      <main className="max-w-md mx-auto w-full h-full relative bg-white/95 sm:my-4 sm:h-[calc(100vh-2rem)] sm:rounded-[2.5rem] overflow-hidden border border-white shadow-2xl shadow-slate-300/50 flex flex-col ring-1 ring-slate-100">
         
         {/* Scrollable Content Region */}
         <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar flex flex-col">
            {currentTab === AppTab.ROSTER && (
              <StudentList 
                students={myStudents} 
                uid={user.uid} 
                className={appUser?.className || ''} 
                teacherName={appUser?.displayName || ''}
                schoolName={appUser?.schoolName || ''}
                onUpdateProfile={handleUpdateProfile}
              />
            )}
            
            {currentTab === AppTab.SCANNER && (
              <Scanner 
                students={myStudents} 
                sessionId={sessionId}
                attendanceRecords={attendanceRecords}
                onAttendanceUpdate={handleAttendanceUpdate}
                className={appUser?.className || ''}
                schoolName={appUser?.schoolName || ''}
                sessionType={sessionType}
              />
            )}
            
            {currentTab === AppTab.REPORT && (
              <Report 
                students={students} 
                attendanceRecords={attendanceRecords}
                currentDateStr={dateStr}
                onToggleStatus={handleManualToggle}
                onSwitchToScanner={handleSwitchToScanner}
                appUser={appUser!}
                isSchoolView={isSchoolView}
                onToggleSchoolView={setIsSchoolView}
              />
            )}
         </div>

         {/* Fixed Bottom Navigation - Standard Tab Bar */}
         <div className={`absolute bottom-0 left-0 right-0 z-50 border-t pb-safe transition-colors duration-300 ${
             isScanner 
               ? 'bg-black/80 backdrop-blur-xl border-white/10' 
               : 'bg-white/95 backdrop-blur-xl border-slate-200'
         }`}>
            <div className="flex items-center justify-between px-6 py-2">
               <div className="flex-1">
                  <NavItem tab={AppTab.ROSTER} icon={LayoutGrid} label="Danh sách" />
               </div>
               <div className="flex-1">
                  <NavItem tab={AppTab.SCANNER} icon={ScanLine} label="Quét AI" />
               </div>
               <div className="flex-1">
                  <NavItem tab={AppTab.REPORT} icon={PieChart} label="Báo cáo" />
               </div>
               
               <div className={`w-px h-8 mx-2 ${isScanner ? 'bg-white/10' : 'bg-slate-200'}`}></div>
               
               <div className="flex-1 flex justify-center">
                   <button 
                      onClick={() => setSessionType(prev => prev === 'AM' ? 'PM' : 'AM')}
                      className={`flex flex-col items-center justify-center w-full h-full group`}
                   >
                      <div className={`p-1.5 rounded-2xl transition-all ${
                          sessionType === 'AM' 
                            ? (isScanner ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100/50 text-amber-500') 
                            : (isScanner ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100/50 text-indigo-500')
                      }`}>
                          {sessionType === 'AM' ? <Sun size={24} className="fill-current"/> : <Moon size={24} className="fill-current"/>}
                      </div>
                      <span className={`text-[10px] font-bold mt-1 ${isScanner ? 'text-slate-400' : 'text-slate-400'}`}>
                         {sessionType === 'AM' ? 'Sáng' : 'Chiều'}
                      </span>
                   </button>
               </div>
            </div>
         </div>
      </main>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
