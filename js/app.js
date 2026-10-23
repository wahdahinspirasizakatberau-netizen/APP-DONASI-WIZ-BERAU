const { useState, useEffect, useMemo } = React;

const normalizeAmil = (a) => {
    if (!a) return a;
    const idVal = (a.id !== undefined && a.id !== null && a.id !== '') ? a.id : ((a.ID !== undefined && a.ID !== null && a.ID !== '') ? a.ID : Date.now());
    const nameVal = a.name || a.Nama || a.nama || '';
    const emailVal = a.email || a.Email || '';
    const passVal = a.password !== undefined ? a.password : (a.Password !== undefined ? a.Password : (a.sandi || a.Sandi || ''));
    const roleVal = a.role || a.Role || 'Amil';
    const statusVal = a.status || a.Status || 'Aktif';
    const photoVal = a.photoUrl || a.PhotoUrl || a.foto || a.Foto || a.photo || a.Photo || a['Foto Profil'] || a['foto_profil'] || a.gambar || a.Gambar || '';

    return {
        ...a,
        id: idVal,
        ID: idVal,
        name: nameVal,
        Nama: nameVal,
        nama: nameVal,
        email: emailVal,
        Email: emailVal,
        password: String(passVal),
        Password: String(passVal),
        sandi: String(passVal),
        Sandi: String(passVal),
        role: roleVal,
        Role: roleVal,
        status: statusVal,
        Status: statusVal,
        photoUrl: photoVal,
        PhotoUrl: photoVal,
        Foto: photoVal,
        foto: photoVal,
        Photo: photoVal,
        photo: photoVal,
        'Foto Profil': photoVal,
        'foto_profil': photoVal
    };
};

const App = () => {
    const safeGetJSON = (key, fallback) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch(e) {
            return fallback;
        }
    };
    const safeSetJSON = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch(e) {}
    };
    const safeRemove = (key) => {
        try {
            localStorage.removeItem(key);
        } catch(e) {}
    };
    // Catatan diagnosa singkat (ditampilkan kecil di halaman login)
    const dbg = (msg) => {
        try {
            const arr = JSON.parse(localStorage.getItem('wiz_debug_log') || '[]');
            arr.push(new Date().toLocaleTimeString('id-ID') + ' ' + msg);
            localStorage.setItem('wiz_debug_log', JSON.stringify(arr.slice(-10)));
        } catch(e) {}
    };

    const [user, setUser] = useState(() => {
        const raw = safeGetJSON('wiz_user_session', null);
        return raw ? normalizeAmil(raw) : null;
    });
    const [isInitializing, setIsInitializing] = useState(() => !safeGetJSON('wiz_user_session', null));
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    
    // State Lampu Indikator Jaringan: 'good' (Hijau), 'syncing' (Kuning), 'bad' (Merah)
    const [networkStatus, setNetworkStatus] = useState(() => navigator.onLine ? 'good' : 'bad');
    const [networkNotice, setNetworkNotice] = useState(null);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        try {
            return localStorage.getItem('wiz_dark_mode') === 'true';
        } catch(e) { return false; }
    });
    
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ old: '', new: '' });
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');
    
    const [loginNotice, setLoginNotice] = useState('');
    const [oldAmilEmail, setOldAmilEmail] = useState('');
    const [oldAmilPass, setOldAmilPass] = useState('');
    const [copyingOld, setCopyingOld] = useState(false);
    const [copyOldReport, setCopyOldReport] = useState('');
    const [authMigrating, setAuthMigrating] = useState(false);
    const [authMigrateReport, setAuthMigrateReport] = useState('');
    const [deletePrompt, setDeletePrompt] = useState(null);
    const [viewImage, setViewImage] = useState(null);

    const [amils, setAmils] = useState(() => {
        const cached = safeGetJSON('wiz_cache_Amil', null);
        if (Array.isArray(cached) && cached.length > 0) return cached.map(normalizeAmil);
        return [];
    });
    const [contacts, setContacts] = useState(() => safeGetJSON('wiz_cache_Kontak', []));
    const [programs, setPrograms] = useState(() => safeGetJSON('wiz_cache_Program', []));
    const [donations, setDonations] = useState(() => safeGetJSON('wiz_cache_Donasi', []));
    const [tasks, setTasks] = useState(() => safeGetJSON('wiz_cache_Tugas', []));
    
    const [pundis, setPundis] = useState(() => safeGetJSON('wiz_cache_Pundi', []));
    const [riwayatPundis, setRiwayatPundis] = useState(() => safeGetJSON('wiz_cache_RiwayatPundi', []));

    const [selectedCampaignBreakdown, setSelectedCampaignBreakdown] = useState(null);
    const [campaignSubTab, setCampaignSubTab] = useState('campaigns');

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            try { localStorage.setItem('wiz_dark_mode', 'true'); } catch(e) {}
        } else {
            document.documentElement.classList.remove('dark');
            try { localStorage.setItem('wiz_dark_mode', 'false'); } catch(e) {}
        }
    }, [darkMode]);

    useEffect(() => {
        const handleOnline = () => {
            setNetworkStatus('good');
            setIsOfflineMode(false);
            setNetworkNotice({ type: 'success', text: 'Koneksi internet kembali aktif.' });
            setTimeout(() => setNetworkNotice(null), 3500);
        };
        const handleOffline = () => {
            setNetworkStatus('bad');
            setIsOfflineMode(true);
            setNetworkNotice({ type: 'error', text: 'Koneksi internet terputus. Mengaktifkan mode luring.' });
            setTimeout(() => setNetworkNotice(null), 4000);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchAllData = async (isManualRefresh = false) => {
        const fbUser = fbAuth.currentUser;
        if (!fbUser) { setIsInitializing(false); setIsRefreshing(false); return; }
        if (isManualRefresh) setIsRefreshing(true);
        setNetworkStatus('syncing');

        try {
            const fbData = await fbLoadAll(14000);
            const result = { status: 'success', data: fbData };

            if (result && result.status === 'success' && result.data) {
                const d = result.data;
                if (d.Amil?.length > 0) {
                    const localCachedAmils = safeGetJSON('wiz_cache_Amil', []);
                    const sessionUser = safeGetJSON('wiz_user_session', null);

                    const normalizedAmils = d.Amil.map(serverAmil => {
                        let norm = normalizeAmil(serverAmil);
                        if (!norm.photoUrl || String(norm.photoUrl).trim() === '') {
                            const localMatch = localCachedAmils.find(la => String(la.id || la.ID) === String(norm.id || norm.ID) || String(la.email).toLowerCase() === String(norm.email).toLowerCase());
                            const localPhoto = localMatch?.photoUrl || localMatch?.Foto || (sessionUser && String(sessionUser.email).toLowerCase() === String(norm.email).toLowerCase() ? (sessionUser.photoUrl || sessionUser.Foto) : '');
                            if (localPhoto) {
                                norm = normalizeAmil({ ...norm, photoUrl: localPhoto });
                            }
                        }
                        return norm;
                    });

                    setAmils(normalizedAmils);
                    safeSetJSON('wiz_cache_Amil', normalizedAmils);
                    
                    const savedSession = { email: fbUser.email };
                    if (savedSession) {
                        const foundUser = normalizedAmils.find(a => String(a.email).toLowerCase() === String(savedSession.email).toLowerCase());
                        if (foundUser && String(foundUser.status).trim().toLowerCase() === 'aktif') {
                            setUser(foundUser);
                            safeSetJSON('wiz_user_session', foundUser);
                        } else if (foundUser) {
                            setLoginNotice('Akun Anda berstatus non-aktif. Hubungi Admin.');
                            handleLogout();
                        }
                    }
                }
                if (d.Kontak) { setContacts(d.Kontak); safeSetJSON('wiz_cache_Kontak', d.Kontak); }
                if (d.Program) { setPrograms(d.Program); safeSetJSON('wiz_cache_Program', d.Program); }
                if (d.Donasi) { setDonations(d.Donasi); safeSetJSON('wiz_cache_Donasi', d.Donasi); }
                if (d.Tugas) { setTasks(d.Tugas); safeSetJSON('wiz_cache_Tugas', d.Tugas); }
                if (d.Pundi && !safeGetJSON('wiz_pending_Pundi', false)) { setPundis(d.Pundi); safeSetJSON('wiz_cache_Pundi', d.Pundi); }
                if (d.RiwayatPundi && !safeGetJSON('wiz_pending_RiwayatPundi', false)) { setRiwayatPundis(d.RiwayatPundi); safeSetJSON('wiz_cache_RiwayatPundi', d.RiwayatPundi); }
                
                const sessionEmail = fbEmailKey(fbUser.email);
                dbg('muat data ok, amil=' + (d.Amil || []).length + ', kontak=' + (d.Kontak || []).length);
                const amilNow = (d.Amil || []).find(a => fbEmailKey(a.email || a.Email) === sessionEmail);
                if (!amilNow) {
                    const roleDoc = await fbGetRole(sessionEmail).catch(() => null);
                    if (roleDoc && String(roleDoc.status).trim().toLowerCase() === 'aktif') {
                        const u = normalizeAmil({ id: sessionEmail, name: roleDoc.name || sessionEmail, email: sessionEmail, role: roleDoc.role || 'Amil', status: 'Aktif' });
                        setUser(u);
                        safeSetJSON('wiz_user_session', u);
                    } else {
                        setLoginNotice('Akun belum terdaftar sebagai amil aktif. Periksa dokumen roles (field status harus Aktif).');
                        setNetworkNotice({ type: 'error', text: 'Akun belum terdaftar sebagai amil aktif. Hubungi Admin.' });
                        setTimeout(() => setNetworkNotice(null), 6000);
                        await handleLogout();
                    }
                }

                setIsOfflineMode(false);
                setNetworkStatus('good');
            } else {
                setIsOfflineMode(true);
                setNetworkStatus('bad');
            }
        } catch (err) {
            console.warn('Gagal memuat data Firebase:', err);
            dbg('muat data gagal: ' + ((err && (err.code || err.message)) || 'galat'));
            setLoginNotice('Gagal memuat data (' + ((err && (err.code || err.message)) || 'galat') + '). ' + (err && err.code === 'permission-denied' ? 'Periksa Rules dan dokumen roles (role = Admin, status = Aktif).' : 'Periksa koneksi internet dan pastikan Firestore Database sudah dibuat.'));
            if (err && err.code === 'permission-denied') {
                setNetworkNotice({ type: 'error', text: 'Akses ditolak: akun belum terdaftar sebagai amil aktif atau sedang dinonaktifkan.' });
                setTimeout(() => setNetworkNotice(null), 6000);
                await handleLogout();
            }
            setIsOfflineMode(true);
            setNetworkStatus('bad');
        } finally {
            setIsInitializing(false);
            setIsRefreshing(false);
        }
    };

    // Lengkapi foto profil dari data Amil bila pengguna aktif belum punya foto
    useEffect(() => {
        if (!user || user.photoUrl) return;
        const m = amils.find(a => fbEmailKey(a.email || a.Email) === fbEmailKey(user.email));
        const photo = m && (m.photoUrl || m.Foto || m.PhotoUrl || m['Foto Profil']);
        if (photo) {
            const merged = normalizeAmil({ ...user, photoUrl: photo });
            setUser(merged);
            safeSetJSON('wiz_user_session', merged);
        }
    }, [amils, user]);

    useEffect(() => {
        const unsub = fbAuth.onAuthStateChanged((fbUser) => {
            dbg('auth: ' + (fbUser ? fbUser.email : 'tidak ada sesi'));
            if (fbUser) {
                fetchAllData();
            } else {
                setUser(null);
                safeRemove('wiz_user_session');
                setIsInitializing(false);
            }
        });
        return () => unsub();
    }, []);

    const handleLogin = async (email, password, setError) => {
        const cleanEmail = fbEmailKey(email);
        const cleanPassword = String(password || '');
        setLoginNotice('');
        try {
            if (typeof setError === 'function') setError('');
            await fbAuth.signInWithEmailAndPassword(cleanEmail, cleanPassword);
            let roleReadErr = null;
            let roleDoc = await fbGetRole(cleanEmail).catch((e) => { roleReadErr = e; dbg('baca roles gagal: ' + (e && (e.code || e.message))); return null; });
            if (roleReadErr) {
                await fbAuth.signOut();
                if (typeof setError === 'function') setError(fbDbMessage(roleReadErr));
                return;
            }
            if (!roleDoc) {
                // Pendaftaran awal: bila email ini tercatat sebagai Admin aktif di data Amil, daftarkan semua amil ke koleksi roles
                try {
                    const amilList = await fbLoadSheet('Amil', 10000);
                    const me = amilList.find(a => fbEmailKey(a.email || a.Email) === cleanEmail);
                    const meRole = me ? String(me.role || me.Role || '').trim().toLowerCase() : '';
                    const meStatus = me ? String(me.status || me.Status || 'Aktif').trim().toLowerCase() : '';
                    if (me && meRole === 'admin' && meStatus === 'aktif') {
                        await fbSyncRoles(amilList.map(normalizeAmil), false);
                        roleDoc = await fbGetRole(cleanEmail).catch(() => null);
                        dbg('pendaftaran roles: ' + (roleDoc ? 'berhasil' : 'gagal'));
                    } else {
                        dbg('email tidak ada di data Amil sebagai Admin aktif');
                    }
                } catch (e) { dbg('pendaftaran roles gagal: ' + ((e && (e.code || e.message)) || 'galat')); }
            }
            if (!roleDoc) {
                // Proyek baru tanpa Admin: tawarkan menjadikan akun ini Admin pertama
                try {
                    if (!(await fbSetupExists()) && window.confirm('Proyek ini belum punya Admin. Jadikan ' + cleanEmail + ' sebagai Admin pertama?')) {
                        await fbClaimFirstAdmin(cleanEmail);
                        roleDoc = await fbGetRole(cleanEmail).catch(() => null);
                        dbg('Admin pertama: ' + (roleDoc ? 'berhasil' : 'gagal'));
                    }
                } catch (e) {
                    dbg('Admin pertama gagal: ' + (e && (e.code || e.message)));
                    await fbAuth.signOut();
                    if (typeof setError === 'function') setError(fbDbMessage(e));
                    return;
                }
            }
            dbg('login ok, roles=' + (roleDoc ? roleDoc.role + '/' + roleDoc.status : 'tidak ada'));
            if (!roleDoc) {
                await fbAuth.signOut();
                if (typeof setError === 'function') setError('Akun belum terdaftar. Buat dokumen roles dengan ID email Anda (huruf kecil), role = Admin, status = Aktif.');
            } else if (String(roleDoc.status).trim().toLowerCase() !== 'aktif') {
                await fbAuth.signOut();
                if (typeof setError === 'function') setError('Akses ditolak: Akun non-aktif atau diblokir.');
            } else {
                // Tampilkan aplikasi langsung; data lengkap dimuat oleh fetchAllData
                const existingSession = safeGetJSON('wiz_user_session', null);
                const sameSession = existingSession && fbEmailKey(existingSession.email) === cleanEmail;
                const quickUser = sameSession
                    ? normalizeAmil(existingSession)
                    : normalizeAmil({ id: cleanEmail, name: roleDoc.name || cleanEmail, email: cleanEmail, role: roleDoc.role || 'Amil', status: 'Aktif' });
                setUser(prev => (prev && fbEmailKey(prev.email) === cleanEmail) ? prev : quickUser);
                if (!sameSession) safeSetJSON('wiz_user_session', quickUser);
            }
            // Bila lolos, onAuthStateChanged memuat data dan menetapkan user.
        } catch (err) {
            if (typeof setError === 'function') setError(fbAuthMessage(err));
        }
    };

    const handleForgotPassword = async (email, setError) => {
        const cleanEmail = fbEmailKey(email);
        if (!cleanEmail) { if (typeof setError === 'function') setError('Isi email dulu, lalu klik "Lupa kata sandi".'); return; }
        try {
            await fbAuth.sendPasswordResetEmail(cleanEmail);
            if (typeof setError === 'function') setError('Jika email terdaftar, tautan reset kata sandi sudah dikirim. Periksa kotak masuk/spam.');
        } catch (err) {
            if (typeof setError === 'function') setError(fbAuthMessage(err));
        }
    };

    const handleLogout = async () => {
        dbg('keluar/logout dipanggil');
        safeRemove('wiz_user_session');
        safeRemove('wiz_user_email');
        setUser(null);
        try { await fbAuth.signOut(); } catch (e) {}
    };

    const syncDataToSheet = async (sheetName, newData, itemsToAdd = null, isDelete = false) => {
        let finalDataToSave = Array.isArray(newData) ? [...newData] : newData;

        if (Array.isArray(finalDataToSave) && !isDelete) {
            const cached = safeGetJSON('wiz_cache_' + sheetName, []);
            if (Array.isArray(cached) && cached.length > finalDataToSave.length) {
                const map = new Map();
                cached.forEach(item => {
                    if (item && (item.id || item.ID || item.noUrut)) {
                        map.set(String(item.id || item.ID || item.noUrut), item);
                    }
                });
                finalDataToSave.forEach(item => {
                    if (item && (item.id || item.ID || item.noUrut)) {
                        map.set(String(item.id || item.ID || item.noUrut), item);
                    }
                });
                finalDataToSave = Array.from(map.values());
            }
        }

        safeSetJSON('wiz_cache_' + sheetName, finalDataToSave);

        if (!navigator.onLine) {
            safeSetJSON('wiz_pending_' + sheetName, true);
            setNetworkStatus('bad');
            setIsOfflineMode(true);
            setNetworkNotice({
                type: 'warning',
                text: '⚠️ Sinyal offline! Data tersimpan aman di memori HP dan akan disinkronkan ke Firebase saat online.'
            });
            setTimeout(() => setNetworkNotice(null), 6000);
            return;
        }

        setNetworkStatus('syncing');

        try {
            await fbSyncSheet(sheetName, finalDataToSave, isDelete);
            if (sheetName === 'Amil' && (user?.role || user?.Role) === 'Admin') await fbSyncRoles(finalDataToSave, isDelete);

            safeRemove('wiz_pending_' + sheetName);
            setNetworkStatus('good');
            setIsOfflineMode(false);
        } catch (err) {
            console.error('Gagal sinkron ' + sheetName + ':', err);
            safeSetJSON('wiz_pending_' + sheetName, true);
            setNetworkStatus('bad');
            setIsOfflineMode(true);
            setNetworkNotice({
                type: 'error',
                text: '⚠️ Gagal menyimpan "' + sheetName + '" ke Firebase (' + (err && err.message ? err.message : 'jaringan') + '). Data tetap aman di HP.'
            });
            setTimeout(() => setNetworkNotice(null), 6000);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwdError(''); setPwdSuccess('');
        if (passwordForm.new.length < 6) return setPwdError('Sandi baru minimal 6 karakter.');
        const cu = fbAuth.currentUser;
        if (!cu) return setPwdError('Sesi berakhir. Silakan masuk kembali.');
        try {
            const cred = firebase.auth.EmailAuthProvider.credential(cu.email, passwordForm.old);
            await cu.reauthenticateWithCredential(cred);
            await cu.updatePassword(passwordForm.new);
        } catch (err) {
            const wrong = err && (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password');
            return setPwdError(wrong ? 'Sandi lama salah.' : fbAuthMessage(err));
        }
        setPwdSuccess('Kata sandi diperbarui.');
        setTimeout(() => { setIsPasswordModalOpen(false); setPasswordForm({ old: '', new: '' }); setPwdSuccess(''); }, 1500);
    };

    const createSaveHandler = (setter, state, sheetName) => (data, isEdit) => {
        if (sheetName === 'Amil' && !isEdit) {
            const pw = String((data && (data.password || data.Password)) || '');
            if (pw.length < 6) {
                setNetworkNotice({ type: 'error', text: 'Kata sandi awal amil baru minimal 6 karakter.' });
                setTimeout(() => setNetworkNotice(null), 5000);
                return;
            }
            fbAuthCreateUser(data.email, pw)
                .then(() => saveCore(setter, state, sheetName, data, isEdit))
                .catch(err => {
                    setNetworkNotice({ type: 'error', text: 'Gagal membuat akun login: ' + fbAuthMessage(err) });
                    setTimeout(() => setNetworkNotice(null), 6000);
                });
            return;
        }
        saveCore(setter, state, sheetName, data, isEdit);
    };

    const saveCore = (setter, state, sheetName, data, isEdit) => {
        let newDataToSave = { ...data };
        if (!isEdit && sheetName === 'Kontak' && user) newDataToSave.createdBy = user.name;
        
        if (sheetName === 'Amil') {
            if (!isEdit && !newDataToSave.id && !newDataToSave.ID) {
                newDataToSave.id = Date.now();
                newDataToSave.ID = newDataToSave.id;
            }
            newDataToSave = normalizeAmil(newDataToSave);
            newDataToSave.password = newDataToSave.Password = newDataToSave.sandi = newDataToSave.Sandi = '';
        } else {
            if (!isEdit && !newDataToSave.id) {
                newDataToSave.id = Date.now();
            }
        }
        
        const targetId = String(newDataToSave.id || newDataToSave.ID);
        let newData = isEdit 
            ? state.map(item => String(item.id || item.ID) === targetId ? { ...item, ...newDataToSave } : item) 
            : [...state, newDataToSave];

        setter(newData);
        safeSetJSON('wiz_cache_' + sheetName, newData);
        syncDataToSheet(sheetName, newData);

        if (sheetName === 'Amil' && user && (String(newDataToSave.id) === String(user.id || user.ID) || String(newDataToSave.email).toLowerCase() === String(user.email).toLowerCase())) {
            const updatedUser = normalizeAmil({ ...user, ...newDataToSave });
            setUser(updatedUser);
            safeSetJSON('wiz_user_session', updatedUser);
        }
    };

    const createDeleteHandler = (setter, state, sheetName) => (row) => setDeletePrompt({ row, setter, state, sheetName });

    const migrateAmilToAuth = async () => {
        if (!isAdmin) return;
        setAuthMigrating(true);
        setAuthMigrateReport('');
        let created = 0, existed = 0, viaReset = 0, failed = 0;
        const notes = [];
        for (const a of amils) {
            const email = fbEmailKey(a.email || a.Email);
            if (!email) continue;
            const legacy = String(a.password || a.Password || a.sandi || a.Sandi || '');
            try {
                if (legacy.length >= 6) {
                    await fbAuthCreateUser(email, legacy);
                    created++;
                } else {
                    await fbAuthCreateUser(email, Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'Aa1');
                    try { await fbAuth.sendPasswordResetEmail(email); } catch (e) {}
                    viaReset++;
                }
            } catch (err) {
                if (err && err.code === 'auth/email-already-in-use') existed++;
                else { failed++; notes.push(email + ': ' + fbAuthMessage(err)); }
            }
        }
        try {
            if (failed === 0) {
                const stripped = amils.map(a => normalizeAmil({ ...a, password: '' }));
                setAmils(stripped);
                safeSetJSON('wiz_cache_Amil', stripped);
                await fbSyncSheet('Amil', stripped, false);
                await fbSyncRoles(stripped, false);
            } else {
                await fbSyncRoles(amils, false);
                notes.push('Kata sandi lama belum dihapus dari database karena ada yang gagal. Perbaiki lalu jalankan lagi.');
            }
        } catch (err) {
            failed++;
            notes.push('Gagal menyimpan: ' + fbAuthMessage(err));
        }
        setAuthMigrating(false);
        setAuthMigrateReport('Selesai. Akun baru: ' + created + ', via tautan reset: ' + viaReset + ', sudah ada: ' + existed + ', gagal: ' + failed + '.' + (notes.length ? ' ' + notes.join(' | ') : ''));
    };

    const activateAllAmil = async () => {
        if (!isAdmin) return;
        setAuthMigrating(true);
        setAuthMigrateReport('');
        try {
            const activated = amils.map(a => normalizeAmil({ ...a, status: 'Aktif' }));
            setAmils(activated);
            safeSetJSON('wiz_cache_Amil', activated);
            await fbSyncSheet('Amil', activated, false, { keepPassword: true });
            await fbSyncRoles(activated, false);
            setAuthMigrateReport('Semua ' + activated.length + ' amil sekarang berstatus Aktif dan tercatat di koleksi roles.');
        } catch (err) {
            setAuthMigrateReport('Gagal: ' + fbAuthMessage(err));
        }
        setAuthMigrating(false);
    };

    // Salin akun amil dari proyek Firebase lama: data profil + akun login baru (kata sandi diatur lewat email reset)
    const copyAmilFromOldProject = async () => {
        if (!isAdmin) return;
        if (!oldAmilEmail.trim() || !oldAmilPass) { setCopyOldReport('Isi email dan kata sandi Admin proyek lama.'); return; }
        setCopyingOld(true);
        setCopyOldReport('');
        const notes = [];
        let copied = 0, existed = 0, invalid = 0, failedAuth = 0;
        try {
            const oldList = await fbReadOldAmil(oldAmilEmail, oldAmilPass);
            const known = new Set(amils.map(a => fbEmailKey(a.email || a.Email)));
            const added = [];
            for (const raw of oldList) {
                const a = normalizeAmil({ ...raw, password: '' });
                const email = fbEmailKey(a.email || a.Email);
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid++; notes.push((a.name || a.Nama || '?') + ': email "' + email + '" tidak valid'); continue; }
                if (known.has(email)) { existed++; continue; }
                try {
                    await fbAuthCreateUser(email, Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'Aa1');
                } catch (err) {
                    if (!(err && err.code === 'auth/email-already-in-use')) { failedAuth++; notes.push(email + ': ' + fbAuthMessage(err)); continue; }
                }
                try { await fbAuth.sendPasswordResetEmail(email); } catch (e) { notes.push(email + ': email reset gagal dikirim'); }
                known.add(email);
                added.push(a);
                copied++;
            }
            if (added.length > 0) {
                const merged = [...amils, ...added].map(a => normalizeAmil({ ...a, password: '' }));
                setAmils(merged);
                safeSetJSON('wiz_cache_Amil', merged);
                await fbSyncSheet('Amil', merged, false);
                await fbSyncRoles(merged, false);
            }
            setCopyOldReport('Selesai. Disalin: ' + copied + ', sudah ada: ' + existed + ', email tidak valid: ' + invalid + ', akun gagal: ' + failedAuth + '.' + (notes.length ? ' ' + notes.join(' | ') : ''));
        } catch (err) {
            setCopyOldReport('Gagal: ' + fbAuthMessage(err));
        }
        setCopyingOld(false);
        setOldAmilPass('');
    };

    const confirmDelete = () => {
        if (!deletePrompt) return;
        const { row, setter, state, sheetName } = deletePrompt;
        const targetId = String(row.id || row.ID);
        const newData = state.filter(item => String(item.id || item.ID) !== targetId);
        setter(newData);
        safeSetJSON('wiz_cache_' + sheetName, newData);
        syncDataToSheet(sheetName, newData, null, true);
        setDeletePrompt(null);
    };

    const calculatedPrograms = useMemo(() => {
        const totalPundiCollected = riwayatPundis
            .filter(r => r.status === 'Berhasil')
            .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        return programs.map(p => {
            const isPundiCampaign = (p.category && p.category.includes('Pundi')) || (p.name && p.name.toLowerCase().includes('pundi'));
            const isAmilSpecific = p.assignedAmil && p.assignedAmil !== 'Semua Amil (Target Kolektif)' && p.assignedAmil !== 'Semua Amil';
            
            const donationCollected = donations
                .filter(d => d.programName === p.name && d.status === 'Berhasil')
                .filter(d => !isAmilSpecific || d.amilName === p.assignedAmil)
                .reduce((sum, d) => sum + Number(d.amount || 0), 0);
                
            const pundiCollected = riwayatPundis
                .filter(r => r.status === 'Berhasil')
                .filter(r => !isAmilSpecific || r.amilName === p.assignedAmil)
                .reduce((sum, r) => sum + Number(r.amount || 0), 0);

            const collected = isPundiCampaign ? (donationCollected + (isAmilSpecific ? pundiCollected : totalPundiCollected)) : donationCollected;
            return { ...p, collected, isPundiCampaign, isAmilSpecific };
        });
    }, [programs, donations, riwayatPundis]);

    if (isInitializing) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-wiz-light dark:bg-gray-900 transition-colors">
            <div className="w-24 h-24 mb-6 relative">
                <div className="absolute inset-0 rounded-full border-t-4 border-wiz-green animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-r-4 border-wiz-orange animate-spin animation-delay-150"></div>
                <i className="fa-solid fa-leaf absolute inset-0 flex items-center justify-center text-3xl text-wiz-green dark:text-emerald-400"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Menyiapkan Workspace...</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sinkronisasi data awan</p>
        </div>
    );

    if (!user) return typeof window.LoginScreen !== 'undefined' ? <window.LoginScreen notice={loginNotice} onLogin={handleLogin} onForgot={handleForgotPassword} amilsData={amils} darkMode={darkMode} setDarkMode={setDarkMode} onRefresh={() => fetchAllData(true)} isRefreshing={isRefreshing} /> : <div>Memuat layar masuk...</div>;
    if (!user) return typeof window.LoginScreen !== 'undefined' ? <window.LoginScreen notice={loginNotice} onLogin={handleLogin} onForgot={handleForgotPassword} amilsData={amils} darkMode={darkMode} setDarkMode={setDarkMode} onRefresh={() => fetchAllData(true)} isRefreshing={isRefreshing} /> : <div className="h-screen flex items-center justify-center font-bold text-gray-400">Memuat komponen masuk...</div>;

    const isAdmin = (user?.role || user?.Role) === 'Admin';
    const visibleContacts = isAdmin ? contacts : contacts.filter(c => c.createdBy === user.name);
    // Mengambil daftar nama donatur secara aman dan fleksibel
    const contactOptions = visibleContacts
        .map(c => c.name || c.Nama || c.nama || c['Nama Lengkap'] || c.donatur || '')
        .filter(Boolean);

    // Impor massal dari CSV: tambahkan semua baris sekaligus lalu sinkronkan sekali
    const createImportHandler = (setter, state, sheetName) => (items) => {
        let list = items;
        let skipped = 0;
        if (sheetName === 'Kontak') {
            const digits = (v) => String(v || '').replace(/\D/g, '');
            const seen = new Set(state.map(c => digits(c.phone)).filter(Boolean));
            list = items.filter(it => {
                const d = digits(it.phone);
                if (d && seen.has(d)) { skipped++; return false; }
                if (d) seen.add(d);
                return true;
            });
        }
        const base = Date.now();
        const prepared = list.map((it, i) => {
            const o = { ...it, id: base + i };
            if (sheetName === 'Kontak' && user) o.createdBy = user.name;
            return o;
        });
        if (prepared.length > 0) {
            const newData = [...state, ...prepared];
            setter(newData);
            safeSetJSON('wiz_cache_' + sheetName, newData);
            syncDataToSheet(sheetName, newData);
        }
        return { added: prepared.length, skipped };
    };

    const handleSaveContact = (formData, isEdit) => {
        let newDataToSave = { ...formData };
        if (!isEdit && user) newDataToSave.createdBy = user.name;
        if (!isEdit && !newDataToSave.id) newDataToSave.id = Date.now();
        let newContacts = isEdit ? contacts.map(item => String(item.id) === String(newDataToSave.id) ? newDataToSave : item) : [...contacts, newDataToSave];
        setContacts(newContacts);
        syncDataToSheet('Kontak', newContacts);
    };

    const contactConfig = {
        title: 'Data Kontak', data: visibleContacts,
        onSave: handleSaveContact, onImport: createImportHandler(setContacts, contacts, 'Kontak'), onDelete: createDeleteHandler(setContacts, contacts, 'Kontak'),
        columns: [
            { key: 'name', label: 'Nama' },
            { key: 'phone', label: 'No. Telp / WA', render: r => <span className="font-medium text-gray-800 dark:text-gray-200">{r.phone}</span> },
            { key: 'sosmed', label: 'Media Sosial', render: r => (
                <div className="flex gap-3 text-lg">
                    {r.fb && String(r.fb).trim() !== '-' && <a href={String(r.fb).startsWith('http') ? r.fb : `https://facebook.com/${r.fb}`} target="_blank" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 transition-colors"><i className="fa-brands fa-facebook"></i></a>}
                    {r.ig && String(r.ig).trim() !== '-' && <a href={String(r.ig).startsWith('http') ? r.ig : `https://instagram.com/${r.ig}`} target="_blank" className="text-pink-500 hover:text-pink-700 dark:text-pink-400 transition-colors"><i className="fa-brands fa-instagram"></i></a>}
                    {r.tiktok && String(r.tiktok).trim() !== '-' && <a href={String(r.tiktok).startsWith('http') ? r.tiktok : `https://tiktok.com/@${r.tiktok}`} target="_blank" className="text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors"><i className="fa-brands fa-tiktok"></i></a>}
                </div>
            )},
            { key: 'address', label: 'Domisili', render: r => <span className="truncate max-w-[150px] inline-block text-gray-500 dark:text-gray-400">{r.address}</span> }
        ],
        schema: [
            { name: 'name', label: 'Nama Lengkap', required: true },
            { name: 'phone', label: 'No. HP Utama', required: true },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'fb', label: 'Link Facebook' },
            { name: 'ig', label: 'Link Instagram' },
            { name: 'tiktok', label: 'Link TikTok' },
            { name: 'address', label: 'Alamat Domisili', type: 'berau_address', fullWidth: true }
        ]
    };

    const programConfig = {
        title: 'Campaign WIZ BERAU', data: calculatedPrograms,
        onSave: createSaveHandler(setPrograms, programs, 'Program'), onImport: createImportHandler(setPrograms, programs, 'Program'), onDelete: createDeleteHandler(setPrograms, programs, 'Program'),
        columns: [
            { key: 'name', label: 'Nama Campaign', render: r => (
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 dark:text-gray-100">{r.name}</span>
                        {r.isPundiCampaign && (
                            <span className="px-2 py-0.5 bg-wiz-orange/10 dark:bg-amber-900/30 text-wiz-orange dark:text-amber-400 text-[11px] font-bold rounded-md flex items-center gap-1 border border-wiz-orange/20">
                                <i className="fa-solid fa-box-open"></i> Sinkron Pundi
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{r.category || (r.isPundiCampaign ? 'Pundi (Kotak Amal)' : 'Reguler')}</span>
                        {r.assignedAmil && r.assignedAmil !== 'Semua Amil (Target Kolektif)' ? (
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[11px] font-semibold rounded-md flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                                <i className="fa-solid fa-user-tag text-[10px]"></i> Amil: {r.assignedAmil}
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-semibold rounded-md flex items-center gap-1">
                                <i className="fa-solid fa-users text-[10px]"></i> Semua Amil
                            </span>
                        )}
                    </div>
                </div>
            )},
            { key: 'target', label: 'Target', render: r => typeof formatRp !== 'undefined' ? formatRp(r.target) : r.target },
            { key: 'collected', label: 'Terkumpul', render: r => (
                <div>
                    <span className="text-wiz-green dark:text-emerald-400 font-bold">{typeof formatRp !== 'undefined' ? formatRp(r.collected) : r.collected}</span>
                    {r.target > 0 && (
                        <span className="ml-2 text-xs text-gray-400 font-medium">({Math.min(Math.round((r.collected / r.target) * 100), 100)}%)</span>
                    )}
                </div>
            )},
            { key: 'status', label: 'Status', render: r => <StatusBadge text={r.status} /> },
            { key: 'kontribusi', label: 'Rincian Capaian', render: r => (
                <button
                    type="button"
                    onClick={() => setSelectedCampaignBreakdown(r)}
                    className="px-2.5 py-1 text-xs font-semibold bg-wiz-green/10 hover:bg-wiz-green text-wiz-green hover:text-white dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 border border-wiz-green/20"
                    title="Lihat Capaian Masing-Masing Amil"
                >
                    <i className="fa-solid fa-chart-simple"></i> Capaian Amil
                </button>
            )}
        ],
        schema: [
            { name: 'name', label: 'Nama Campaign / Program', required: true, fullWidth: true },
            { name: 'category', label: 'Jenis / Sumber Dana', type: 'select', options: ['Reguler (Donasi Umum)', 'Pundi (Kotak Amal)'], required: true },
            { name: 'assignedAmil', label: 'Penanggung Jawab / Amil', type: 'select', options: ['Semua Amil (Target Kolektif)', ...amils.map(a => a.name || a.Nama)], required: true },
            { name: 'target', label: 'Target Pendanaan', isCurrency: true, required: true },
            { name: 'deadline', label: 'Berakhir Pada', type: 'date', required: true },
            { name: 'status', label: 'Status Aktif', type: 'select', options: ['Aktif', 'Selesai', 'Dibatalkan'], required: true }
        ]
    };

    const donationConfig = {
        title: 'Data Transaksi', data: donations,
        defaultValues: { amilName: user?.name || user?.Nama, date: new Date().toISOString().split('T')[0] },
        onSave: createSaveHandler(setDonations, donations, 'Donasi'), onImport: createImportHandler(setDonations, donations, 'Donasi'), onDelete: createDeleteHandler(setDonations, donations, 'Donasi'),
        columns: [
            { key: 'date', label: 'Tanggal', render: r => typeof formatDate !== 'undefined' ? formatDate(r.date) : r.date },
            { key: 'donorName', label: 'Donatur', render: r => <span className="font-semibold">{r.donorName}</span> },
            { key: 'programName', label: 'Program' },
            { key: 'rekening', label: 'Bank' },
            { key: 'amount', label: 'Nominal', render: r => <span className="font-bold text-wiz-green dark:text-emerald-400 bg-wiz-green/5 dark:bg-wiz-green/20 px-2 py-1 rounded-md">{typeof formatRp !== 'undefined' ? formatRp(r.amount) : r.amount}</span> },
            { key: 'status', label: 'Status', render: r => typeof StatusBadge !== 'undefined' ? <StatusBadge text={r.status} /> : <span>{r.status}</span> },
            { key: 'amilName', label: 'PIC' },
            { key: 'receiptUrl', label: 'Bukti', render: r => {
                if (!r.receiptUrl || String(r.receiptUrl).trim() === '') return <span className="text-gray-300 dark:text-gray-600">-</span>;
                const directUrl = typeof getDirectImageUrl !== 'undefined' ? getDirectImageUrl(r.receiptUrl) : r.receiptUrl;
                return (
                    <div className="relative group w-10 h-10">
                        <img 
                            src={directUrl} alt="Bukti" 
                            onClick={() => setViewImage({ direct: directUrl, original: r.receiptUrl })}
                            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                            className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer group-hover:opacity-75 transition-opacity shadow-sm" 
                            title="Klik untuk perbesar"
                        />
                        <div 
                            style={{display: 'none'}} 
                            onClick={() => setViewImage({ direct: directUrl, original: r.receiptUrl })}
                            className="absolute inset-0 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex-col items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-wiz-orange transition-colors"
                        >
                            <i className="fa-solid fa-expand text-lg"></i>
                        </div>
                    </div>
                );
            }}
        ],
        schema: [
            { name: 'donorName', label: 'Donatur Hamba Allah', type: 'autocomplete', options: contactOptions, required: true, placeholder: 'Ketik nama donatur untuk mencari...' },
            { name: 'programName', label: 'Tujuan Program', type: 'autocomplete', options: programs.map(p => p.name || p.Nama || '').filter(Boolean), required: true, placeholder: 'Ketik nama program untuk mencari...' },
            { name: 'rekening', label: 'Bank / Metode', type: 'select', options: ['BSI', 'Muamalat', 'QRIS', 'Tunai', 'Lainnya'], required: true },
            { name: 'amount', label: 'Nominal', isCurrency: true, required: true },
            { name: 'date', label: 'Tanggal Bayar', type: 'date', required: true },
            { name: 'status', label: 'Status Transfer', type: 'select', options: ['Berhasil', 'Menunggu Validasi', 'Gagal'], required: true },
            { name: 'amilName', label: 'PIC Amil', type: 'select', options: amils.map(a => a.name || a.Nama), required: true },
            { name: 'receiptUrl', label: 'Bukti Validasi (Opsional)', type: 'file', fullWidth: true }
        ]
    };

    const visibleTasks = isAdmin ? tasks : tasks.filter(t => t.assignedTo === (user?.name || user?.Nama));

    const taskConfig = {
        title: 'Tugas Operasional', data: visibleTasks,
        onSave: createSaveHandler(setTasks, tasks, 'Tugas'), onImport: createImportHandler(setTasks, tasks, 'Tugas'), onDelete: createDeleteHandler(setTasks, tasks, 'Tugas'),
        columns: [
            { key: 'name', label: 'Uraian Tugas', render: r => <span className="font-semibold text-gray-700 dark:text-gray-200">{r.name}</span> },
            { key: 'assignedTo', label: 'Pelaksana' },
            { key: 'period', label: 'Siklus', render: r => <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-gray-600 dark:text-gray-300">{r.period}</span> },
            { key: 'deadline', label: 'Batas', render: r => typeof formatDate !== 'undefined' ? formatDate(r.deadline) : r.deadline },
            { key: 'status', label: 'Progress', render: r => <StatusBadge text={r.status} /> }
        ],
        schema: [
            { name: 'name', label: 'Deskripsi Pekerjaan', required: true, fullWidth: true },
            { name: 'assignedTo', label: 'Bebankan Kepada', type: 'select', options: amils.map(a => a.name || a.Nama), required: true },
            { name: 'period', label: 'Siklus Repetisi', type: 'select', options: ['Harian', 'Bulanan', 'Tahunan'], required: true },
            { name: 'deadline', label: 'Target Selesai', type: 'date', required: true },
            { name: 'status', label: 'Status Pengerjaan', type: 'select', options: ['Belum Selesai', 'Dalam Proses', 'Selesai'], required: true }
        ]
    };

    const amilConfig = {
        title: 'Akses Sistem', 
        data: amils,
        defaultValues: { role: 'Amil', status: 'Aktif', photoUrl: '' },
        onSave: createSaveHandler(setAmils, amils, 'Amil'), 
        onDelete: createDeleteHandler(setAmils, amils, 'Amil'),
        columns: [
            { 
                key: 'photoUrl', 
                label: 'Foto Profil', 
                render: r => {
                    const photo = r.photoUrl || r.PhotoUrl || r.foto || r.Foto || r.photo || r.Photo || r['Foto Profil'] || '';
                    const direct = typeof getDirectImageUrl !== 'undefined' ? getDirectImageUrl(photo) : photo;
                    return (
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-wiz-green/10 text-wiz-green dark:text-emerald-400 flex items-center justify-center font-bold text-sm border-2 border-white dark:border-gray-700 shadow-sm shrink-0">
                            {direct ? (
                                <img 
                                    src={direct} 
                                    alt={r.name || r.Nama} 
                                    className="w-full h-full object-cover cursor-pointer" 
                                    onClick={() => setViewImage ? setViewImage({ direct: direct, original: photo }) : window.open(direct, '_blank')} 
                                    onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }} 
                                />
                            ) : null}
                            <span style={{ display: direct ? 'none' : 'block' }}>{(r.name || r.Nama)?.charAt(0) || 'A'}</span>
                        </div>
                    );
                }
            },
            { key: 'name', label: 'Nama Pengguna', render: r => <span className="font-bold text-gray-800 dark:text-gray-100">{r.name || r.Nama}</span> },
            { key: 'email', label: 'Kredensial', render: r => <span className="text-gray-600 dark:text-gray-300 text-xs">{r.email || r.Email}</span> },
            { key: 'role', label: 'Hak Akses', render: r => {
                const roleVal = r.role || r.Role || 'Amil';
                return <span className={`font-bold ${roleVal === 'Admin' ? 'text-wiz-orange dark:text-amber-400' : 'text-wiz-green dark:text-emerald-400'}`}>{roleVal}</span>;
            }},
            { key: 'status', label: 'Status', render: r => <StatusBadge text={r.status || r.Status || 'Aktif'} /> }
        ],
        schema: [
            { name: 'photoUrl', label: 'Foto Profil Amil (Pilih Berkas atau Tempel URL)', type: 'file', fullWidth: true },
            { name: 'name', label: 'Nama Lengkap', required: true },
            { name: 'email', label: 'Email Akses', type: 'email', required: true },
            { name: 'password', label: 'Kata Sandi Awal (hanya akun baru, min. 6 karakter)', required: false },
            { name: 'role', label: 'Hak Akses', type: 'select', options: ['Admin', 'Amil'], required: true },
            { name: 'status', label: 'Status Akun', type: 'select', options: ['Aktif', 'Nonaktif'], required: true }
        ]
    };

    const navItems = [
        { id: 'dashboard', label: 'Beranda Utama', icon: 'fa-solid fa-border-all' },
        { id: 'pundi', label: 'Manajemen Pundi', icon: 'fa-solid fa-box-open' },
        { id: 'scanner', label: 'Pindai QR Pundi', icon: 'fa-solid fa-qrcode' },
        { id: 'donatur_donasi', label: 'Donatur & Penerimaan', icon: 'fa-solid fa-hand-holding-heart' },
        { id: 'program', label: 'Campaign WIZ', icon: 'fa-solid fa-boxes-packing' },
        { id: 'tugas', label: 'Penugasan', icon: 'fa-solid fa-clipboard-check' },
    ];
    if (isAdmin) navItems.push({ id: 'amil', label: 'Pengaturan Sistem', icon: 'fa-solid fa-gear' });

    return (
        <div className="flex h-screen bg-wiz-light dark:bg-gray-900 overflow-hidden transition-colors duration-200">
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-gray-900/60 dark:bg-black/75 backdrop-blur-sm z-[55] lg:hidden" 
                    onClick={() => setIsMobileMenuOpen(false)} 
                />
            )}
            
            <aside className={`fixed lg:static inset-y-0 left-0 z-[60] lg:z-40 w-72 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-[4px_0_24px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
                <div className="px-6 py-7 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                    <img 
                        src="https://drive.google.com/uc?id=1TcpcZtGKBKAOBAthf6Rea4HHDZ0l9tBU" 
                        alt="Logo WIZ" 
                        className="h-9 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }}
                    />
                    <div style={{display: 'none'}} className="text-2xl font-black text-wiz-green dark:text-emerald-400 tracking-tighter">WIZ<span className="text-wiz-orange">BERAU</span></div>
                    
                    <button 
                        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-red-500" 
                        onClick={() => setIsMobileMenuOpen(false)} 
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                
                <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 mt-1">Menu Navigasi</p>
                    {navItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 text-[14px] font-semibold
                                ${isActive ? 'bg-gradient-to-r from-wiz-green to-[#2e8870] text-white shadow-md shadow-wiz-green/20 translate-x-1 font-bold' 
                                : 'text-gray-600 dark:text-gray-300 hover:bg-wiz-green/5 dark:hover:bg-gray-700/60 hover:text-wiz-green dark:hover:text-emerald-400'}`}>
                                <i className={`${item.icon} w-5 text-center ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}></i> 
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 pb-8 sm:pb-5">
                    {isOfflineMode && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 font-semibold mb-2.5 border border-red-100 dark:border-red-800/50">
                            <i className="fa-solid fa-wifi"></i> Mode Luring
                        </div>
                    )}
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 border border-red-200/60 dark:border-red-900/40 active:scale-95 shadow-sm"
                    >
                        <i className="fa-solid fa-arrow-right-from-bracket"></i> Akhiri Sesi
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm transition-colors">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(true)}>
                            <i className="fa-solid fa-bars-staggered text-xl"></i>
                        </button>
                        <div className="hidden sm:block">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 capitalize leading-tight">{activeTab === 'amil' ? 'Pengaturan Sistem' : activeTab === 'donatur_donasi' ? 'Donatur & Penerimaan' : activeTab}</h2>
                            <p className="text-xs text-gray-400 font-medium">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* LAMPU INDIKATOR STATUS JARINGAN GOOGLE SHEET (HIJAU / KUNING / MERAH) */}
                        <div 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs transition-all ${
                                networkStatus === 'good' 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' 
                                    : networkStatus === 'syncing' 
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 animate-pulse' 
                                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                            }`}
                            title={
                                networkStatus === 'good' 
                                    ? 'Jaringan Stabil: Terhubung ke Firebase' 
                                    : networkStatus === 'syncing' 
                                    ? 'Sedang Menyinkronkan Data...' 
                                    : 'Jaringan Buruk: Data aman di perangkat'
                            }
                        >
                            <span className="relative flex h-2.5 w-2.5">
                                {networkStatus === 'good' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                    networkStatus === 'good' 
                                        ? 'bg-emerald-500' 
                                        : networkStatus === 'syncing' 
                                        ? 'bg-amber-500' 
                                        : 'bg-red-500'
                                }`}></span>
                            </span>
                            <span className="text-[11px] font-bold hidden md:inline">
                                {networkStatus === 'good' ? 'Sinyal Bagus' : networkStatus === 'syncing' ? 'Menyinkron...' : 'Jaringan Buruk'}
                            </span>
                        </div>

                        <button 
                            onClick={() => setDarkMode(!darkMode)} 
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-wiz-orange dark:hover:text-yellow-400 hover:bg-wiz-orange/10 dark:hover:bg-gray-700 rounded-full transition-all border border-transparent hover:border-wiz-orange/20"
                            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Malam"}
                        >
                            <i className={`fa-solid ${darkMode ? 'fa-sun text-yellow-400' : 'fa-moon'} text-lg`}></i>
                        </button>

                        <button 
                            onClick={() => fetchAllData(true)} 
                            disabled={isRefreshing}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-wiz-green dark:hover:text-emerald-400 hover:bg-wiz-green/10 dark:hover:bg-gray-700 rounded-full transition-all border border-transparent hover:border-wiz-green/20"
                            title="Sinkronisasi Awan"
                        >
                            <i className={`fa-solid fa-rotate text-lg ${isRefreshing ? 'fa-spin text-wiz-green dark:text-emerald-400' : ''}`}></i>
                        </button>
                        
                        <div className="relative group cursor-pointer">
                            <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-gray-200 dark:border-gray-700">
                                <div className="hidden sm:block text-right">
                                    <p className="font-bold text-gray-700 dark:text-gray-200 text-sm">{user.name || user.Nama}</p>
                                    <p className="text-[11px] font-semibold text-wiz-orange dark:text-amber-400 uppercase tracking-wide">{user.role || user.Role}</p>
                                </div>
                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-wiz-green to-[#2e8870] flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-gray-700 overflow-hidden shrink-0">
                                    {(user.photoUrl || user.Foto || user.PhotoUrl || user['Foto Profil']) ? (
                                        <img 
                                            src={typeof getDirectImageUrl !== 'undefined' ? getDirectImageUrl(user.photoUrl || user.Foto || user.PhotoUrl || user['Foto Profil']) : (user.photoUrl || user.Foto || user.PhotoUrl || user['Foto Profil'])} 
                                            alt={user.name || user.Nama} 
                                            className="w-full h-full object-cover" 
                                            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }} 
                                        />
                                    ) : null}
                                    <span style={{ display: (user.photoUrl || user.Foto || user.PhotoUrl || user['Foto Profil']) ? 'none' : 'block' }}>
                                        {(user.name || user.Nama)?.charAt(0) || 'A'}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 hidden group-hover:block z-50 transform origin-top-right transition-all">
                                <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-700 mb-1 sm:hidden">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{user.name || user.Nama}</p>
                                    <p className="text-[10px] text-wiz-orange uppercase">{user.role || user.Role}</p>
                                </div>
                                <button onClick={() => setIsPasswordModalOpen(true)} className="w-full text-left px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-wiz-light dark:hover:bg-gray-700 hover:text-wiz-green dark:hover:text-emerald-400 transition-colors flex items-center gap-3">
                                    <i className="fa-solid fa-shield-halved"></i> Ganti Sandi
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-3 sm:p-6 lg:p-8 custom-scrollbar relative">
                    {networkNotice && (
                        <div className={`fixed top-18 right-6 z-[100] max-w-sm p-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-in backdrop-blur-md ${
                            networkNotice.type === 'error'
                                ? 'bg-red-600/95 text-white border-red-400'
                                : networkNotice.type === 'warning'
                                ? 'bg-amber-500/95 text-white border-amber-300'
                                : 'bg-emerald-600/95 text-white border-emerald-400'
                        }`}>
                            <i className={`fa-solid ${networkNotice.type === 'error' ? 'fa-triangle-exclamation' : networkNotice.type === 'warning' ? 'fa-wifi' : 'fa-circle-check'} text-lg shrink-0`}></i>
                            <span className="text-xs font-bold leading-tight">{networkNotice.text}</span>
                        </div>
                    )}

                    <div className="max-w-7xl mx-auto pb-28 sm:pb-28">
                        {activeTab === 'dashboard' && typeof window.DashboardView !== 'undefined' && <window.DashboardView data={{ programs, donations, tasks, amils, pundis, riwayatPundis, contacts }} darkMode={darkMode} />}
                        {activeTab === 'donatur_donasi' && typeof window.DonaturDanDonasiView !== 'undefined' && <window.DonaturDanDonasiView contactConfig={contactConfig} donationConfig={donationConfig} isAdmin={isAdmin} />}
                        {activeTab === 'pundi' && typeof window.PundiView !== 'undefined' && <window.PundiView donations={donations} pundis={pundis} setPundis={setPundis} riwayatPundis={riwayatPundis} setRiwayatPundis={setRiwayatPundis} contacts={contacts} programs={programs} user={user} syncDataToSheet={syncDataToSheet} darkMode={darkMode} setViewImage={setViewImage} amils={amils} setActiveTab={setActiveTab} />}
                        {activeTab === 'scanner' && typeof window.ScannerView !== 'undefined' && <window.ScannerView pundis={pundis} riwayatPundis={riwayatPundis} setRiwayatPundis={setRiwayatPundis} user={user} syncDataToSheet={syncDataToSheet} setActiveTab={setActiveTab} />}
                        {activeTab === 'program' && (
                            <div className="space-y-6 slide-up">
                                <div className="flex overflow-x-auto gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full hide-scrollbar">
                                    <button
                                        onClick={() => setCampaignSubTab('campaigns')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${campaignSubTab === 'campaigns' ? 'bg-wiz-green text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                                    >
                                        <i className="fa-solid fa-boxes-packing"></i> Daftar Campaign
                                    </button>
                                    <button
                                        onClick={() => setCampaignSubTab('amil_target')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${campaignSubTab === 'amil_target' ? 'bg-wiz-green text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                                    >
                                        <i className="fa-solid fa-users-viewfinder"></i> Target Pundi per Amil
                                    </button>
                                </div>

                                {campaignSubTab === 'campaigns' && typeof window.ModuleView !== 'undefined' && (
                                    <div className="animate-in">
                                        <window.ModuleView {...programConfig} canAdd={isAdmin} canEdit={isAdmin} canDelete={isAdmin} />
                                    </div>
                                )}

                                {campaignSubTab === 'amil_target' && (
                                    <div className="space-y-6 animate-in">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Monitoring Target & Kinerja Amil (Pundi)</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pantau target spesifik, kotak pundi aktif, dan akumulasi perolehan masing-masing amil.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {amils.map(amil => {
                                                const amilName = amil.name || amil.Nama;
                                                const amilPundis = pundis.filter(p => {
                                                    const creator = p.createdBy || contacts.find(c => c.name === p.donorName)?.createdBy;
                                                    return creator === amilName;
                                                });
                                                const activePundiCount = amilPundis.filter(p => p.status === 'Aktif').length;

                                                const nowMonth = new Date().getMonth();
                                                const nowYear = new Date().getFullYear();
                                                const amilRiwayat = riwayatPundis.filter(r => r.amilName === amilName && r.status === 'Berhasil');
                                                const totalKumulatif = amilRiwayat.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                                const totalBulanIni = amilRiwayat.filter(r => {
                                                    const d = new Date(r.date);
                                                    return d.getMonth() === nowMonth && d.getFullYear() === nowYear;
                                                }).reduce((sum, r) => sum + Number(r.amount || 0), 0);

                                                const amilCampaigns = calculatedPrograms.filter(p => p.assignedAmil === amilName && p.status === 'Aktif');
                                                const totalAmilTarget = amilCampaigns.reduce((sum, p) => sum + Number(p.target || 0), 0);
                                                const totalAmilCollected = amilCampaigns.reduce((sum, p) => sum + Number(p.collected || 0), 0);
                                                const percentTarget = totalAmilTarget > 0 ? Math.min(Math.round((totalAmilCollected / totalAmilTarget) * 100), 100) : 0;

                                                return (
                                                    <div key={amil.id || amil.ID} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-11 h-11 rounded-xl bg-wiz-green/10 text-wiz-green dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                                                                        {amilName?.charAt(0)?.toUpperCase() || 'A'}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{amilName}</h4>
                                                                        <span className="text-[11px] font-semibold text-wiz-orange dark:text-amber-400 uppercase">{amil.role || amil.Role}</span>
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg font-bold">
                                                                    {activePundiCount} Kotak Aktif
                                                                </span>
                                                            </div>

                                                            {totalAmilTarget > 0 ? (
                                                                <div className="mb-4 p-3 bg-wiz-green/5 dark:bg-emerald-950/20 border border-wiz-green/20 rounded-xl">
                                                                    <div className="flex justify-between items-center text-xs mb-1.5">
                                                                        <span className="text-gray-500 dark:text-gray-400 font-medium">Target Khusus Amil</span>
                                                                        <span className="font-bold text-wiz-green dark:text-emerald-400">{percentTarget}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                                                                        <div className="bg-wiz-green dark:bg-emerald-500 h-2 rounded-full transition-all duration-700" style={{ width: `${percentTarget}%` }}></div>
                                                                    </div>
                                                                    <div className="flex justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                                                        <span>Terkumpul: {typeof formatRp !== 'undefined' ? formatRp(totalAmilCollected) : totalAmilCollected}</span>
                                                                        <span>Target: {typeof formatRp !== 'undefined' ? formatRp(totalAmilTarget) : totalAmilTarget}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="mb-4 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                                                                    <p className="text-[11px] text-gray-400">Belum ada campaign khusus yang dibebankan ke amil ini.</p>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                                                                <div>
                                                                    <p className="text-[10px] uppercase font-bold text-gray-400">Tarik Bulan Ini</p>
                                                                    <p className="font-bold text-gray-800 dark:text-gray-200 text-sm mt-0.5">{typeof formatRp !== 'undefined' ? formatRp(totalBulanIni) : totalBulanIni}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] uppercase font-bold text-gray-400">Kumulatif Pundi</p>
                                                                    <p className="font-bold text-wiz-green dark:text-emerald-400 text-sm mt-0.5">{typeof formatRp !== 'undefined' ? formatRp(totalKumulatif) : totalKumulatif}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isAdmin && (
                                                            <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                                                <button
                                                                    onClick={() => {
                                                                        setCampaignSubTab('campaigns');
                                                                    }}
                                                                    className="w-full py-1.5 text-xs text-center font-semibold text-wiz-green dark:text-emerald-400 hover:bg-wiz-green/10 rounded-lg transition-colors"
                                                                >
                                                                    + Buat Campaign untuk {amilName}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {typeof window.Modal !== 'undefined' && <window.Modal isOpen={!!selectedCampaignBreakdown} onClose={() => setSelectedCampaignBreakdown(null)} title={`Rincian Capaian: ${selectedCampaignBreakdown?.name || ''}`}>
                                    {selectedCampaignBreakdown && (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl flex justify-between items-center text-sm">
                                                <div>
                                                    <p className="text-xs text-gray-400 uppercase font-bold">Total Capaian Campaign</p>
                                                    <p className="text-lg font-black text-wiz-green dark:text-emerald-400">{typeof formatRp !== 'undefined' ? formatRp(selectedCampaignBreakdown.collected) : selectedCampaignBreakdown.collected}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400 uppercase font-bold">Target</p>
                                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{typeof formatRp !== 'undefined' ? formatRp(selectedCampaignBreakdown.target) : selectedCampaignBreakdown.target}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Kontribusi Per Amil:</h4>
                                                {(() => {
                                                    const isPundi = selectedCampaignBreakdown.isPundiCampaign;
                                                    const contributingAmils = amils.map(amil => {
                                                        const amilName = amil.name || amil.Nama;
                                                        const donasiAmil = donations
                                                            .filter(d => d.programName === selectedCampaignBreakdown.name && d.status === 'Berhasil' && d.amilName === amilName)
                                                            .reduce((sum, d) => sum + Number(d.amount || 0), 0);

                                                        const pundiAmil = isPundi ? riwayatPundis
                                                            .filter(r => r.status === 'Berhasil' && r.amilName === amilName)
                                                            .reduce((sum, r) => sum + Number(r.amount || 0), 0) : 0;

                                                        const totalKontribusi = isPundi ? (donasiAmil + pundiAmil) : donasiAmil;
                                                        const pShare = selectedCampaignBreakdown.collected > 0 ? Math.round((totalKontribusi / selectedCampaignBreakdown.collected) * 100) : 0;

                                                        return { ...amil, amilName, donasiAmil, pundiAmil, totalKontribusi, pShare };
                                                    }).filter(a => a.totalKontribusi > 0);

                                                    if (contributingAmils.length === 0) {
                                                        return (
                                                            <div className="p-5 text-center text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-xs">
                                                                Belum ada kontribusi donasi/pundi dari Amil untuk campaign ini.
                                                            </div>
                                                        );
                                                    }

                                                    return contributingAmils.map(amil => (
                                                        <div key={amil.id || amil.ID} className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-wiz-green/10 text-wiz-green dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                                                                    {amil.amilName?.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{amil.amilName}</p>
                                                                    <p className="text-[11px] text-gray-400">{amil.pShare}% dari total capaian</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-sm text-wiz-green dark:text-emerald-400">{typeof formatRp !== 'undefined' ? formatRp(amil.totalKontribusi) : amil.totalKontribusi}</p>
                                                                {isPundi && <span className="text-[10px] text-wiz-orange">Pundi: {typeof formatRp !== 'undefined' ? formatRp(amil.pundiAmil) : amil.pundiAmil}</span>}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>

                                            <div className="pt-3 flex justify-end">
                                                {typeof window.Button !== 'undefined' ? <window.Button variant="secondary" onClick={() => setSelectedCampaignBreakdown(null)}>Tutup</window.Button> : <button onClick={() => setSelectedCampaignBreakdown(null)}>Tutup</button>}
                                            </div>
                                        </div>
                                    )}
                                </window.Modal>}
                            </div>
                        )}
                        {activeTab === 'tugas' && typeof window.ModuleView !== 'undefined' && <window.ModuleView {...taskConfig} canAdd={isAdmin} canEdit={isAdmin} canDelete={isAdmin} />}
                        {activeTab === 'amil' && isAdmin && (
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100"><i className="fa-solid fa-shield-halved text-wiz-green mr-2"></i>Migrasi akun ke Firebase Authentication</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Membuat akun login untuk semua amil yang belum punya, mengisi hak akses, lalu menghapus kata sandi lama dari database. Aman dijalankan berulang.</p>
                                    <button onClick={migrateAmilToAuth} disabled={authMigrating} className="mt-3 px-4 py-2 rounded-xl bg-wiz-green text-white text-sm font-semibold disabled:opacity-60">
                                        {authMigrating ? 'Memproses...' : 'Jalankan migrasi akun'}
                                    </button>
                                    <button onClick={activateAllAmil} disabled={authMigrating} className="mt-3 ml-2 px-4 py-2 rounded-xl border border-wiz-green text-wiz-green dark:text-emerald-400 text-sm font-semibold disabled:opacity-60">
                                        Aktifkan semua amil
                                    </button>
                                    {authMigrateReport && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{authMigrateReport}</p>}
                                </div>
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100"><i className="fa-solid fa-user-group text-wiz-orange mr-2"></i>Salin akun amil dari proyek Firebase lama</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hanya menyalin daftar amil (nama, email, peran, foto). Data donatur, donasi, dan pundi tidak ikut. Kata sandi tidak bisa disalin, jadi setiap amil menerima email untuk membuat kata sandi baru.</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                        <input type="email" value={oldAmilEmail} onChange={(e) => setOldAmilEmail(e.target.value)} placeholder="Email Admin proyek lama" className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                                        <input type="password" value={oldAmilPass} onChange={(e) => setOldAmilPass(e.target.value)} placeholder="Kata sandi Admin proyek lama" className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                                    </div>
                                    <button onClick={copyAmilFromOldProject} disabled={copyingOld} className="mt-3 px-4 py-2 rounded-xl border border-wiz-orange text-wiz-orange text-sm font-semibold disabled:opacity-60">
                                        {copyingOld ? 'Menyalin...' : 'Salin amil dari proyek lama'}
                                    </button>
                                    {copyOldReport && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{copyOldReport}</p>}
                                </div>
                                {typeof window.ModuleView !== 'undefined' && <window.ModuleView {...amilConfig} />}
                            </div>
                        )}
                    </div>
                </div>

                {/* BOTTOM NAVBAR MOBILE */}
                <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-t border-gray-200/80 dark:border-gray-700/80 px-2 py-1.5 pb-safe shadow-[0_-4px_25px_rgba(0,0,0,0.1)] flex items-center justify-around transition-all">
                    {[
                        { id: 'dashboard', label: 'Beranda', icon: 'fa-solid fa-border-all' },
                        { id: 'pundi', label: 'Pundi', icon: 'fa-solid fa-box-open' },
                        { id: 'scanner', label: 'Pindai QR', icon: 'fa-solid fa-qrcode', isCenter: true },
                        { id: 'donatur_donasi', label: 'Donatur', icon: 'fa-solid fa-hand-holding-heart' },
                        { id: 'tugas', label: 'Tugas', icon: 'fa-solid fa-clipboard-check' }
                    ].map(item => {
                        const isActive = activeTab === item.id;
                        if (item.isCenter) {
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                                    className="relative -top-5 flex flex-col items-center justify-center group focus:outline-none"
                                >
                                    <div className="w-14 h-14 bg-gradient-to-tr from-wiz-green via-[#27745F] to-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-wiz-green/50 border-4 border-white dark:border-gray-800 group-hover:scale-110 active:scale-95 transition-all">
                                        <i className={`${item.icon} text-2xl`}></i>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 transition-colors ${isActive ? 'text-wiz-green dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>{item.label}</span>
                                </button>
                            );
                        }
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all focus:outline-none ${
                                    isActive
                                        ? 'text-wiz-green dark:text-emerald-400 scale-105 font-bold'
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-0.5 transition-all ${
                                    isActive ? 'bg-wiz-green/10 dark:bg-emerald-950/40' : ''
                                }`}>
                                    <i className={`${item.icon} text-base`}></i>
                                </div>
                                <span className="text-[10px] tracking-tight">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </main>

            {typeof window.Modal !== 'undefined' && <window.Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Pengaturan Keamanan">
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {pwdError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-xl border border-red-100 dark:border-red-800 font-medium flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> {pwdError}</p>}
                    {pwdSuccess && <p className="text-sm text-wiz-green dark:text-emerald-400 bg-wiz-green/10 dark:bg-wiz-green/20 p-3 rounded-xl border border-wiz-green/20 font-medium flex items-center gap-2"><i className="fa-solid fa-circle-check"></i> {pwdSuccess}</p>}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5 uppercase">Sandi Saat Ini</label>
                        <input type="password" required value={passwordForm.old} onChange={e => setPasswordForm({...passwordForm, old: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-wiz-green/20 focus:border-wiz-green text-gray-800 dark:text-gray-100 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5 uppercase">Sandi Baru</label>
                        <input type="password" required value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-wiz-green/20 focus:border-wiz-green text-gray-800 dark:text-gray-100 outline-none" />
                    </div>
                    <div className="flex justify-end pt-4 mt-2">
                        {typeof window.Button !== 'undefined' ? <window.Button type="submit" variant="primary">Perbarui Sandi</window.Button> : <button type="submit">Perbarui Sandi</button>}
                    </div>
                </form>
            </window.Modal>}

            {typeof window.Modal !== 'undefined' && <window.Modal isOpen={!!deletePrompt} onClose={() => setDeletePrompt(null)}>
                <div className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="bg-red-50 dark:bg-red-950/50 p-5 rounded-full text-red-500 mb-5 relative">
                        <div className="absolute inset-0 bg-red-400 opacity-20 rounded-full animate-ping"></div>
                        <i className="fa-solid fa-trash-can text-4xl relative z-10"></i>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2">Konfirmasi Hapus</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm font-medium">Langkah ini akan menghapus data secara permanen dari database Firebase Anda.</p>
                    <div className="flex gap-3 w-full">
                        {typeof window.Button !== 'undefined' ? (
                            <>
                                <window.Button variant="secondary" className="flex-1 py-3" onClick={() => setDeletePrompt(null)}>Batal</window.Button>
                                <window.Button variant="danger" className="flex-1 py-3" onClick={confirmDelete}>Ya, Hapus Permanen</window.Button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setDeletePrompt(null)}>Batal</button>
                                <button onClick={confirmDelete}>Hapus</button>
                            </>
                        )}
                    </div>
                </div>
            </window.Modal>}

            {viewImage && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-gray-900/90 dark:bg-black/95 backdrop-blur-md animate-in" onClick={() => setViewImage(null)}>
                    <div className="relative max-w-4xl w-full h-[85vh] flex justify-center items-center slide-up">
                        <button onClick={() => setViewImage(null)} className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                        
                        <div className="w-full h-full bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col items-center justify-center border border-white/20 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 -z-10">
                                <i className="fa-solid fa-spinner fa-spin text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Memuat berkas dari Drive...</p>
                            </div>
                            <iframe 
                                src={typeof getDrivePreviewUrl !== 'undefined' ? getDrivePreviewUrl(viewImage.original) : viewImage.original} 
                                className="w-full h-full border-0 relative z-10 bg-transparent" 
                                allow="autoplay"
                                title="Penampil Berkas"
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);