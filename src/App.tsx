import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BookOpen, LogOut, Download, Clock, FileText, Trash2, Lock, 
  Plus, Users, Search, XCircle, Phone, Book, Settings, Upload, 
  Image as ImageIcon, Key, CheckCircle, AlertCircle, X, Filter, MapPin, Pencil, Camera, ChevronDown, ChevronUp, Megaphone, Eye, EyeOff, Loader2, Wifi, Database
} from 'lucide-react';

// --- KONFIGURASI SUPABASE (REST API MODE) ---
// ⚠️ GANTI DENGAN DATA DARI MENU SETTINGS -> API DI DASHBOARD SUPABASE ANDA ⚠️
const SUPABASE_URL = "https://ldqasynrlfcvdwzcftgb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkcWFzeW5ybGZjdmR3emNmdGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDk4MDgsImV4cCI6MjA4MzAyNTgwOH0.dgFEllY2AEIAuHKbpHMvQy87APDTGVL4453EpbDjHw8";

// --- Helper: Supabase Fetch Wrapper (Tanpa Library Tambahan) ---
// Fungsi ini menggantikan @supabase/supabase-js agar tidak perlu npm install
const supabaseFetch = async (endpoint: string, method: string = 'GET', body?: any) => {
  if (SUPABASE_URL.includes("ganti-dengan")) return { data: null, error: { message: "Config belum diisi" } };

  const headers: any = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation' // Agar return data setelah insert/update
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || response.statusText);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// --- KONSTANTA ---
const MAPEL_LIST = [
  "Matematika", "Bahasa Inggris", "IPA", "IPS", "PKN", "PJOK", "BTQ", 
  "B. Sunda", "B. Indonesia", "Bahasa Arab", "Al-Quran Hadis", "Fiqih",
  "Sejarah Kebudayaan Islam", "Seni Budaya", "BK", "TIK"
];

const EKSKUL_LIST = [
  "Pramuka", "Broadcasting", "Futsal", "Badminton", "Hadroh", "Paskibra", "PMR", "KIR", "Marawis"
];

// --- Helper: Kompresi Gambar ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 150 / Math.max(img.width, img.height); 
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
            reject(new Error("Canvas context null"));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Helper: Hitung Jarak (Haversine) ---
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const toRad = (val: number) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Tipe Data ---
type UserRole = 'Guru' | 'Staf' | 'Admin';
type AttendanceType = 'HADIR' | 'MASUK_KELAS' | 'INVAL' | 'KELUAR_KELAS' | 'IZIN' | 'PULANG';

interface UserAccount {
  id: string; // UUID/String
  name: string;
  role: UserRole;
  password: string; 
  phone?: string;   
  subjects?: string;
  photo?: string;
}

interface AttendanceRecord {
  id: string;
  name: string;
  role: UserRole;
  type: AttendanceType;
  subject?: string;
  note?: string;
  timestamp: string;
  location?: string;
  distance?: number; 
}

interface SchoolSettings {
  name: string;
  logo: string;
  allowedIp?: string; 
  restrictWifi?: boolean;
  schoolLat?: number;
  schoolLng?: number;
  restrictLocation?: boolean;
  radiusMeter?: number;
}

interface Announcement {
  id: string;
  text: string;
  createdAt: string;
}

// --- Komponen Toast ---
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white animate-in slide-in-from-top-5 duration-300 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={16} /></button>
    </div>
  );
}

// --- Subject Selector ---
const SubjectSelector = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedSubjects = value ? value.split(',').map(s => s.trim()) : [];

  const toggleSubject = (subject: string) => {
    const newSubjects = selectedSubjects.includes(subject)
      ? selectedSubjects.filter(s => s !== subject)
      : [...selectedSubjects, subject];
    onChange(newSubjects.join(', '));
  };

  return (
    <div className="border border-slate-300 rounded-lg bg-white relative">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 bg-slate-50 flex justify-between items-center text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
      >
        <span>Pilih Mapel & Ekskul ({selectedSubjects.length})</span>
        {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-3 max-h-60 overflow-y-auto">
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Mata Pelajaran Umum</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MAPEL_LIST.map(mapel => (
                <label key={mapel} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1.5 rounded border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={selectedSubjects.includes(mapel)}
                    onChange={() => toggleSubject(mapel)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="text-slate-700">{mapel}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="border-t pt-3 mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ekstrakurikuler</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EKSKUL_LIST.map(eskul => (
                <label key={eskul} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1.5 rounded border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={selectedSubjects.includes(eskul)}
                    onChange={() => toggleSubject(eskul)}
                    className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
                  />
                  <span className="text-slate-700">{eskul}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="sticky bottom-0 pt-3 pb-1 bg-white border-t mt-2 flex justify-end">
            <button 
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"
            >
              <CheckCircle size={14} /> Selesai
            </button>
          </div>
        </div>
      )}
      
      {selectedSubjects.length > 0 && !isOpen && (
        <div className="p-2 border-t border-slate-100 flex flex-wrap gap-1 bg-slate-50 rounded-b-lg">
          {selectedSubjects.map(s => (
            <span key={s} className="bg-white text-blue-700 text-[10px] px-2 py-0.5 rounded-full border border-blue-200 shadow-sm">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Running Text ---
const RunningText = ({ announcements }: { announcements: Announcement[] }) => {
  if (announcements.length === 0) return null;
  const textContent = announcements.map(a => a.text).join("  *** ");
  return (
    <div className="bg-yellow-100 border-b border-yellow-200 overflow-hidden relative h-10 flex items-center mb-4 rounded-lg shadow-sm mx-auto max-w-6xl w-full">
      <div className="absolute left-0 top-0 bottom-0 bg-yellow-200 z-10 px-2 flex items-center shadow-md">
        <Megaphone size={16} className="text-yellow-800" />
      </div>
      <div className="whitespace-nowrap animate-marquee pl-10 pr-4 text-sm font-medium text-yellow-800">
        {textContent} {textContent.length < 50 ? ` *** ${textContent} *** ${textContent}` : ''}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

// --- Komponen Utama ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
        const saved = localStorage.getItem('school_attendance_active_session');
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }); 

  const [currentView, setCurrentView] = useState<'LOGIN' | 'DASHBOARD' | 'ADMIN'>(currentUser ? (currentUser.role === 'Admin' ? 'ADMIN' : 'DASHBOARD') : 'LOGIN');
  
  // Data State
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({ 
    name: 'MTS Plus Elyaqien', logo: '', restrictWifi: false, restrictLocation: false, radiusMeter: 50 
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [configError, setConfigError] = useState(false);
  
  // State Ganti Password
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);
  const [newSelfPassword, setNewSelfPassword] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  // --- INIT DATA (SUPABASE REST) ---
  useEffect(() => {
    // Cek Config Dummy
    if (SUPABASE_URL.includes("ganti-dengan") || SUPABASE_ANON_KEY.includes("ganti-dengan")) {
        setConfigError(true);
        setLoadingData(false);
        return;
    }

    const fetchData = async () => {
        setLoadingData(true);
        
        // 1. Fetch Users
        const { data: userData } = await supabaseFetch('users?select=*');
        
        // --- LOGIKA AUTO-CREATE ADMIN ---
        if (userData && Array.isArray(userData) && userData.length > 0) {
            setUsers(userData as UserAccount[]);
        } else {
            // Jika Database kosong, buat user Admin default
            console.log("Database user kosong. Membuat Admin default...");
            const defaultAdmin = {
                name: 'Admin Sekolah',
                role: 'Admin',
                password: 'admin',
                phone: '08123456789',
                subjects: '-'
            };
            
            // Insert ke Supabase
            await supabaseFetch('users', 'POST', defaultAdmin);
            
            // Fetch lagi untuk memastikan user masuk
            const { data: newUserData } = await supabaseFetch('users?select=*');
            if (newUserData) setUsers(newUserData as UserAccount[]);
        }

        // 2. Fetch Records (Sort descending)
        const { data: recData } = await supabaseFetch('records?select=*&order=timestamp.desc&limit=500');
        if (recData) setRecords(recData as AttendanceRecord[]);

        // 3. Fetch Settings (Simpel: dari local storage atau default untuk versi REST)
        // Jika mau dari DB, buat table 'settings' di Supabase
        
        // 4. Fetch Announcements
        const { data: annData } = await supabaseFetch('announcements?select=*&order=createdAt.desc');
        if (annData) setAnnouncements(annData as Announcement[]);

        setLoadingData(false);
    };

    fetchData();
    
    // Polling sederhana pengganti Realtime
    const interval = setInterval(fetchData, 30000); 
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS (SUPABASE REST) ---

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentView(user.role === 'Admin' ? 'ADMIN' : 'DASHBOARD');
    showToast(`Selamat datang, ${user.name}`, 'success');
    localStorage.setItem('school_attendance_active_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('LOGIN');
    showToast('Berhasil keluar', 'success');
    localStorage.removeItem('school_attendance_active_session');
  };

  const addRecord = async (recordData: Omit<AttendanceRecord, 'id' | 'timestamp'>) => {
    const payload = {
        ...recordData,
        timestamp: new Date().toISOString()
    };
    
    const { error } = await supabaseFetch('records', 'POST', payload);
    
    if (error) {
        console.error(error);
        showToast(`Gagal absen: ${error.message || 'Error'}`, 'error');
    } else {
        showToast('Absensi berhasil dicatat (Cloud)', 'success');
        // Refresh manual
        const { data } = await supabaseFetch('records?select=*&order=timestamp.desc&limit=500');
        if(data) setRecords(data);
    }
  };

  const addUser = async (userData: Omit<UserAccount, 'id'>) => {
    // Validasi nama lokal dulu
    if (users.some(u => u.name.toLowerCase() === userData.name.toLowerCase())) {
        return showToast('Nama sudah ada!', 'error');
    }

    const { error } = await supabaseFetch('users', 'POST', userData);
    if (error) {
        showToast(`Gagal: ${error.message || 'Error'}`, 'error');
    } else {
        showToast('User berhasil ditambahkan', 'success');
        const { data } = await supabaseFetch('users?select=*');
        if(data) setUsers(data);
    }
  };

  const updateUser = async (id: string, updates: Partial<UserAccount>) => {
    const { error } = await supabaseFetch(`users?id=eq.${id}`, 'PATCH', updates);
    if (error) showToast('Gagal update', 'error');
    else {
        showToast('Data diperbarui', 'success');
        const { data } = await supabaseFetch('users?select=*');
        if(data) setUsers(data);
    }
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabaseFetch(`users?id=eq.${id}`, 'DELETE');
    if (error) showToast('Gagal hapus', 'error');
    else {
        showToast('User dihapus', 'success');
        setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const addAnnouncement = async (text: string) => {
    await supabaseFetch('announcements', 'POST', { text, createdAt: new Date().toISOString() });
    showToast('Info ditambahkan', 'success');
    const { data } = await supabaseFetch('announcements?select=*&order=createdAt.desc');
    if(data) setAnnouncements(data);
  };

  const deleteAnnouncement = async (id: string) => {
    await supabaseFetch(`announcements?id=eq.${id}`, 'DELETE');
    showToast('Info dihapus', 'success');
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // --- Render ---

  if (configError) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <Database className="text-blue-600 mb-4" size={60} />
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Setup Supabase Diperlukan</h1>
              <p className="text-slate-600 max-w-md mb-4">
                  Anda belum memasukkan URL dan API Key dari Supabase.
              </p>
              <div className="text-left bg-white p-4 rounded border text-sm space-y-2">
                  <p>1. Buka <b>App.tsx</b> di laptop.</p>
                  <p>2. Cari baris paling atas (SUPABASE_URL).</p>
                  <p>3. Masukkan data dari Settings - API di dashboard Supabase.</p>
              </div>
          </div>
      );
  }

  if (loadingData) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
              <Loader2 className="animate-spin text-blue-600" size={40} />
              <p className="text-slate-500 font-medium">Menghubungkan ke Database Cloud...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Modal Ganti Password Sendiri */}
      {showSelfPasswordModal && currentUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold flex items-center gap-2"><Key size={18}/> Ubah Password Saya</h3>
              <button onClick={() => setShowSelfPasswordModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={(e) => {
                e.preventDefault();
                if(newSelfPassword) {
                    updateUser(currentUser.id, { password: newSelfPassword });
                    setShowSelfPasswordModal(false);
                    setNewSelfPassword('');
                }
            }} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Masukkan password baru untuk akun <b>{currentUser.name}</b>:</p>
              <input 
                type="text" 
                value={newSelfPassword} 
                onChange={e => setNewSelfPassword(e.target.value)} 
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Password Baru" 
                autoFocus 
              />
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md">Simpan Password Baru</button>
            </form>
          </div>
        </div>
      )}

      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {schoolSettings.logo ? (
              <img src={schoolSettings.logo} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-full p-0.5" />
            ) : (
              <BookOpen size={28} />
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight">{schoolSettings.name}</h1>
              <div className="flex items-center gap-1 opacity-80">
                <span className="text-[10px] uppercase tracking-wider hidden md:block">Sistem Absensi Terpadu</span>
                <span className="bg-emerald-400/20 px-1.5 rounded text-[10px] flex items-center gap-1 border border-emerald-300/30 text-emerald-100">
                    <Wifi size={10} /> Cloud DB
                </span>
              </div>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs md:text-sm font-bold bg-blue-800/50 px-2 py-0.5 rounded">
                  {currentUser.name}
                </span>
                <span className="text-[10px] opacity-80 uppercase tracking-wide">
                  {currentUser.role}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 overflow-hidden flex items-center justify-center">
                  {currentUser.photo ? (
                    <img src={currentUser.photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={16} />
                  )}
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowSelfPasswordModal(true)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                  title="Ganti Password Saya"
                >
                  <Key size={18} />
                </button>
                <button 
                  onClick={handleLogout} 
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                  title="Keluar"
                >
                  <LogOut size={18} /> 
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-4 pb-20">
        <RunningText announcements={announcements} />

        {currentView === 'LOGIN' && <LoginView users={users} onLogin={handleLogin} schoolName={schoolSettings.name} showToast={showToast} />}
        {currentView === 'DASHBOARD' && currentUser && (
          <UserDashboard 
            user={currentUser} 
            schoolSettings={schoolSettings}
            onSubmit={addRecord} 
            history={records.filter(r => r.name === currentUser.name)} 
            showToast={showToast}
            onUpdatePhoto={(photo) => updateUser(currentUser.id, { photo })}
          />
        )}
        {currentView === 'ADMIN' && (
          <AdminDashboard 
            records={records} 
            users={users}
            schoolSettings={schoolSettings}
            announcements={announcements}
            onUpdateSettings={setSchoolSettings} // Settings di handle lokal dl utk Supabase simpel
            onClear={() => {}} // Disable clear all di mode cloud demi keamanan
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onAddAnnouncement={addAnnouncement}
            onDeleteAnnouncement={deleteAnnouncement}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

// --- SUB COMPONENTS (LOGIN, DASHBOARD, ADMIN) ---
// Bagian ini sama persis secara UI, hanya logic data di atas yang berubah.
// Saya sertakan full agar Anda tinggal copy paste tanpa pusing.

function LoginView({ users, onLogin, schoolName, showToast }: { users: UserAccount[], onLogin: (user: UserAccount) => void, schoolName: string, showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [role, setRole] = useState<UserRole>('Guru');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const filteredUsers = users.filter(u => u.role === role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return showToast('Mohon lengkapi data', 'error');

    const userFound = users.find(u => 
      u.name.toLowerCase() === name.toLowerCase() && 
      u.password === password
    );

    if (userFound) {
      if (userFound.role !== role) {
        return showToast(`Salah peran! ${userFound.name} adalah ${userFound.role}.`, 'error');
      }
      onLogin(userFound);
    } else {
      showToast('Password salah atau user tidak ditemukan', 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 mt-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Login Sistem</h2>
        <p className="text-sm text-slate-500 mt-1">{schoolName}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Pilih Peran Anda</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Guru', 'Staf', 'Admin'] as UserRole[]).map(r => (
              <button key={r} type="button" onClick={() => { setRole(r); setName(''); setPassword(''); }}
                className={`py-2 text-sm rounded-lg border font-medium transition-all ${role === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Nama Lengkap</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              list="user-list"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ketik nama..."
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
            <datalist id="user-list">
              {filteredUsers.map((u, idx) => (
                <option key={`${u.id}-${idx}`} value={u.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 hover:text-blue-600"
            >
              {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 transition-transform">
          Masuk
        </button>
      </form>
    </div>
  );
}

function UserDashboard({ user, onSubmit, history, showToast, schoolSettings, onUpdatePhoto }: { 
  user: UserAccount; 
  schoolSettings: SchoolSettings;
  onSubmit: (data: any) => void;
  history: AttendanceRecord[];
  showToast: (msg: string, type: 'success' | 'error') => void;
  onUpdatePhoto: (photo: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'FORM' | 'REPORT' | 'PROFILE'>('FORM');
  const [type, setType] = useState<AttendanceType>('HADIR');
  const [selectedMapel, setSelectedMapel] = useState('');
  const [kelas, setKelas] = useState('');
  const [note, setNote] = useState('');
  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDayName = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long' });
  };

  const today = new Date().toLocaleDateString('id-ID');
  const todayRecords = history.filter(r => new Date(r.timestamp).toLocaleDateString('id-ID') === today);
  const hasClockedIn = todayRecords.some(r => r.type === 'HADIR');
  const hasGoneHome = todayRecords.some(r => r.type === 'PULANG'); 
  const lastClassRecord = todayRecords.find(r => ['MASUK_KELAS', 'INVAL', 'KELUAR_KELAS'].includes(r.type));
  const isTeaching = lastClassRecord && (lastClassRecord.type === 'MASUK_KELAS' || lastClassRecord.type === 'INVAL');

  const validTypesList: AttendanceType[] = (() => {
    if (!hasClockedIn) return ['HADIR', 'IZIN'];
    let valid: AttendanceType[] = ['PULANG', 'IZIN'];
    if (isTeaching) valid = ['KELUAR_KELAS'];
    else {
      if (user.role === 'Guru') { valid.unshift('INVAL'); valid.unshift('MASUK_KELAS'); } 
      else if (user.role === 'Staf') { valid.unshift('INVAL'); }
    }
    return valid;
  })();

  const mySubjects = useMemo(() => {
    if (!user.subjects) return [];
    return user.subjects.split(',').map(s => s.trim()).filter(s => s !== '');
  }, [user.subjects]);

  const myRegularMapel = mySubjects.filter(s => MAPEL_LIST.includes(s));
  const myEkskul = mySubjects.filter(s => EKSKUL_LIST.includes(s));
  const myCustomMapel = mySubjects.filter(s => !MAPEL_LIST.includes(s) && !EKSKUL_LIST.includes(s));

  useEffect(() => {
     if (!validTypesList.includes(type)) setType(validTypesList[0]);
  }, [hasClockedIn, isTeaching]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isClassActivity = ['MASUK_KELAS', 'INVAL'].includes(type);
    if (isClassActivity && (!selectedMapel || !kelas)) return showToast('Mohon pilih Mapel dan isi Kelas', 'error');
    if (type === 'IZIN' && !note) return showToast('Mohon isi Keterangan Izin', 'error');

    let userLocation = '';
    let calculatedDistance = 0;

    if (schoolSettings.restrictLocation && schoolSettings.schoolLat && schoolSettings.schoolLng) {
      if (!navigator.geolocation) return showToast("Browser tidak dukung GPS", 'error');
      setIsLoadingLoc(true);
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        userLocation = `${userLat}, ${userLng}`;
        const distance = getDistanceInMeters(schoolSettings.schoolLat, schoolSettings.schoolLng, userLat, userLng);
        calculatedDistance = distance;
        if (distance > (schoolSettings.radiusMeter || 50)) {
          setIsLoadingLoc(false);
          return showToast(`Gagal! Di luar radius sekolah. Jarak: ${Math.round(distance)}m.`, 'error');
        }
      } catch {
        setIsLoadingLoc(false);
        return showToast("Gagal ambil lokasi. Izinkan GPS!", 'error');
      }
      setIsLoadingLoc(false);
    } 

    const finalSubject = isClassActivity ? `${selectedMapel} - ${kelas}` : undefined;
    onSubmit({
      name: user.name,
      role: user.role,
      type,
      subject: finalSubject,
      note: note || undefined,
      location: userLocation,
      distance: calculatedDistance > 0 ? Math.floor(calculatedDistance) : undefined
    });
    setSelectedMapel(''); setKelas(''); setNote('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return showToast("Foto maks 2MB", 'error');
      try {
        const compressed = await compressImage(file);
        onUpdatePhoto(compressed);
        showToast("Foto diperbarui!", 'success');
      } catch (e) { showToast("Gagal proses foto", 'error'); }
    }
  };

  const downloadMyReport = () => {
    downloadExcelData(history, `Laporan_Saya_${user.name}.xls`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex gap-2">
        <button onClick={() => setActiveTab('FORM')} className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'FORM' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
          <FileText size={16}/> Absensi
        </button>
        <button onClick={() => setActiveTab('REPORT')} className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'REPORT' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
          <Clock size={16}/> Laporan
        </button>
        <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'PROFILE' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
          <Users size={16}/> Profil
        </button>
      </div>

      {activeTab === 'FORM' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
            <div className="mb-4 pb-4 border-b border-slate-100 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600" /> Form Absensi</h3>
                    <div className="mt-2 mb-2"><p className="text-base font-semibold text-slate-700">Halo, {user.name} 👋</p></div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">{user.phone && <span className="flex gap-1 items-center"><Phone size={12}/> {user.phone}</span>}{user.subjects && <span className="flex gap-1 items-center"><Book size={12}/> {user.subjects}</span>}</div>
                </div>
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50">
                    {user.photo ? <img src={user.photo} alt="User" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Users size={24}/></div>}
                  </div>
                  <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white"/></div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload}/>
                </div>
            </div>

            {hasGoneHome ? (
              <div className="bg-green-50 p-6 rounded-lg text-center border border-green-200">
                <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-3 text-green-600"><Lock size={32} /></div>
                <h3 className="font-bold text-slate-800">Absensi Selesai</h3>
                <p className="text-sm text-slate-600 mt-1">Sampai jumpa besok!</p>
              </div>
            ) : (
              <>
                <div className={`mb-6 p-4 rounded-lg border-l-4 text-sm ${hasClockedIn ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex justify-between"><span className="font-medium">Status:</span><span className={hasClockedIn ? "text-green-700 font-bold" : "text-slate-500"}>{hasClockedIn ? "SUDAH DATANG" : "BELUM ABSEN"}</span></div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Pilih Aktivitas</label>
                    <select value={type} onChange={(e) => setType(e.target.value as AttendanceType)} className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                      {validTypesList.includes('HADIR') && <option value="HADIR">✅ Absen Datang</option>}
                      {validTypesList.includes('MASUK_KELAS') && <option value="MASUK_KELAS">🏫 Masuk Kelas</option>}
                      {validTypesList.includes('INVAL') && <option value="INVAL">🔁 Inval (Pengganti)</option>}
                      {validTypesList.includes('KELUAR_KELAS') && <option value="KELUAR_KELAS">🏁 Keluar Kelas</option>}
                      {validTypesList.includes('PULANG') && <option value="PULANG">🏠 Absen Pulang</option>}
                      {validTypesList.includes('IZIN') && <option value="IZIN">⚠️ Izin / Sakit</option>}
                    </select>
                  </div>
                  {(type === 'MASUK_KELAS' || type === 'INVAL') && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Mata Pelajaran</label>
                        <select value={selectedMapel} onChange={(e) => setSelectedMapel(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" required>
                            <option value="">-- Pilih Mapel --</option>
                            {type === 'MASUK_KELAS' ? (mySubjects.length > 0 ? (
                                    <>
                                        {(myRegularMapel.length > 0 || myCustomMapel.length > 0) && <optgroup label="Akademik">{myRegularMapel.map(m => <option key={m} value={m}>{m}</option>)}{myCustomMapel.map(m => <option key={m} value={m}>{m}</option>)}</optgroup>}
                                        {myEkskul.length > 0 && <optgroup label="Ekstrakurikuler">{myEkskul.map(m => <option key={m} value={m}>{m}</option>)}</optgroup>}
                                    </>
                                ) : <option disabled>Tidak ada mapel terdaftar</option>
                            ) : (<><optgroup label="Mata Pelajaran">{MAPEL_LIST.map(m => <option key={m} value={m}>{m}</option>)}</optgroup><optgroup label="Ekstrakurikuler">{EKSKUL_LIST.map(e => <option key={e} value={e}>{e}</option>)}</optgroup></>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Kelas</label>
                        <input type="text" value={kelas} onChange={(e) => setKelas(e.target.value)} placeholder="Contoh: X-A, VII-B" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-2">{['MASUK_KELAS', 'INVAL'].includes(type) ? "Materi Pembelajaran" : "Catatan Tambahan"}</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'IZIN' ? "Alasan izin..." : "Isi materi atau catatan..."} className="w-full p-3 border border-slate-300 rounded-lg h-24 focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <button type="submit" disabled={isLoadingLoc} className={`w-full text-white font-bold py-3.5 rounded-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 ${isLoadingLoc ? 'bg-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {isLoadingLoc ? 'Memeriksa Lokasi...' : 'Kirim Absensi'}
                  </button>
                  {schoolSettings.restrictLocation && <p className="text-xs text-center text-slate-400 mt-2 flex items-center justify-center gap-1"><MapPin size={12}/> Wajib berada di radius {schoolSettings.radiusMeter}m sekolah</p>}
                </form>
              </>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-slate-200 h-fit">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><FileText className="text-orange-500" /> Riwayat Hari Ini</h3>
            <div className="space-y-3">
              {todayRecords.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Belum ada aktivitas hari ini.</p>
              ) : (todayRecords.map((r, idx) => (
                  <div key={`${r.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className={`font-bold px-2 py-0.5 rounded text-xs ${getTypeColor(r.type)}`}>{formatType(r.type)}</span>
                      <div className="flex flex-col items-end"><span className="text-slate-500 font-mono text-xs">{new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    </div>
                    {r.subject && <div className="text-slate-800 font-medium">Mapel: {r.subject}</div>}
                    {r.note && <div className="text-slate-600 italic">"{r.note}"</div>}
                    {r.distance !== undefined && <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin size={10} /> Jarak: {r.distance}m</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'REPORT' && (
         <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex gap-2 items-center text-lg"><FileText className="text-orange-500"/> Laporan Lengkap Saya</h3>
                <button onClick={downloadMyReport} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold flex gap-2 items-center hover:bg-green-700 shadow-sm"><Download size={16}/> Download Excel</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-slate-200">
                    <thead className="bg-slate-50"><tr><th className="p-3 border text-left">Hari</th><th className="p-3 border text-left">Tanggal</th><th className="p-3 border text-left">Waktu</th><th className="p-3 border text-left">Aktivitas</th><th className="p-3 border text-left">Keterangan</th></tr></thead>
                    <tbody>
                        {history.length === 0 ? (<tr><td colSpan={5} className="p-8 text-center text-slate-400">Belum ada riwayat absensi apapun.</td></tr>) : (history.map((r: any, idx: number) => (
                              <tr key={`${r.id}-${idx}`} className="hover:bg-slate-50">
                                  <td className="p-3 border text-slate-600 font-medium">{getDayName(r.timestamp)}</td>
                                  <td className="p-3 border text-slate-600">{new Date(r.timestamp).toLocaleDateString('id-ID')}</td>
                                  <td className="p-3 border font-mono text-slate-500">{new Date(r.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</td>
                                  <td className="p-3 border"><span className={`px-2 py-1 rounded text-xs border font-bold ${getTypeColor(r.type)}`}>{formatType(r.type)}</span></td>
                                  <td className="p-3 border text-slate-700">{r.subject || r.note || '-'}</td>
                              </tr>
                          )))}
                    </tbody>
                </table>
            </div>
         </div>
      )}

      {activeTab === 'PROFILE' && (
         <div className="bg-white p-8 rounded-xl shadow border border-slate-200 text-center max-w-md mx-auto">
            <div className="w-32 h-32 mx-auto bg-slate-100 rounded-full mb-6 overflow-hidden border-4 border-white shadow-lg relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {user.photo ? <img src={user.photo} className="w-full h-full object-cover"/> : <Users size={50} className="m-auto mt-8 text-slate-300"/>}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" size={24}/></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mt-2 mb-6 uppercase tracking-wider">{user.role}</span>
            <div className="text-left space-y-4 text-sm border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"><span className="text-slate-500">Nomor HP</span><span className="font-bold text-slate-700 font-mono">{user.phone || '-'}</span></div>
                <div className="flex justify-between items-start p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 shrink-0">Mapel Diampu</span><span className="font-bold text-slate-700 text-right">{user.subjects || '-'}</span></div>
            </div>
         </div>
       )}
    </div>
  );
}

function AdminDashboard({ 
  records, users, schoolSettings, announcements, onUpdateSettings, onClear, 
  onAddUser, onUpdateUser, onDeleteUser, onAddAnnouncement, onDeleteAnnouncement,
  showToast
}: { 
  records: AttendanceRecord[], users: UserAccount[], schoolSettings: SchoolSettings, announcements: Announcement[],
  onUpdateSettings: (settings: SchoolSettings) => void, onClear: () => void, onAddUser: (user: Omit<UserAccount, 'id'>) => void, 
  onUpdateUser: (id: string, updates: Partial<UserAccount>) => void, onDeleteUser: (id: string) => void, 
  onAddAnnouncement: (text: string) => void, onDeleteAnnouncement: (id: string) => void,
  showToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [activeTab, setActiveTab] = useState<'REPORT' | 'USERS' | 'SETTINGS' | 'INFO'>('REPORT');
  const [form, setForm] = useState({ name: '', role: 'Guru' as UserRole, password: '', phone: '', subjects: '' });
  const [tempSchoolName, setTempSchoolName] = useState(schoolSettings.name);
  const [modal, setModal] = useState<{user: UserAccount, pass: string} | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<UserAccount | null>(null);
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [editInfoModal, setEditInfoModal] = useState<UserAccount | null>(null);
  
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.password) return showToast("Nama & Password wajib", 'error');
    onAddUser({ name: form.name, role: form.role, password: form.password, phone: form.phone, subjects: form.subjects });
    setForm({ name: '', role: 'Guru', password: '', phone: '', subjects: '' });
  };

  const handleAddInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement) return;
    onAddAnnouncement(newAnnouncement);
    setNewAnnouncement('');
  };
  
  const handleSaveEditInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (editInfoModal) {
      onUpdateUser(editInfoModal.id, { name: editInfoModal.name, phone: editInfoModal.phone, subjects: editInfoModal.subjects });
      setEditInfoModal(null);
    }
  };

  const calculateDuration = (endRecord: AttendanceRecord, allRecords: AttendanceRecord[]) => {
    if (endRecord.type !== 'KELUAR_KELAS' && endRecord.type !== 'PULANG') return '-';
    const endDate = new Date(endRecord.timestamp);
    const dayStr = endDate.toLocaleDateString('id-ID');
    const userDailyRecords = allRecords.filter(r => r.name === endRecord.name && new Date(r.timestamp).toLocaleDateString('id-ID') === dayStr);
    let startRecord = endRecord.type === 'KELUAR_KELAS' ? userDailyRecords.filter(r => ['MASUK_KELAS', 'INVAL'].includes(r.type) && new Date(r.timestamp) < endDate).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : userDailyRecords.find(r => r.type === 'HADIR');
    if (!startRecord) return '-';
    const diffMs = endDate.getTime() - new Date(startRecord.timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return `${Math.floor(diffMins / 60)}j ${diffMins % 60}m`;
  };

  const filteredRecords = selectedUserFilter === 'ALL' ? records : records.filter(r => r.name === selectedUserFilter);

  const downloadExcel = () => {
    const userLabel = selectedUserFilter === 'ALL' ? 'Semua' : selectedUserFilter.replace(/\s+/g, '_');
    downloadExcelData(filteredRecords, `Laporan_${userLabel}.xls`);
  };

  return (
    <div className="space-y-6 relative">
      {modal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"><div className="p-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold flex items-center gap-2"><Key size={18}/> Ganti Password</h3><button onClick={() => setModal(null)}><X size={20}/></button></div><div className="p-6 space-y-4"><p className="text-sm">User: <b>{modal.user.name}</b></p><input type="text" value={modal.pass} onChange={e => setModal({...modal, pass: e.target.value})} className="w-full p-3 border rounded-lg" placeholder="Password baru" autoFocus /><button onClick={() => { onUpdateUser(modal.user.id, { password: modal.pass }); setModal(null); }} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Simpan Password</button></div></div></div>}
      
      {editInfoModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"><div className="p-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold flex items-center gap-2"><Pencil size={18}/> Edit Data Pengguna</h3><button onClick={() => setEditInfoModal(null)}><X size={20}/></button></div><form onSubmit={handleSaveEditInfo} className="p-6 space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label><input type="text" value={editInfoModal.name} onChange={(e) => setEditInfoModal({...editInfoModal, name: e.target.value})} className="w-full p-2 border rounded" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nomor HP</label><input type="text" value={editInfoModal.phone || ''} onChange={(e) => setEditInfoModal({...editInfoModal, phone: e.target.value})} className="w-full p-2 border rounded" /></div>{editInfoModal.role === 'Guru' && <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mapel Diampu</label><SubjectSelector value={editInfoModal.subjects || ''} onChange={(val) => setEditInfoModal({...editInfoModal, subjects: val})}/></div>}<div className="flex justify-end pt-2"><button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Simpan Perubahan</button></div></form></div></div>}

      {deleteConfirmation && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-red-100"><div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-700 flex items-center gap-2"><Trash2 size={18} /> Hapus Pengguna?</h3><button onClick={() => setDeleteConfirmation(null)} className="text-red-400 hover:text-red-700"><X size={20} /></button></div><div className="p-6"><p className="text-slate-600 mb-6">Yakin hapus <strong>{deleteConfirmation.name}</strong>? <br/><span className="text-xs text-red-500">Tak bisa dibatalkan.</span></p><div className="flex justify-end gap-3"><button type="button" onClick={() => setDeleteConfirmation(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Batal</button><button type="button" onClick={() => { onDeleteUser(deleteConfirmation.id); setDeleteConfirmation(null); }} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-bold shadow-md">Ya, Hapus</button></div></div></div></div>}

      <div className="flex gap-2 border-b overflow-x-auto pb-2">{['REPORT', 'USERS', 'INFO', 'SETTINGS'].map(t => (<button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 ${activeTab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>{t === 'REPORT' && <FileText size={16}/>}{t === 'USERS' && <Users size={16}/>}{t === 'INFO' && <Megaphone size={16}/>}{t === 'SETTINGS' && <Settings size={16}/>}{t}</button>))}</div>

      {activeTab === 'REPORT' && (<div><div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200"><div className="w-full md:w-auto"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Filter size={12} /> Filter Nama</label><select value={selectedUserFilter} onChange={(e) => setSelectedUserFilter(e.target.value)} className="w-full md:w-64 p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"><option value="ALL">-- Tampilkan Semua --</option>{users.map((u, idx) => (<option key={`${u.id}-${idx}`} value={u.name}>{u.name}</option>))}</select></div><div className="flex gap-2"><button onClick={downloadExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2 items-center hover:bg-green-700 transition shadow-sm"><Download size={16}/> Download Excel</button></div></div><div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-800 text-white text-xs uppercase"><tr><th className="p-3">Waktu</th><th className="p-3 text-left">Nama</th><th className="p-3">Aktivitas</th><th className="p-3 text-left">Ket / Mapel / Materi</th><th className="p-3">Durasi</th><th className="p-3">Jarak</th></tr></thead><tbody className="divide-y">{filteredRecords.length === 0 ? (<tr><td colSpan={6} className="p-8 text-center text-slate-400">Tidak ada data untuk filter ini.</td></tr>) : (filteredRecords.map((r, idx) => (<tr key={`${r.id}-${idx}`} className="hover:bg-slate-50"><td className="p-3 text-center"><div className="font-bold">{new Date(r.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div><div className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</div></td><td className="p-3">{r.name} <div className="text-xs text-slate-400">{r.role}</div></td><td className="p-3 text-center"><span className="font-bold text-xs bg-slate-100 px-2 py-1 rounded border">{formatType(r.type)}</span></td><td className="p-3">{r.subject ? (<div><div className="font-semibold">{r.subject}</div>{r.note && <div className="text-xs text-slate-500 mt-1">Materi: {r.note}</div>}</div>) : (r.note || '-')}</td><td className="p-3 text-center font-mono">{calculateDuration(r, records)}</td><td className="p-3 text-center text-xs font-mono text-slate-500">{r.distance ? r.distance + 'm' : '-'}</td></tr>)))}</tbody></table></div></div>)}

      {activeTab === 'USERS' && (<div className="grid md:grid-cols-3 gap-6"><div className="bg-white p-5 rounded-xl shadow h-fit border border-slate-200"><h3 className="font-bold mb-4 flex gap-2 items-center"><Plus className="bg-blue-600 text-white rounded-full p-0.5" size={20}/> Tambah User</h3><form onSubmit={handleAdd} className="space-y-3"><input className="w-full p-2 border rounded" placeholder="Nama" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><select className="w-full p-2 border rounded bg-white" value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})}><option>Guru</option><option>Staf</option><option>Admin</option></select><input className="w-full p-2 border rounded" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /><input className="w-full p-2 border rounded" placeholder="No HP" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />{form.role === 'Guru' && <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mapel Diampu</label><SubjectSelector value={form.subjects} onChange={(val) => setForm({...form, subjects: val})}/></div>}<button className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 mt-2">Simpan</button></form></div><div className="md:col-span-2 bg-white rounded-xl shadow border border-slate-200 overflow-hidden"><div className="p-4 bg-slate-50 border-b font-bold text-slate-700">Daftar Pengguna ({users.length})</div><div className="max-h-[500px] overflow-y-auto"><table className="w-full text-sm"><thead className="bg-white text-slate-500 text-xs uppercase border-b sticky top-0"><tr><th className="p-3 text-left">Nama</th><th className="p-3 text-left">Info</th><th className="p-3 text-center">Aksi</th></tr></thead><tbody className="divide-y">{users.map((u, idx) => (<tr key={`${u.id}-${idx}`} className="hover:bg-slate-50"><td className="p-3"><div className="font-bold">{u.name}</div><div className="text-xs bg-slate-100 w-fit px-1 rounded mt-1 text-slate-500">Pass: {u.password}</div></td><td className="p-3 text-xs"><div className="font-bold text-blue-600">{u.role}</div><div>{u.phone}</div></td><td className="p-3 flex justify-center gap-2"><button type="button" onClick={() => setEditInfoModal(u)} className="bg-green-50 text-green-600 p-2 rounded hover:bg-green-100"><Pencil size={16}/></button><button type="button" onClick={() => setModal({user: u, pass: u.password})} className="bg-blue-50 text-blue-600 p-2 rounded hover:bg-blue-100"><Key size={16}/></button><button type="button" onClick={() => setDeleteConfirmation(u)} className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100"><XCircle size={16}/></button></td></tr>))}</tbody></table></div></div></div>)}
      
      {activeTab === 'INFO' && (<div className="bg-white p-6 rounded-xl shadow border border-slate-200"><h3 className="font-bold text-lg mb-4 flex gap-2 items-center border-b pb-4"><Megaphone className="text-yellow-600"/> Kelola Pengumuman</h3><form onSubmit={handleAddInfo} className="mb-6 flex gap-2"><input type="text" value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Tulis pengumuman baru..." /><button className="bg-blue-600 text-white px-4 rounded font-bold">Tambah</button></form><div className="space-y-2">{announcements.map((a) => (<div key={a.id} className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-100 rounded"><span>{a.text}</span><button onClick={() => onDeleteAnnouncement(a.id)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={16}/></button></div>))}{announcements.length === 0 && <p className="text-slate-400 text-sm text-center">Belum ada pengumuman aktif.</p>}</div></div>)}

      {activeTab === 'SETTINGS' && (<div className="space-y-6"><div className="bg-white p-6 rounded-xl shadow border border-slate-200 max-w-2xl mx-auto"><h3 className="font-bold text-lg mb-6 flex gap-2 items-center border-b pb-4"><Settings className="text-blue-600"/> Pengaturan Sekolah</h3><div className="flex gap-6 flex-col md:flex-row"><div className="flex flex-col items-center"><div className="w-32 h-32 border-2 border-dashed rounded-xl flex items-center justify-center bg-slate-50 mb-2 overflow-hidden relative">{schoolSettings.logo ? <img src={schoolSettings.logo} className="w-full h-full object-contain p-2"/> : <ImageIcon className="text-slate-300" size={48}/>}</div><p className="text-xs text-slate-400 mt-2">Logo disimpan lokal (belum cloud)</p></div><div className="flex-1 space-y-4"><div><label className="block text-sm font-bold mb-1">Nama Sekolah</label><input type="text" className="w-full p-2 border rounded" value={tempSchoolName} onChange={e => setTempSchoolName(e.target.value)} /></div><button onClick={() => { onUpdateSettings({...schoolSettings, name: tempSchoolName}); showToast("Disimpan", 'success'); }} className="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-blue-700 w-full">Simpan Perubahan</button></div></div></div></div>)}
    </div>
  );
}

// --- Utils ---
function formatType(type: AttendanceType) { return type.replace('_', ' '); }
function getTypeColor(type: AttendanceType) {
  switch (type) {
    case 'HADIR': return 'bg-blue-100 text-blue-700';
    case 'PULANG': return 'bg-slate-200 text-slate-700';
    case 'MASUK_KELAS': return 'bg-emerald-100 text-emerald-700';
    case 'INVAL': return 'bg-purple-100 text-purple-700';
    case 'KELUAR_KELAS': return 'bg-orange-100 text-orange-700';
    case 'IZIN': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}
function downloadExcelData(data: AttendanceRecord[], filename: string) {
    const csvContent = "data:text/csv;charset=utf-8," + "Nama,Role,Tipe,Waktu,Mapel/Ket\n" + data.map(e => `${e.name},${e.role},${e.type},${e.timestamp},"${e.subject || e.note || ''}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}