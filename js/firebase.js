// Penyimpanan data via Firebase Firestore (menggantikan Google Apps Script / Google Sheet)
// Struktur: setiap "sheet" = 1 koleksi Firestore, setiap baris = 1 dokumen (ID dokumen = id baris).

const firebaseConfig = {
    apiKey: "AIzaSyBMxx08nbWu9xUvBRpjfFv3t2z8yhwE3No",
    authDomain: "data-sedekah-dan-pundi.firebaseapp.com",
    projectId: "data-sedekah-dan-pundi",
    storageBucket: "data-sedekah-dan-pundi.firebasestorage.app",
    messagingSenderId: "574937018319",
    appId: "1:574937018319:web:5befccba8d6f6cdaf7ecba"
};

// Saat pindah proyek Firebase, buang sisa data proyek lama di perangkat ini
// agar tidak ikut tersimpan ke proyek baru.
(function () {
    try {
        const KEY = 'wiz_firebase_project';
        if (localStorage.getItem(KEY) !== firebaseConfig.projectId) {
            const fixed = ['wiz_user_session', 'wiz_user_email', 'wiz_debug_log', 'wiz_fb_migrated'];
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('wiz_cache_') || k.startsWith('wiz_pending_') || fixed.includes(k)) localStorage.removeItem(k);
            });
            localStorage.setItem(KEY, firebaseConfig.projectId);
        }
    } catch (e) {}
})();

firebase.initializeApp(firebaseConfig);
const fbDb = firebase.firestore();
const fbAuth = firebase.auth();
// Simpan sesi login di perangkat; bila tidak didukung, pakai sesi tab
fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(() => fbAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION))
    .catch(() => {});
try { fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}

const FB_SHEETS = ['Amil', 'Kontak', 'Program', 'Donasi', 'Tugas', 'Pundi', 'RiwayatPundi', 'TargetPundi'];

// Snapshot terakhir per sheet: { rows: Map(id -> signature), maxO: number }
const fbState = {};

const fbRowId = (item, idx) => {
    const id = item && (item.id ?? item.ID ?? item.noUrut);
    return (id !== undefined && id !== null && String(id) !== '') ? String(id) : 'row_' + idx;
};
const fbClean = (item) => JSON.parse(JSON.stringify(item || {}));
const FB_PW_KEYS = ['password', 'Password', 'sandi', 'Sandi'];
// Kata sandi TIDAK PERNAH disimpan di Firestore (dikelola Firebase Authentication)
const fbPrep = (sheet, item, keepPassword) => {
    const c = fbClean(item);
    if (sheet === 'Amil' && !keepPassword) FB_PW_KEYS.forEach(k => delete c[k]);
    return c;
};
const fbSig = (item) => { const c = fbClean(item); delete c._o; return JSON.stringify(c); };
const fbWithTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout Firebase')), ms))]);

const fbLoadSheet = async (sheet, ms = 14000) => {
    const snap = await fbWithTimeout(fbDb.collection(sheet).get(), ms);
    const docs = snap.docs.map(d => ({ docId: d.id, data: d.data() }));
    docs.sort((a, b) => (a.data._o ?? 0) - (b.data._o ?? 0));
    const rows = new Map();
    let maxO = 0;
    const list = docs.map(({ docId, data }) => {
        const o = data._o ?? 0;
        if (o > maxO) maxO = o;
        const item = { ...data };
        delete item._o;
        rows.set(docId, { sig: fbSig(item), o });
        return item;
    });
    fbState[sheet] = { rows, maxO };
    return list;
};

const fbLoadAll = async (ms = 14000) => {
    const out = {};
    const results = await Promise.all(FB_SHEETS.map(s => fbLoadSheet(s, ms).then(list => [s, list])));
    results.forEach(([s, list]) => { out[s] = list; });
    return out;
};

// Simpan perubahan saja (upsert). Hapus dokumen yang tidak ada lagi hanya bila isDelete = true.
const fbSyncSheet = async (sheet, items, isDelete = false, opts = {}) => {
    if (!Array.isArray(items)) return;
    if (!fbState[sheet]) await fbLoadSheet(sheet);
    const st = fbState[sheet];
    const ops = [];
    const seen = new Set();

    items.forEach((item, idx) => {
        const docId = fbRowId(item, idx);
        seen.add(docId);
        const prepared = fbPrep(sheet, item, opts.keepPassword);
        const sig = fbSig(prepared);
        const prev = st.rows.get(docId);
        if (prev && prev.sig === sig) return;
        const o = prev ? prev.o : ++st.maxO;
        ops.push({ type: 'set', docId, data: { ...prepared, _o: o }, sig, o });
    });

    if (isDelete) {
        st.rows.forEach((_, docId) => { if (!seen.has(docId)) ops.push({ type: 'del', docId }); });
    }

    for (let i = 0; i < ops.length; i += 400) {
        const chunk = ops.slice(i, i + 400);
        const batch = fbDb.batch();
        chunk.forEach(op => {
            const ref = fbDb.collection(sheet).doc(op.docId);
            if (op.type === 'set') batch.set(ref, op.data); else batch.delete(ref);
        });
        await fbWithTimeout(batch.commit(), 20000);
        chunk.forEach(op => {
            if (op.type === 'set') st.rows.set(op.docId, { sig: op.sig, o: op.o });
            else st.rows.delete(op.docId);
        });
    }
};

// ================= Firebase Authentication & Peran (roles) =================
// Koleksi "roles": ID dokumen = email huruf kecil, isi { role, status, name }.
// Firestore Rules memakai koleksi ini untuk menentukan Admin / Amil aktif.

const fbEmailKey = (email) => String(email || '').trim().toLowerCase();

const fbAuthMessage = (e) => {
    const c = e && e.code;
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'Email atau kata sandi salah, atau akun belum dibuat di Firebase Console (Authentication > Users > Add user).';
    if (c === 'auth/operation-not-allowed') return 'Metode Email/Password belum diaktifkan di Firebase Console (Authentication > Sign-in method).';
    if (c === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || c === 'auth/invalid-api-key' || c === 'auth/configuration-not-found') return 'Konfigurasi Firebase tidak cocok dengan proyek. Pastikan Authentication sudah diaktifkan (klik Get started) di proyek ini.';
    if (c === 'auth/invalid-email') return 'Format email tidak valid.';
    if (c === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
    if (c === 'auth/network-request-failed') return 'Tidak ada koneksi internet.';
    if (c === 'auth/user-disabled') return 'Akun ini dinonaktifkan.';
    if (c === 'auth/weak-password') return 'Kata sandi minimal 6 karakter.';
    if (c === 'auth/email-already-in-use') return 'Email sudah terdaftar di Firebase Authentication.';
    if (c === 'auth/requires-recent-login') return 'Silakan keluar lalu masuk kembali sebelum mengubah kata sandi.';
    if (c === 'permission-denied') return 'Akses ditolak oleh aturan keamanan Firebase.';
    return ((e && e.message) ? e.message : 'Terjadi kesalahan.') + (c ? ' (' + c + ')' : '');
};

// Pesan untuk galat saat membaca database (Firestore)
const fbDbMessage = (e) => {
    const c = e && e.code;
    if (c === 'permission-denied') return 'Aturan keamanan Firestore menolak akses. Tempel isi firestore.rules di Firestore Database > Rules, lalu Publish.';
    if (c === 'unavailable' || c === 'failed-precondition' || c === 'not-found') return 'Firestore Database belum siap. Buka Firebase Console > Firestore Database > Create database, lalu coba lagi. (' + c + ')';
    return 'Gagal membaca database: ' + ((e && (e.code || e.message)) || 'galat');
};

// Pendaftaran Admin pertama: hanya bisa sekali (dijaga Rules lewat dokumen meta/setup)
const fbSetupExists = async () => {
    const snap = await fbWithTimeout(fbDb.collection('meta').doc('setup').get(), 10000);
    return snap.exists;
};
const fbClaimFirstAdmin = async (email) => {
    const key = fbEmailKey(email);
    const batch = fbDb.batch();
    batch.set(fbDb.collection('meta').doc('setup'), { createdBy: key, createdAt: new Date().toISOString() });
    batch.set(fbDb.collection('roles').doc(key), { role: 'Admin', status: 'Aktif', name: key.split('@')[0] });
    await fbWithTimeout(batch.commit(), 15000);
};

const fbGetRole = async (email) => {
    const snap = await fbWithTimeout(fbDb.collection('roles').doc(fbEmailKey(email)).get(), 10000);
    return snap.exists ? snap.data() : null;
};

// Membuat akun Auth tanpa mengeluarkan Admin yang sedang login (pakai app Firebase kedua)
const fbAuthCreateUser = async (email, password) => {
    let secondary;
    try { secondary = firebase.app('secondary'); } catch (e) { secondary = firebase.initializeApp(firebaseConfig, 'secondary'); }
    const sAuth = secondary.auth();
    try {
        await sAuth.createUserWithEmailAndPassword(fbEmailKey(email), String(password));
    } finally {
        try { await sAuth.signOut(); } catch (e) {}
    }
};

// Samakan koleksi roles dengan daftar Amil. Hanya boleh dijalankan Admin.
const fbRolesState = { map: null };
const fbSyncRoles = async (amilList, isDelete = false) => {
    if (!fbRolesState.map) {
        const snap = await fbWithTimeout(fbDb.collection('roles').get(), 10000);
        fbRolesState.map = new Map();
        snap.docs.forEach(d => fbRolesState.map.set(d.id, JSON.stringify({ role: d.data().role, status: d.data().status, name: d.data().name })));
    }
    const batch = fbDb.batch();
    let n = 0;
    const seen = new Set();
    (amilList || []).forEach(a => {
        const key = fbEmailKey(a.email || a.Email);
        if (!key) return;
        seen.add(key);
        const data = { role: a.role || a.Role || 'Amil', status: a.status || a.Status || 'Aktif', name: a.name || a.Nama || '' };
        const sig = JSON.stringify(data);
        if (fbRolesState.map.get(key) === sig) return;
        batch.set(fbDb.collection('roles').doc(key), data);
        fbRolesState.map.set(key, sig);
        n++;
    });
    if (isDelete) {
        Array.from(fbRolesState.map.keys()).forEach(key => {
            if (!seen.has(key)) { batch.delete(fbDb.collection('roles').doc(key)); fbRolesState.map.delete(key); n++; }
        });
    }
    if (n > 0) await fbWithTimeout(batch.commit(), 15000);
};


// ================= Salin daftar amil dari proyek Firebase LAMA (tanpa kata sandi) =================
const fbOldConfig = {
    apiKey: "AIzaSyAYnbx0PZ0Haz3f8pO0t6v6ARZH2q586nQ",
    authDomain: "studio-6186395770-917c1.firebaseapp.com",
    projectId: "studio-6186395770-917c1",
    storageBucket: "studio-6186395770-917c1.firebasestorage.app",
    messagingSenderId: "354326258179",
    appId: "1:354326258179:web:e7fcc5d41e5d1157a76436"
};

// Masuk ke proyek lama sebagai Admin lama, baca koleksi Amil saja, lalu keluar lagi.
const fbReadOldAmil = async (email, password) => {
    let oldApp;
    try { oldApp = firebase.app('old'); } catch (e) { oldApp = firebase.initializeApp(fbOldConfig, 'old'); }
    const oAuth = oldApp.auth();
    await oAuth.signInWithEmailAndPassword(fbEmailKey(email), String(password));
    try {
        const snap = await fbWithTimeout(oldApp.firestore().collection('Amil').get(), 20000);
        return snap.docs.map(d => { const x = d.data(); delete x._o; return x; });
    } finally {
        try { await oAuth.signOut(); } catch (e) {}
    }
};
