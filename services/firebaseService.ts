import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { Student, AttendanceRecord } from "../types";

// --- HELPER: Data Normalization ---
// Giúp dữ liệu nhất quán: Lớp " 10a1 " -> "10A1"
const normalizeText = (text: string) => text.trim();
const normalizeClass = (text: string) => text.trim().toUpperCase().replace(/\s+/g, ''); // 10 A1 -> 10A1

// --- Authentication ---

export const registerUser = async (email: string, pass: string, name: string, className: string, schoolName: string) => {
  // Default to local persistence for registration
  await setPersistence(auth, browserLocalPersistence);
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  
  const cleanName = normalizeText(name);
  const cleanClass = normalizeClass(className);
  const cleanSchool = normalizeText(schoolName);

  // Store className and schoolName in displayName: "Name|ClassName|SchoolName"
  await updateProfile(userCredential.user, {
    displayName: `${cleanName}|${cleanClass}|${cleanSchool}`
  });
  return userCredential.user;
};

export const loginUser = async (email: string, pass: string, remember: boolean = true) => {
  const persistenceMode = remember ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistenceMode);
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const updateUserProfile = async (newName: string, newClassName: string, newSchoolName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  
  const cleanName = normalizeText(newName);
  const cleanClass = normalizeClass(newClassName);
  const cleanSchool = normalizeText(newSchoolName);

  // Update Name, Class, and School using the separator format
  await updateProfile(user, {
    displayName: `${cleanName}|${cleanClass}|${cleanSchool}`
  });
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// --- Firestore Data ---

// 1. Students
export const subscribeToStudents = (
  uid: string | null, 
  callback: (students: Student[]) => void,
  onError?: (error: any) => void
) => {
  // If uid is null, we fetch ALL students (School View)
  // If uid is provided, we fetch only that teacher's students
  let q;
  if (uid) {
    q = query(
      collection(db, "students"), 
      where("uid", "==", uid)
    );
  } else {
    q = query(collection(db, "students"));
  }

  return onSnapshot(q, 
    (snapshot) => {
      const students: Student[] = [];
      snapshot.forEach((doc) => {
        students.push({ id: doc.id, ...doc.data() } as Student);
      });
      
      // Sort client-side: Vietnamese Name Sorting (Tên -> Họ)
      students.sort((a, b) => {
        const getNameParts = (fullName: string) => {
          const parts = fullName.trim().split(/\s+/);
          const firstName = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : '';
          return { firstName, full: fullName.toLowerCase() };
        };
        
        const aP = getNameParts(a.name);
        const bP = getNameParts(b.name);
        
        // Primary: Sort by First Name (Tên)
        const nameCompare = aP.firstName.localeCompare(bP.firstName, 'vi');
        if (nameCompare !== 0) return nameCompare;
        
        // Secondary: Sort by Full Name (Họ đệm)
        return aP.full.localeCompare(bP.full, 'vi');
      });
      
      callback(students);
    },
    (error) => {
      console.error("Firestore Error (Students):", error);
      if (onError) onError(error);
    }
  );
};

export const addStudentToFirestore = async (
  uid: string, 
  name: string, 
  photo: string,
  teacherName: string,
  className: string,
  schoolName: string
) => {
  const cleanClass = normalizeClass(className);
  const cleanSchool = normalizeText(schoolName);
  const cleanTeacher = normalizeText(teacherName);
  const cleanStudentName = normalizeText(name);

  await addDoc(collection(db, "students"), {
    uid,
    name: cleanStudentName,
    referencePhoto: photo,
    createdAt: Date.now(),
    teacherName: cleanTeacher,
    className: cleanClass,
    schoolName: cleanSchool
  });
};

export const updateStudentName = async (id: string, newName: string) => {
  const cleanStudentName = normalizeText(newName);
  if (!cleanStudentName) throw new Error("Tên không được để trống");
  
  await updateDoc(doc(db, "students", id), {
    name: cleanStudentName
  });
};

export const deleteStudentFromFirestore = async (id: string) => {
  await deleteDoc(doc(db, "students", id));
};

// 2. Attendance
export const subscribeToAttendance = (
  uid: string | null, 
  sessionId: string | null, // Made nullable to fetch all history
  callback: (records: AttendanceRecord[]) => void,
  onError?: (error: any) => void
) => {
  // Logic: 
  // If uid provided -> Filter by teacher.
  // If sessionId provided -> Filter by session (Single day view).
  // If sessionId is NULL -> Fetch ALL history (Report view).

  const constraints = [];
  if (uid) constraints.push(where("uid", "==", uid));
  if (sessionId) constraints.push(where("sessionId", "==", sessionId));

  const q = query(collection(db, "attendance"), ...constraints);

  return onSnapshot(q, 
    (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      callback(records);
    },
    (error) => {
      console.error("Firestore Error (Attendance):", error);
      if (onError) onError(error);
    }
  );
};

export const markAttendanceBatch = async (
  uid: string, 
  sessionId: string, 
  studentIds: string[],
  teacherName: string,
  className: string,
  schoolName: string
) => {
  const cleanClass = normalizeClass(className);
  const cleanSchool = normalizeText(schoolName);
  const cleanTeacher = normalizeText(teacherName);

  const batchPromises = studentIds.map(async (studentId) => {
    await addDoc(collection(db, "attendance"), {
      uid,
      sessionId,
      studentId,
      timestamp: Date.now(),
      teacherName: cleanTeacher,
      className: cleanClass,
      schoolName: cleanSchool
    });
  });
  
  await Promise.all(batchPromises);
};

export const toggleAttendanceFirestore = async (
  uid: string, 
  sessionId: string, 
  studentId: string, 
  currentRecords: AttendanceRecord[],
  teacherName: string,
  className: string,
  schoolName: string
) => {
  const existing = currentRecords.find(r => r.sessionId === sessionId && r.studentId === studentId);
  
  const cleanClass = normalizeClass(className);
  const cleanSchool = normalizeText(schoolName);
  const cleanTeacher = normalizeText(teacherName);

  if (existing && existing.id) {
    await deleteDoc(doc(db, "attendance", existing.id));
  } else {
    await addDoc(collection(db, "attendance"), {
      uid,
      sessionId,
      studentId,
      timestamp: Date.now(),
      teacherName: cleanTeacher,
      className: cleanClass,
      schoolName: cleanSchool
    });
  }
};