// ─────────────────────────────────────────────────────────────
// gwell-firebase.js  v2
// 지웰홈스 라이프 강동 - Firebase 통합 모듈
// HTML 파일들과 같은 폴더에 놓고, <script type="module" src="gwell-firebase.js"></script>
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ⚠️ 아래를 Firebase 콘솔에서 복사한 값으로 교체하세요
const firebaseConfig = {
  apiKey: "AIzaSyCyXCMzr0zIqh-1GBsoIp9uwIw05A0QTcE",
  authDomain: "gwell-life-gangdong.firebaseapp.com",
  projectId: "gwell-life-gangdong",
  storageBucket: "gwell-life-gangdong.firebasestorage.app",
  messagingSenderId: "140450313903",
  appId: "1:140450313903:web:b4a752a88b9dfc87f5c65a",
  measurementId: "G-H4FYZCHZQD"
};

// 관리자 이메일 (UI에서는 비번만 입력)
const ADMIN_EMAIL = "admin@gwell.local";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function todayKey(){
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function getVid(){
  let vid = localStorage.getItem('gwellVid');
  if(!vid){ vid = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('gwellVid', vid); }
  return vid;
}

window.GwellDB = {

  // ── 신청 ──
  async submitApplication(appData){
    const payload = { ...appData, status: '신청확인', createdAt: new Date().toISOString(), serverTime: serverTimestamp() };
    const ref = await addDoc(collection(db, 'applications'), payload);
    return ref.id;
  },

  subscribeApplications(cb){
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error('[GwellDB] apps error:', err));
  },

  async updateApplicationStatus(id, newStatus){
    await updateDoc(doc(db, 'applications', id), { status: newStatus });
  },

  async deleteApplication(id){
    await deleteDoc(doc(db, 'applications', id));
  },

  // ── 방문자 (Firestore dedup) ──
  async trackVisit(){
    const today = todayKey(), vid = getVid();
    if(localStorage.getItem('gwellVisitedDay') === today) return;
    try {
      const ref = doc(db, 'visits', today);
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if(!snap.exists()){
          tx.set(ref, { date: today, count: 1, vids: [vid] });
        } else {
          const data = snap.data();
          if((data.vids || []).includes(vid)) return;
          tx.update(ref, { count: increment(1), vids: [...(data.vids || []), vid].slice(-5000) });
        }
      });
      localStorage.setItem('gwellVisitedDay', today);
      if(window.gtag) window.gtag('event', 'unique_daily_visit', { day: today });
    } catch(e){ console.warn('[GwellDB] trackVisit:', e); }
  },

  async getVisits(){
    const snap = await getDocs(collection(db, 'visits'));
    const r = {};
    snap.forEach(d => { r[d.id] = d.data().count || 0; });
    return r;
  },

  // ── 콘텐츠 (텍스트, FAQ, stats 등) ──
  async loadContent(){
    const snap = await getDoc(doc(db, 'settings', 'content'));
    return snap.exists() ? snap.data() : null;
  },
  async saveContent(data){
    await setDoc(doc(db, 'settings', 'content'), { ...data, updatedAt: new Date().toISOString() });
  },
  subscribeContent(cb){
    return onSnapshot(doc(db, 'settings', 'content'), snap => { if(snap.exists()) cb(snap.data()); });
  },

  // ── 색상 ──
  async loadColors(){
    const snap = await getDoc(doc(db, 'settings', 'colors'));
    return snap.exists() ? snap.data() : null;
  },
  async saveColors(colors){
    await setDoc(doc(db, 'settings', 'colors'), colors);
  },

  // ── 사이트 설정 (Webhook, 카카오, WhatsApp, 프로모션 등) ──
  async loadSiteSettings(){
    const snap = await getDoc(doc(db, 'settings', 'site'));
    return snap.exists() ? snap.data() : null;
  },
  async saveSiteSettings(settings){
    await setDoc(doc(db, 'settings', 'site'), { ...settings, updatedAt: new Date().toISOString() });
  },
  subscribeSiteSettings(cb){
    return onSnapshot(doc(db, 'settings', 'site'), snap => { if(snap.exists()) cb(snap.data()); });
  },

  // ── 인증 ──
  async signInAdmin(password){
    return signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  },
  async signOutAdmin(){
    return signOut(auth);
  },
  onAuthChange(cb){
    return onAuthStateChanged(auth, cb);
  },
  isLoggedIn(){
    return !!auth.currentUser;
  }
};

window.dispatchEvent(new Event('gwell-firebase-ready'));
console.log('[GwellDB] Firebase module ready');
