import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Activity, 
  BarChart3, 
  Video, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  UserCheck, 
  UserMinus, 
  UserX,
  User as UserIcon,
  Settings,
  Bell,
  Search,
  LayoutDashboard,
  LogIn,
  LogOut,
  Fingerprint,
  ShieldCheck,
  Phone,
  Mail,
  CreditCard,
  GraduationCap,
  CalendarDays,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar
} from 'recharts';
import { MOCK_STUDENTS, MOCK_HISTORY } from './constants';
import { analyzeAttention } from './services/gemini';
import { cn } from '@/lib/utils';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLive, setIsLive] = useState(false);
  const [attentionScore, setAttentionScore] = useState(78);
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [history, setHistory] = useState(MOCK_HISTORY);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Settings State
  const [lowAttentionThreshold, setLowAttentionThreshold] = useState(50);
  const [highDistractionThreshold, setHighDistractionThreshold] = useState(5);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [alertSound, setAlertSound] = useState(true);
  const [sessionAutoStop, setSessionAutoStop] = useState(false);
  const [autoStopMinutes, setAutoStopMinutes] = useState(60);

  // Auth & Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);
  const [aadharInput, setAadharInput] = useState('');
  const [isAadharVerified, setIsAadharVerified] = useState(false);
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<'student' | 'professor' | 'parent' | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [childRollNumber, setChildRollNumber] = useState('');
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [foundChild, setFoundChild] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Fetch or create user profile
        checkUserProfile(currentUser);
      } else {
        setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all students from Firestore
  useEffect(() => {
    if (!isAuthReady || userRole !== 'professor') return;
    
    const q = collection(db, 'students');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      if (studentData.length > 0) {
        setStudents(studentData);
      }
    });
    
    return () => unsubscribe();
  }, [isAuthReady, userRole]);

  const checkUserProfile = async (currentUser: User) => {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setUserRole(data.role);
      setUserProfile(data);
    } else {
      // Check if they exist in students collection (legacy or specific role)
      const studentDoc = await getDoc(doc(db, 'students', currentUser.uid));
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        setUserRole('student');
        const profile = {
          role: 'student',
          email: currentUser.email,
          name: currentUser.displayName,
          rollNumber: studentData.rollNumber || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
          aadharNumber: studentData.aadharNumber || ''
        };
        setUserProfile(profile);
        // Migrate to users collection
        await setDoc(doc(db, 'users', currentUser.uid), profile);
      } else {
        setShowRoleSelection(true);
      }
    }
  };

  const selectRole = async (role: 'student' | 'professor' | 'parent') => {
    if (!user) return;
    
    const profile: any = {
      role,
      email: user.email,
      name: user.displayName,
      createdAt: serverTimestamp()
    };

    if (role === 'student') {
      profile.rollNumber = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
      profile.aadharNumber = '';
    } else if (role === 'professor') {
      profile.professorId = `PROF-${Math.floor(100 + Math.random() * 900)}`;
    }

    await setDoc(doc(db, 'users', user.uid), profile);
    setUserProfile(profile);

    if (role === 'student') {
      await setDoc(doc(db, 'students', user.uid), {
        name: user.displayName || 'New Student',
        email: user.email,
        rollNumber: profile.rollNumber,
        age: 0,
        grade: 'N/A',
        isVerified: false,
        createdAt: serverTimestamp()
      });
    }

    setUserRole(role);
    setShowRoleSelection(false);
  };

  const login = async () => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // User closed the popup or another popup was opened, no need to log as a major failure
        console.log("Login popup closed or cancelled.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("Pop-up blocked. Please enable pop-ups for this site to log in.");
      } else {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setIsLive(false);
  };

  const verifyFaceAndAadhar = async () => {
    if (!rollNumberInput) {
      alert("Please enter your Roll Number");
      return;
    }
    if (!aadharInput || aadharInput.length !== 12) {
      alert("Please enter a valid 12-digit Aadhar number");
      return;
    }

    setIsVerifyingFace(true);
    // Simulate face recognition processing
    setTimeout(async () => {
      setIsVerifyingFace(false);
      setIsAadharVerified(true);
      
      if (user) {
        // Record attendance
        await addDoc(collection(db, 'attendance'), {
          studentId: user.uid,
          studentName: user.displayName,
          rollNumber: rollNumberInput,
          date: new Date().toISOString().split('T')[0],
          timestamp: serverTimestamp(),
          status: 'present',
          verificationMethod: 'face-aadhar',
          aadharLast4: aadharInput.slice(-4)
        });
        
        // Update student verification status
        await setDoc(doc(db, 'students', user.uid), {
          isVerified: true,
          rollNumber: rollNumberInput,
          aadharNumber: `********${aadharInput.slice(-4)}`,
          lastVerifiedAt: serverTimestamp()
        }, { merge: true });

        // Update user profile
        await setDoc(doc(db, 'users', user.uid), {
          isVerified: true,
          rollNumber: rollNumberInput,
          aadharNumber: `********${aadharInput.slice(-4)}`
        }, { merge: true });

        setUserProfile((prev: any) => ({
          ...prev,
          isVerified: true,
          rollNumber: rollNumberInput,
          aadharNumber: `********${aadharInput.slice(-4)}`
        }));
      }
    }, 3000);
  };

  const saveFeedback = async (studentId: string) => {
    const feedback = feedbackInputs[studentId];
    if (!feedback) return;

    try {
      await setDoc(doc(db, 'students', studentId), {
        feedback: feedback,
        feedbackUpdatedAt: serverTimestamp()
      }, { merge: true });
      
      // Clear input
      setFeedbackInputs(prev => ({ ...prev, [studentId]: '' }));
      alert("Feedback saved successfully!");
    } catch (error) {
      console.error("Error saving feedback:", error);
      alert("Failed to save feedback. Check permissions.");
    }
  };

  const searchChild = () => {
    const child = students.find(s => s.rollNumber === childRollNumber || s.id === childRollNumber);
    if (child) {
      setFoundChild(child);
    } else {
      alert("Student not found. Please check the Roll Number.");
    }
  };

  const isAdmin = user?.email === "vinodkumarreddyo823@gmail.com" || userRole === 'professor';

  const startLiveSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsLive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopLiveSession = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsLive(false);
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      const base64 = dataUrl.split(',')[1];
      
      const result = await analyzeAttention(base64);
      if (result) {
        setAnalysisResult(result);
        setAttentionScore(result.averageAttentionScore);
        // Update history
        setHistory(prev => [...prev.slice(1), {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          averageAttention: result.averageAttentionScore,
          focusedCount: result.focusedCount,
          distractedCount: result.distractedCount
        }]);
      }
    }
    setIsAnalyzing(false);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(captureAndAnalyze, 10000); // Analyze every 10 seconds
    }
    return () => clearInterval(interval);
  }, [isLive]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Branding & Info */}
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="lg:w-1/2 bg-indigo-600 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden"
        >
          {/* Decorative background elements */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-5%] left-[-5%] w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-xl">
                <GraduationCap size={28} />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">FocusFlow</h1>
            </div>

            <div className="space-y-6 max-w-lg">
              <h2 className="text-5xl lg:text-7xl font-black leading-[0.9] tracking-tighter">
                ELEVATE <br />
                <span className="text-indigo-200">ATTENTION.</span>
              </h2>
              <p className="text-lg text-indigo-100 font-medium leading-relaxed opacity-90">
                The next generation of classroom management. Real-time focus tracking, 
                AI-driven analytics, and seamless communication for modern education.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 lg:mt-0">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-3xl font-bold">98%</h4>
                <p className="text-xs text-indigo-200 uppercase tracking-widest font-bold mt-1">Accuracy Rate</p>
              </div>
              <div>
                <h4 className="text-3xl font-bold">15k+</h4>
                <p className="text-xs text-indigo-200 uppercase tracking-widest font-bold mt-1">Active Users</p>
              </div>
            </div>

            <div className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <p className="text-sm italic text-indigo-50 leading-relaxed">
                "FocusFlow has completely transformed how I manage my lectures. The real-time attention metrics allow me to adjust my teaching pace instantly."
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold">PM</div>
                <div>
                  <p className="text-xs font-bold">Prof. Miller</p>
                  <p className="text-[10px] text-indigo-300">Advanced Mathematics</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Login Actions */}
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-slate-50"
        >
          <div className="max-w-md w-full space-y-12">
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h3>
              <p className="text-slate-500 font-medium">Access your personalized education portal</p>
            </div>

            <div className="space-y-8">
              <Button 
                onClick={login} 
                size="lg" 
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-16 text-xl font-bold gap-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all active:scale-95"
              >
                {isLoggingIn ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <LogIn size={24} />
                )}
                {isLoggingIn ? "Authenticating..." : "Login with Google"}
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-50 px-4 text-slate-400 font-bold tracking-widest">Platform Roles</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800">Student Portal</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">Track your focus scores, view attendance history, and receive personalized academic feedback.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800">Professor Dashboard</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">Monitor class engagement in real-time, analyze attention trends, and manage student performance.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800">Parent Access</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">Stay updated on your child's progress, focus levels, and direct teacher feedback instantly.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 font-medium">
              By logging in, you agree to our <span className="text-indigo-600 cursor-pointer hover:underline">Terms of Service</span> and <span className="text-indigo-600 cursor-pointer hover:underline">Privacy Policy</span>.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showRoleSelection) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full border-none shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-black">Select Your Role</CardTitle>
            <CardDescription>How will you be using FocusFlow today?</CardDescription>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => selectRole('student')}
              className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <UserCheck size={32} />
              </div>
              <h3 className="font-bold text-slate-800">Student</h3>
              <p className="text-xs text-slate-500 mt-2">Track your focus and attendance</p>
            </button>

            <button 
              onClick={() => selectRole('professor')}
              className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group text-center"
            >
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Users size={32} />
              </div>
              <h3 className="font-bold text-slate-800">Professor</h3>
              <p className="text-xs text-slate-500 mt-2">Manage class and analyze attention</p>
            </button>

            <button 
              onClick={() => selectRole('parent')}
              className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group text-center"
            >
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Activity size={32} />
              </div>
              <h3 className="font-bold text-slate-800">Parent</h3>
              <p className="text-xs text-slate-500 mt-2">Monitor your child's progress</p>
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 hidden lg:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">FocusFlow</h1>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest px-1.5 py-0">
              {userRole || 'User'}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {userRole === 'professor' && (
            <>
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <NavItem 
                icon={<Video size={20} />} 
                label="Live Session" 
                active={activeTab === 'live'} 
                onClick={() => setActiveTab('live')} 
              />
              <NavItem 
                icon={<BarChart3 size={20} />} 
                label="Analytics" 
                active={activeTab === 'analytics'} 
                onClick={() => setActiveTab('analytics')} 
              />
              <NavItem 
                icon={<Users size={20} />} 
                label="Students" 
                active={activeTab === 'students'} 
                onClick={() => setActiveTab('students')} 
              />
            </>
          )}
          
          {(userRole === 'student' || userRole === 'professor') && (
            <NavItem 
              icon={<CalendarDays size={20} />} 
              label="Attendance" 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')} 
            />
          )}

          {(userRole === 'student' || userRole === 'parent') && (
            <NavItem 
              icon={<Activity size={20} />} 
              label="My Progress" 
              active={activeTab === 'progress'} 
              onClick={() => setActiveTab('progress')} 
            />
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')} 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 md:p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' && "Class Overview"}
              {activeTab === 'live' && "Live Attention Monitoring"}
              {activeTab === 'analytics' && "Detailed Analytics"}
              {activeTab === 'students' && "Student Roster"}
              {activeTab === 'attendance' && "Attendance Portal"}
              {activeTab === 'progress' && (userRole === 'parent' ? "Child's Progress" : "My Progress")}
              {activeTab === 'settings' && "System Settings"}
            </h2>
            <p className="text-slate-500">
              Room 402 • Advanced Mathematics • {userRole === 'professor' && userProfile?.professorId ? `ID: ${userProfile.professorId}` : 'Prof. Miller'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!user ? (
              <Button 
                onClick={login} 
                disabled={isLoggingIn}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <LogIn size={18} />
                )}
                {isLoggingIn ? "Signing in..." : "Login"}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-bold text-slate-800">{user.displayName}</p>
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user.email}</p>
                    {userRole === 'student' && userProfile?.rollNumber && (
                      <Badge variant="outline" className="mt-1 text-[9px] h-4 px-1.5 border-emerald-200 text-emerald-700 bg-emerald-50">
                        ROLL: {userProfile.rollNumber}
                      </Badge>
                    )}
                    {userRole === 'professor' && userProfile?.professorId && (
                      <Badge variant="outline" className="mt-1 text-[9px] h-4 px-1.5 border-indigo-200 text-indigo-700 bg-indigo-50">
                        ID: {userProfile.professorId}
                      </Badge>
                    )}
                    {userRole === 'parent' && foundChild && (
                      <Badge variant="outline" className="mt-1 text-[9px] h-4 px-1.5 border-amber-200 text-amber-700 bg-amber-50">
                        CHILD ID: {foundChild.rollNumber}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500 hover:text-red-600">
                  <LogOut size={20} />
                </Button>
              </div>
            )}
            <Separator orientation="vertical" className="h-8 mx-1" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search students..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
              />
            </div>
            <Button variant="outline" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <Avatar>
              <AvatarImage src="https://picsum.photos/seed/teacher/40/40" />
              <AvatarFallback>PM</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Average Attention" 
                  value={`${attentionScore}%`} 
                  trend="+4.2%" 
                  icon={<Activity className="text-indigo-600" />} 
                  color="indigo"
                />
                <StatCard 
                  title="Focused Students" 
                  value="24" 
                  trend="+2" 
                  icon={<UserCheck className="text-emerald-600" />} 
                  color="emerald"
                />
                <StatCard 
                  title="Distracted" 
                  value="4" 
                  trend="-1" 
                  icon={<UserMinus className="text-amber-600" />} 
                  color="amber"
                />
                <StatCard 
                  title="Away/Absent" 
                  value="2" 
                  trend="0" 
                  icon={<UserX className="text-rose-600" />} 
                  color="rose"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Attention Trend</CardTitle>
                      <CardDescription>Real-time engagement monitoring</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">
                      Live Updates
                    </Badge>
                  </CardHeader>
                  <CardContent className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="averageAttention" 
                          stroke="#4f46e5" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorAttention)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Recent Alerts */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell size={20} className="text-amber-500" />
                      Recent Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-4">
                        <AlertItem 
                          type="warning" 
                          title="Low Attention Detected" 
                          message="Attention dropped to 45% in the back row."
                          time="2m ago"
                        />
                        <AlertItem 
                          type="info" 
                          title="Student Away" 
                          message="Daniel White has been away for 10 minutes."
                          time="5m ago"
                        />
                        <AlertItem 
                          type="warning" 
                          title="High Distraction" 
                          message="Group activity detected near the window."
                          time="12m ago"
                        />
                        <AlertItem 
                          type="success" 
                          title="Engagement Peak" 
                          message="Class reached 95% attention during the demo."
                          time="25m ago"
                        />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Student List Preview */}
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Top Focused Students</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('students')}>View All</Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {students.slice(0, 4).map((student) => (
                      <div key={student.id} className="p-4 rounded-xl border border-slate-100 bg-white flex items-center gap-4">
                        <Avatar className="h-12 w-12 ring-2 ring-indigo-50">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} />
                          <AvatarFallback>{student.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{student.name}</p>
                          <div className="flex items-center gap-2">
                            <Progress value={student.attentionScore} className="h-1.5 flex-1" />
                            <span className="text-xs font-medium text-slate-500">{student.attentionScore}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'live' && (
            <motion.div 
              key="live"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-slate-900 aspect-video relative group">
                {!isLive ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                    <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                      <Video size={40} className="text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Start Monitoring Session</h3>
                    <p className="text-slate-400 max-w-md mb-6">
                      Enable your camera to begin real-time attention analysis. Data is processed locally and via secure AI.
                    </p>
                    <Button onClick={startLiveSession} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                      Enable Camera
                    </Button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Overlay UI */}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <Badge className="bg-red-500 text-white border-none animate-pulse">LIVE</Badge>
                      <Badge variant="outline" className="bg-black/40 text-white border-white/20 backdrop-blur-md">
                        <Clock size={12} className="mr-1" /> {new Date().toLocaleTimeString()}
                      </Badge>
                    </div>

                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <Button variant="destructive" size="sm" onClick={stopLiveSession}>
                        Stop Session
                      </Button>
                    </div>

                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="bg-white/90 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="font-medium text-slate-800">AI Analyzing Attention...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>

              <div className="space-y-6">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Live Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center p-6 bg-indigo-50 rounded-2xl">
                      <p className="text-indigo-600 font-medium text-sm mb-1 uppercase tracking-wider">Current Score</p>
                      <h4 className="text-5xl font-black text-indigo-900">{attentionScore}%</h4>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <span className="text-emerald-600 font-semibold">+2.4% from last scan</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 flex items-center gap-2"><UserCheck size={18} className="text-emerald-500" /> Focused</span>
                        <span className="font-bold">{analysisResult?.focusedCount || 24}</span>
                      </div>
                      <Progress value={80} className="h-2 bg-slate-100" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 flex items-center gap-2"><UserMinus size={18} className="text-amber-500" /> Distracted</span>
                        <span className="font-bold">{analysisResult?.distractedCount || 4}</span>
                      </div>
                      <Progress value={15} className="h-2 bg-slate-100" />

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 flex items-center gap-2"><UserX size={18} className="text-rose-500" /> Away</span>
                        <span className="font-bold">{analysisResult?.awayCount || 2}</span>
                      </div>
                      <Progress value={5} className="h-2 bg-slate-100" />
                    </div>

                    {analysisResult?.summary && (
                      <Alert className="bg-indigo-50 border-indigo-100 text-indigo-900">
                        <Activity className="h-4 w-4" />
                        <AlertTitle>AI Insight</AlertTitle>
                        <AlertDescription className="text-sm italic">
                          "{analysisResult.summary}"
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Engagement Distribution</CardTitle>
                    <CardDescription>How attention varies across the classroom</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={history.slice(-10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="focusedCount" fill="#10b981" radius={[4, 4, 0, 0]} name="Focused" />
                        <Bar dataKey="distractedCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Distracted" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Attention Stability</CardTitle>
                    <CardDescription>Fluctuations in focus over the session</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="stepAfter" dataKey="averageAttention" stroke="#4f46e5" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Session Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Peak Engagement</p>
                      <h4 className="text-3xl font-bold text-emerald-600">94%</h4>
                      <p className="text-xs text-slate-400">Reached at 09:45 AM during group discussion</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Lowest Point</p>
                      <h4 className="text-3xl font-bold text-rose-500">42%</h4>
                      <p className="text-xs text-slate-400">Occurred at 10:15 AM (Transition period)</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Overall Average</p>
                      <h4 className="text-3xl font-bold text-indigo-600">76.5%</h4>
                      <p className="text-xs text-slate-400">+5% compared to last week's session</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div 
              key="students"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="xl:col-span-2 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Student Roster</CardTitle>
                    <CardDescription>Manage academic details and parent contacts.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="p-4 font-semibold text-slate-600">Student</th>
                            <th className="p-4 font-semibold text-slate-600">Roll No.</th>
                            <th className="p-4 font-semibold text-slate-600">Age/Grade</th>
                            <th className="p-4 font-semibold text-slate-600">Parent Contact</th>
                            <th className="p-4 font-semibold text-slate-600">Verification</th>
                            <th className="p-4 font-semibold text-slate-600">Feedback</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} />
                                    <AvatarFallback>{student.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <span className="font-medium text-slate-800 block">{student.name}</span>
                                    <span className="text-xs text-slate-400">ID: {student.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-sm">
                                <Badge variant="outline" className="font-mono">#{student.rollNumber || (1000 + (student.id.length > 5 ? student.id.slice(-4) : student.id))}</Badge>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{student.age || (18 + (student.id.length > 5 ? 0 : parseInt(student.id)))} Years</span>
                                  <span className="text-xs text-slate-500">Grade: {student.grade || 'A+'}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Phone size={14} className="text-indigo-400" />
                                  {student.parentContact || `+91 98765 4321${student.id.slice(-1)}`}
                                </div>
                              </td>
                              <td className="p-4">
                                {student.isVerified ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-none gap-1">
                                    <ShieldCheck size={12} /> Verified
                                  </Badge>
                                ) : (
                                  <Badge className="bg-rose-100 text-rose-700 border-none gap-1">
                                    <UserX size={12} /> Unverified
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                  {isAdmin && (
                                    <div className="flex flex-col gap-2">
                                      <Textarea 
                                        placeholder="Enter feedback..." 
                                        className="text-xs min-h-[60px]"
                                        value={feedbackInputs[student.id] || ''}
                                        onChange={(e) => setFeedbackInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                      />
                                      <Button 
                                        size="sm" 
                                        className="h-7 text-[10px] bg-indigo-600"
                                        onClick={() => saveFeedback(student.id)}
                                      >
                                        Save Feedback
                                      </Button>
                                    </div>
                                  )}
                                  {student.feedback && (
                                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                      <p className="text-[10px] text-slate-600 italic">"{student.feedback}"</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Student Feedback History</CardTitle>
                    <CardDescription>Recent performance feedback from teachers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {students.filter(s => s.feedback).map(student => (
                          <div key={student.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} />
                              </Avatar>
                              <span className="text-sm font-bold">{student.name}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed italic">
                              "{student.feedback}"
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <Badge variant="secondary" className="text-[10px]">Teacher Feedback</Badge>
                              <span className="text-[10px] text-slate-400">
                                {student.feedbackUpdatedAt ? new Date(student.feedbackUpdatedAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                              </span>
                            </div>
                          </div>
                        ))}
                        {students.filter(s => s.feedback).length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            No feedback recorded yet.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div 
              key="attendance"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {!user ? (
                <Card className="border-none shadow-sm p-12 text-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LogIn size={40} className="text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Student Login Required</h3>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    Please login with your university email or phone number to mark your attendance via face recognition.
                  </p>
                  <Button onClick={login} size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-8">
                    Login to Portal
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-sm overflow-hidden">
                    <div className="aspect-square bg-slate-900 relative">
                      {isVerifyingFace ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                          <div className="w-64 h-64 border-4 border-indigo-500 rounded-[40px] flex items-center justify-center mb-6 relative overflow-hidden">
                            <div className="absolute inset-0 border-4 border-white/20 rounded-[40px] animate-ping"></div>
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-scan shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                            <UserIcon size={80} className="text-indigo-400 animate-pulse" />
                          </div>
                          <h4 className="text-xl font-bold mb-2">Scanning Face...</h4>
                          <p className="text-slate-400 text-sm">Align your face within the frame</p>
                          <div className="mt-4 flex gap-1">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      ) : isAadharVerified ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600 text-white p-6">
                          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-4">
                            <ShieldCheck size={48} />
                          </div>
                          <h4 className="text-2xl font-bold mb-2">Verified Successfully</h4>
                          <p className="text-emerald-100">Attendance marked for {new Date().toLocaleDateString()}</p>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                          <div className="w-48 h-48 border-2 border-dashed border-white/20 rounded-full flex items-center justify-center mb-6">
                            <Video size={48} className="text-slate-600" />
                          </div>
                          <p className="text-slate-400 text-sm text-center">Face recognition camera will activate after Aadhar entry</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Attendance Verification</CardTitle>
                      <CardDescription>Step 2: Verify with Roll No, Aadhar & Face ID</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="rollNumber">Roll Number</Label>
                        <div className="relative">
                          <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <Input 
                            id="rollNumber"
                            placeholder="STU-XXXX" 
                            value={rollNumberInput}
                            onChange={(e) => setRollNumberInput(e.target.value)}
                            className="pl-10 h-12 text-lg"
                            disabled={isAadharVerified || isVerifyingFace}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="aadhar">Aadhar Number (12 Digits)</Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <Input 
                            id="aadhar"
                            placeholder="XXXX XXXX XXXX" 
                            maxLength={12}
                            value={aadharInput}
                            onChange={(e) => setAadharInput(e.target.value.replace(/\D/g, ''))}
                            className="pl-10 h-12 text-lg tracking-[0.2em]"
                            disabled={isAadharVerified || isVerifyingFace}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Email Verified</span>
                          <Badge className="bg-emerald-100 text-emerald-700 border-none">YES</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Phone Linked</span>
                          <Badge className="bg-emerald-100 text-emerald-700 border-none">YES</Badge>
                        </div>
                      </div>

                      <Button 
                        onClick={verifyFaceAndAadhar} 
                        disabled={isAadharVerified || isVerifyingFace || aadharInput.length !== 12}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-lg font-bold"
                      >
                        {isVerifyingFace ? "Processing..." : isAadharVerified ? "Verified" : "Verify & Mark Attendance"}
                      </Button>

                      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">
                        Secure Biometric Verification System v2.1
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'progress' && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {userRole === 'parent' && !foundChild && (
                <Card className="max-w-md mx-auto border-none shadow-sm p-8 text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Find Your Child</h3>
                  <p className="text-slate-500 mb-6 text-sm">
                    Enter your child's Roll Number or Student ID to view their progress and feedback.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Roll Number (e.g. 1001)" 
                      value={childRollNumber}
                      onChange={(e) => setChildRollNumber(e.target.value)}
                    />
                    <Button onClick={searchChild} className="bg-indigo-600">Search</Button>
                  </div>
                </Card>
              )}

              {(foundChild || userRole === 'student') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Card */}
                  <Card className="md:col-span-3 border-none shadow-sm bg-indigo-600 text-white overflow-hidden relative">
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <CardContent className="p-6 relative z-10">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shadow-xl">
                            <UserCheck size={32} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black tracking-tight">
                              {userRole === 'parent' ? foundChild.name : user?.displayName}
                            </h3>
                            <p className="text-indigo-100 text-sm opacity-80">
                              {userRole === 'parent' ? "Student Profile • Parent Access" : "Student Portal • Academic Overview"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-200">Roll Number</p>
                            <p className="text-lg font-bold">
                              {userRole === 'parent' ? foundChild.rollNumber : (userProfile?.rollNumber || 'PENDING')}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-200">Aadhar Number</p>
                            <p className="text-lg font-bold">
                              {userRole === 'parent' ? (foundChild.aadharNumber || 'NOT LINKED') : (userProfile?.aadharNumber || 'NOT LINKED')}
                            </p>
                          </div>
                          <div className="hidden md:block">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-200">Verification Status</p>
                            <Badge className="bg-emerald-400/20 text-emerald-100 border-emerald-400/30 mt-1">
                              {(userRole === 'parent' ? foundChild.isVerified : userProfile?.isVerified) ? 'VERIFIED' : 'PENDING'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2 border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Academic Performance</CardTitle>
                        <CardDescription>
                          {userRole === 'parent' ? `Tracking progress for ${foundChild.name}` : "Track your attention and grades over time"}
                        </CardDescription>
                      </div>
                      {userRole === 'parent' && (
                        <Button variant="outline" size="sm" onClick={() => setFoundChild(null)}>Change Student</Button>
                      )}
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_HISTORY}>
                          <defs>
                            <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Area type="monotone" dataKey="averageAttention" stroke="#4f46e5" fillOpacity={1} fill="url(#colorAtt)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Feedback</CardTitle>
                      <CardDescription>Latest comments from professors</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-4">
                          {(foundChild || students.find(s => s.id === user?.uid))?.feedback ? (
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare size={16} className="text-indigo-600" />
                                <span className="text-sm font-bold">Professor's Note</span>
                              </div>
                              <p className="text-sm text-slate-700 italic">
                                "{(foundChild || students.find(s => s.id === user?.uid))?.feedback}"
                              </p>
                              <p className="text-[10px] text-slate-400 mt-4">
                                Updated: {(foundChild || students.find(s => s.id === user?.uid))?.feedbackUpdatedAt ? new Date((foundChild || students.find(s => s.id === user?.uid))?.feedbackUpdatedAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-12 text-slate-400">
                              <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                              <p className="text-sm">No feedback received yet.</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Alert Thresholds */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell size={20} className="text-indigo-600" />
                      Alert Thresholds
                    </CardTitle>
                    <CardDescription>Configure when the system should trigger notifications.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="low-attention" className="text-sm font-semibold text-slate-700">Low Attention Threshold</Label>
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">{lowAttentionThreshold}%</Badge>
                      </div>
                      <Slider 
                        id="low-attention"
                        value={[lowAttentionThreshold]} 
                        onValueChange={(val) => setLowAttentionThreshold(val[0])}
                        max={100} 
                        step={1}
                        className="py-4"
                      />
                      <p className="text-xs text-slate-500">Trigger an alert when average class attention falls below this percentage.</p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="high-distraction" className="text-sm font-semibold text-slate-700">High Distraction Threshold</Label>
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700">{highDistractionThreshold} Students</Badge>
                      </div>
                      <Slider 
                        id="high-distraction"
                        value={[highDistractionThreshold]} 
                        onValueChange={(val) => setHighDistractionThreshold(val[0])}
                        max={30} 
                        step={1}
                        className="py-4"
                      />
                      <p className="text-xs text-slate-500">Trigger an alert when the number of distracted students exceeds this count.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Notification Preferences */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity size={20} className="text-emerald-600" />
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>Manage how you receive system alerts.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-slate-700">Enable Real-time Alerts</Label>
                        <p className="text-xs text-slate-500">Show visual notifications during live sessions.</p>
                      </div>
                      <Switch checked={enableAlerts} onCheckedChange={setEnableAlerts} />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-slate-700">Alert Sound</Label>
                        <p className="text-xs text-slate-500">Play a subtle sound when a threshold is crossed.</p>
                      </div>
                      <Switch checked={alertSound} onCheckedChange={setAlertSound} />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-slate-700">Email Summaries</Label>
                        <p className="text-xs text-slate-500">Receive a report after each session ends.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                {/* Session Management */}
                <Card className="border-none shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock size={20} className="text-rose-600" />
                      Session Management
                    </CardTitle>
                    <CardDescription>Configure automatic session behaviors.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-slate-700">Auto-stop Session</Label>
                        <p className="text-xs text-slate-500">Automatically end the monitoring session after a set time.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <AnimatePresence>
                          {sessionAutoStop && (
                            <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center gap-2"
                            >
                              <Input 
                                type="number" 
                                value={autoStopMinutes} 
                                onChange={(e) => setAutoStopMinutes(parseInt(e.target.value))}
                                className="w-20 h-8"
                              />
                              <span className="text-xs text-slate-500 font-medium">minutes</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <Switch checked={sessionAutoStop} onCheckedChange={setSessionAutoStop} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline">Reset Defaults</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-indigo-50 text-indigo-600 font-semibold" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span className={cn(
        "transition-colors",
        active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
      )}>
        {icon}
      </span>
      {label}
      {active && (
        <motion.div 
          layoutId="activeNav" 
          className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full"
        />
      )}
    </button>
  );
}

function StatCard({ title, value, trend, icon, color }: { title: string, value: string, trend: string, icon: React.ReactNode, color: string }) {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  }[color] || "bg-slate-50 text-slate-600";

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-lg", colorClasses)}>
            {icon}
          </div>
          <Badge variant="outline" className={cn(
            "border-none",
            trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({ type, title, message, time }: { type: 'warning' | 'info' | 'success', title: string, message: string, time: string }) {
  const icon = {
    warning: <AlertCircle size={16} className="text-amber-500" />,
    info: <Clock size={16} className="text-blue-500" />,
    success: <UserCheck size={16} className="text-emerald-500" />,
  }[type];

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
      <div className="mt-1">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap uppercase">{time}</span>
        </div>
        <p className="text-xs text-slate-500 line-clamp-2">{message}</p>
      </div>
    </div>
  );
}
