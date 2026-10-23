const { useState, useEffect, useMemo, useRef } = React;

const formatRpLocal = (num) => {
    if (typeof window.formatRp === 'function') return window.formatRp(num);
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
};

const formatDateLocal = (date) => {
    if (typeof window.formatDate === 'function') return window.formatDate(date);
    if (!date) return '-';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return String(date);
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
    } catch(e) { return String(date); }
};

const parseMapUrlsLocal = (input) => {
    if (typeof window.parseMapUrls === 'function') return window.parseMapUrls(input);
    if (!input) return { navUrl: '', webUrl: '' };
    return { navUrl: input, webUrl: input };
};

// Kompresor foto proporsional khusus nota bukti (Anti-Gepeng / Preserves Natural Aspect Ratio)
const compressNotaImage = (file, maxDim = 480, quality = 0.6) => {
    return new Promise((resolve) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const naturalW = img.naturalWidth || img.width;
                const naturalH = img.naturalHeight || img.height;

                let targetWidth = naturalW;
                let targetHeight = naturalH;

                // Hitung skala seragam (uniform scale) tanpa merusak rasio aspek gambar
                if (naturalW > maxDim || naturalH > maxDim) {
                    const ratio = Math.min(maxDim / naturalW, maxDim / naturalH);
                    targetWidth = Math.round(naturalW * ratio);
                    targetHeight = Math.round(naturalH * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                // Render dengan image smoothing berkualitas tinggi
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                // Perlindungan batas sel spreadsheet (<35.000 karakter)
                if (dataUrl.length > 35000) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.45);
                }
                if (dataUrl.length > 35000) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.32);
                }
                resolve(dataUrl);
            };
            img.onerror = () => resolve('');
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
};

const PundiView = ({ pundis = [], setPundis, riwayatPundis = [], setRiwayatPundis, contacts = [], programs = [], user, syncDataToSheet, darkMode, setViewImage, amils = [], donations = [], setActiveTab }) => {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');
    const [selectedAmilFilter, setSelectedAmilFilter] = useState(() => String(user?.role || user?.Role || '').toLowerCase() === 'admin' ? 'Semua' : (user?.name || 'Semua'));

    // State Lampu Status Jaringan Lokal Pundi
    const [localNetworkStatus, setLocalNetworkStatus] = useState(() => navigator.onLine ? 'good' : 'bad');

    useEffect(() => {
        const onOnline = () => setLocalNetworkStatus('good');
        const onOffline = () => setLocalNetworkStatus('bad');
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    // State Input Modal Penarikan (Jemput Manual / QR Scan)
    const [isInputModalOpen, setIsInputModalOpen] = useState(false);
    const [selectedPundi, setSelectedPundi] = useState(null);
    const [modalFormDate, setModalFormDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [modalFormStatus, setModalFormStatus] = useState('Berhasil');
    const [modalFormAmount, setModalFormAmount] = useState('');
    const [modalFormReceiptUrl, setModalFormReceiptUrl] = useState('');
    const [modalFormNotes, setModalFormNotes] = useState('');
    const [modalFormAmil, setModalFormAmil] = useState(user?.name || 'Amil');
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
    const [saveSuccessNotice, setSaveSuccessNotice] = useState(null);

    // Ref Kamera dan File Picker
    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);

    // State Scanner QR Cepat & Cetak Stiker QR
    const [isQuickScanOpen, setIsQuickScanOpen] = useState(false);
    const [printQR, setPrintQR] = useState(null);

    // State Edit Riwayat Sedekah
    const [editingRiwayat, setEditingRiwayat] = useState(null);
    const [isEditRiwayatOpen, setIsEditRiwayatOpen] = useState(false);
    const [deletePrompt, setDeletePrompt] = useState(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

    // State Modal Pratinjau Foto Bukti Nota
    const [previewNota, setPreviewNota] = useState(null);

    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsMessage, setGpsMessage] = useState(null);

    // Filter Master Pundi
    const [searchMaster, setSearchMaster] = useState('');
    const [statusMasterFilter, setStatusMasterFilter] = useState('Semua');
    const [creatorMasterFilter, setCreatorMasterFilter] = useState('Semua');
    const [tipeMasterFilter, setTipeMasterFilter] = useState('Semua');
    const [zonaMasterFilter, setZonaMasterFilter] = useState('Semua');
    const [masterSortOrder, setMasterSortOrder] = useState('asc');

    // Filter Tugas Penarikan
    const [searchTugas, setSearchTugas] = useState('');
    const [statusTugasFilter, setStatusTugasFilter] = useState('Semua');
    const [tipeTugasFilter, setTipeTugasFilter] = useState('Semua');
    const [zonaTugasFilter, setZonaTugasFilter] = useState('Semua');
    const [urutAwal, setUrutAwal] = useState('');
    const [urutAkhir, setUrutAkhir] = useState('');

    // Filter Riwayat Sedekah
    const [searchRiwayat, setSearchRiwayat] = useState('');
    const [statusRiwayatFilter, setStatusRiwayatFilter] = useState('Semua');
    const [tipeRiwayatFilter, setTipeRiwayatFilter] = useState('Semua');
    // Default filter bulan riwayat otomatis ke bulan sekarang
    const [monthRiwayatFilter, setMonthRiwayatFilter] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [amilRiwayatFilter, setAmilRiwayatFilter] = useState('Semua');

    // Periode Waktu
    const [dashMonth, setDashMonth] = useState(new Date().getMonth());
    const [dashYear, setDashYear] = useState(new Date().getFullYear());
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const yearOptions = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);

    // Ref & Helper Sinkronisasi Scroll Samping (Atas & Bawah)
    const tugasTableContainerRef = useRef(null);
    const tugasTopScrollRef = useRef(null);
    const riwayatTableContainerRef = useRef(null);
    const riwayatTopScrollRef = useRef(null);
    const masterTableContainerRef = useRef(null);
    const masterTopScrollRef = useRef(null);

    const syncScroll = (sourceRef, targetRef) => {
        const source = sourceRef?.current?.querySelector?.('.overflow-x-auto') || sourceRef?.current;
        const target = targetRef?.current?.querySelector?.('.overflow-x-auto') || targetRef?.current;
        if (source && target) {
            target.scrollLeft = source.scrollLeft;
        }
    };

    const scrollTableHorizontally = (containerRef, amount) => {
        if (containerRef?.current) {
            const target = containerRef.current.querySelector?.('.overflow-x-auto') || containerRef.current;
            target.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);
    const [targetFilterYear, setTargetFilterYear] = useState(new Date().getFullYear());
    // Default filter bulan di Menu Target otomatis ke bulan sekarang
    const [targetFilterMonth, setTargetFilterMonth] = useState(() => new Date().getMonth());
    const [targetFilterZona, setTargetFilterZona] = useState('Semua');

    const [targetsList, setTargetsList] = useState(() => {
        try {
            const saved = localStorage.getItem('wiz_target_pundi_amil_v1');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        const curYear = new Date().getFullYear();
        const curMonth = new Date().getMonth();
        return [
            {
                id: 1,
                amilName: 'Semua Amil',
                zona: 'Semua Zona',
                tahun: curYear,
                bulan: curMonth,
                targetUangUmum: 25000000,
                targetUangPribadi: 10000000,
                targetKotakUmum: 10,
                targetKotakPribadi: 5,
                catatan: 'Target Kolektif WIZ Berau'
            }
        ];
    });

    const saveTargetsListState = (newList) => {
        setTargetsList(newList);
        try { localStorage.setItem('wiz_target_pundi_amil_v1', JSON.stringify(newList)); } catch(e) {}
        if (typeof syncDataToSheet === 'function') syncDataToSheet('TargetPundi', newList);
    };

    const handleSaveTarget = (e) => {
        e.preventDefault();
        const form = e.target;
        const newTarget = {
            id: editingTarget ? editingTarget.id : Date.now(),
            amilName: form.amilName.value,
            zona: form.zona ? form.zona.value : 'Semua Zona',
            tahun: Number(form.tahun.value),
            bulan: form.bulan.value === 'Semua' ? 'Semua' : Number(form.bulan.value),
            targetUangUmum: Number(String(form.targetUangUmum.value || '').replace(/\D/g, '') || 0),
            targetUangPribadi: Number(String(form.targetUangPribadi.value || '').replace(/\D/g, '') || 0),
            targetKotakUmum: Number(form.targetKotakUmum.value || 0),
            targetKotakPribadi: Number(form.targetKotakPribadi.value || 0),
            catatan: form.catatan.value || ''
        };

        let updated = [];
        if (editingTarget) {
            updated = (targetsList || []).map(t => String(t.id) === String(editingTarget.id) ? newTarget : t);
        } else {
            updated = [...(targetsList || []), newTarget];
        }

        saveTargetsListState(updated);
        setIsTargetModalOpen(false);
        setEditingTarget(null);
    };

    const ZONA_DEFAULT_OPTIONS = ['SEKITAR TANJUNG', 'MALAM', 'KOTAK AMAL', 'PASAR', 'SEGAH', 'TANJUNG BATU', 'BIDUK-BIDUK'];
    const allZonaOptions = useMemo(() => {
        const set = new Set(ZONA_DEFAULT_OPTIONS);
        (pundis || []).forEach(p => {
            if (p.zona && String(p.zona).trim()) set.add(String(p.zona).trim().toUpperCase());
        });
        return Array.from(set);
    }, [pundis]);

    const isAdmin = String(user?.role || user?.Role || '').toLowerCase() === 'admin';
    const effectiveAmil = isAdmin ? selectedAmilFilter : user?.name;

    // ===== Atribusi data ke amil (PIC) =====
    // Nama dinormalkan (huruf kecil, tanpa spasi/simbol) agar variasi penulisan tetap cocok.
    const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const amilCanon = useMemo(() => {
        const m = new Map();
        (amils || []).forEach(a => { const n = String(a.name || a.Nama || '').trim(); if (n && !m.has(normName(n))) m.set(normName(n), n); });
        return m;
    }, [amils]);
    const canonName = useMemo(() => (raw) => {
        const t = String(raw || '').trim();
        if (!t) return '';
        return amilCanon.get(normName(t)) || t;
    }, [amilCanon]);

    const allAmilNames = useMemo(() => {
        const names = new Map(amilCanon);
        const add = (raw) => { const t = String(raw || '').trim(); if (t && !names.has(normName(t))) names.set(normName(t), t); };
        (pundis || []).forEach(p => add(p.createdBy || (contacts || []).find(cnt => cnt.name === p.donorName)?.createdBy));
        (riwayatPundis || []).forEach(r => add(r.amilName));
        return Array.from(names.values());
    }, [amilCanon, pundis, riwayatPundis, contacts]);

    // Pemilik (PIC) tiap pundi: pembuat data bila ia amil biasa; bila dibuat Admin (mis. impor massal),
    // pakai amil yang terakhir menjemput pundi itu (riwayat); terakhir baru pembuat data.
    const ownerMap = useMemo(() => {
        const roleOf = new Map();
        (amils || []).forEach(a => roleOf.set(normName(a.name || a.Nama), String(a.role || a.Role || '').trim().toLowerCase()));
        const latestPic = new Map();
        (riwayatPundis || []).forEach(r => {
            const name = canonName(r.amilName);
            if (!name) return;
            const t = new Date(r.date || r.Tanggal).getTime() || 0;
            [String(r.pundiId || ''), 'n' + String(r.noUrut || '')].forEach(key => {
                if (key === '' || key === 'n') return;
                const cur = latestPic.get(key);
                if (!cur || t >= cur.t) latestPic.set(key, { t, name });
            });
        });
        const map = new Map();
        (Array.isArray(pundis) ? pundis : []).forEach(p => {
            const id = String(p.id || p.ID);
            const creator = canonName(p.createdBy || (contacts || []).find(c => c.name === p.donorName)?.createdBy);
            const creatorIsAdmin = creator && roleOf.get(normName(creator)) === 'admin';
            const pic = latestPic.get(id) || latestPic.get('n' + String(p.noUrut || ''));
            let owner = '';
            if (creator && !creatorIsAdmin) owner = creator;
            else if (pic) owner = pic.name;
            else owner = creator || '';
            map.set(id, owner);
        });
        return map;
    }, [pundis, riwayatPundis, amils, contacts, canonName]);

    const amilMatch = useMemo(() => (name) => {
        if (isAdmin && effectiveAmil === 'Semua') return true;
        if (effectiveAmil === '__none__') return !name;
        return !!name && normName(name) === normName(effectiveAmil);
    }, [isAdmin, effectiveAmil]);

    const uniqueAmils = allAmilNames;

    const visiblePundis = useMemo(() => {
        const safePundis = Array.isArray(pundis) ? pundis : [];
        return safePundis.filter(p => amilMatch(ownerMap.get(String(p.id || p.ID)) || ''));
    }, [pundis, ownerMap, amilMatch]);

    const visibleRiwayatPundis = useMemo(() => {
        const safeRiwayat = Array.isArray(riwayatPundis) ? riwayatPundis : [];
        const safePundis = Array.isArray(pundis) ? pundis : [];
        return safeRiwayat.filter(r => {
            let owner = canonName(r.amilName);
            if (!owner) {
                const key = String(r.pundiId || '');
                owner = ownerMap.get(key) || '';
                if (!owner && r.noUrut) {
                    const pm = safePundis.find(p => String(p.noUrut) === String(r.noUrut));
                    owner = pm ? (ownerMap.get(String(pm.id || pm.ID)) || '') : '';
                }
            }
            return amilMatch(owner);
        });
    }, [riwayatPundis, pundis, ownerMap, canonName, amilMatch]);

    // ===== Statistik Kinerja (Umum = Pundi Umum, Khusus = Pundi Pribadi, Insidental = donasi non-pundi) =====
    const kinerja = useMemo(() => {
        const Y = Number(dashYear);
        const allMonths = dashMonth === 'Semua';
        const M = allMonths ? 0 : Number(dashMonth);
        const pStart = new Date(Y, M, 1, 0, 0, 0, 0).getTime();
        const pEnd = (allMonths ? new Date(Y, 11, 31, 23, 59, 59, 999) : new Date(Y, M + 1, 0, 23, 59, 59, 999)).getTime();
        const tsOf = (v) => {
            const t = String(v || '');
            const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            const x = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(t);
            const n = x.getTime();
            return isNaN(n) ? null : n;
        };
        const lc = (v) => String(v || '').trim().toLowerCase();
        const isKhusus = (p) => (p.tipePundi || p['Tipe Pundi'] || '') === 'Pundi Pribadi';
        const split = (list) => ({ u: list.filter(p => !isKhusus(p)).length, k: list.filter(isKhusus).length });
        const createdTs = (p) => { const t = tsOf(p.createdAt); return t === null ? 0 : t; };
        const endedTs = (p) => lc(p.status || 'Aktif') === 'aktif' ? Infinity : (tsOf(p.updatedAt) ?? 0);

        const list = visiblePundis;
        const startSet = list.filter(p => createdTs(p) < pStart && endedTs(p) >= pStart);
        const endSet = list.filter(p => createdTs(p) <= pEnd && endedTs(p) > pEnd);
        const added = list.filter(p => { const t = tsOf(p.createdAt); return t !== null && t >= pStart && t <= pEnd; });
        const removed = list.filter(p => { if (lc(p.status || 'Aktif') === 'aktif') return false; const t = tsOf(p.updatedAt); return t !== null && t >= pStart && t <= pEnd; });

        const allPundis = Array.isArray(pundis) ? pundis : [];
        const tipeOfRiwayat = (r) => {
            const m = allPundis.find(p => String(p.id || p.ID) === String(r.pundiId) || (r.noUrut && String(p.noUrut) === String(r.noUrut)));
            return ((m && m.tipePundi) || r.tipePundi || 'Pundi Umum') === 'Pundi Pribadi' ? 'k' : 'u';
        };
        const berhasilRiwayat = visibleRiwayatPundis.filter(r => lc(r.status) === 'berhasil');
        const amountOf = (r) => Number(r.amount || r.Nominal || 0);
        const riwayatIn = (a, b) => berhasilRiwayat.filter(r => { const t = tsOf(r.date || r.Tanggal); return t !== null && t >= a && t <= b; });

        const periodRiwayat = riwayatIn(pStart, pEnd);
        const danaPundi = { u: 0, k: 0 };
        const collectedIds = new Set();
        const collectedNos = new Set();
        periodRiwayat.forEach(r => {
            danaPundi[tipeOfRiwayat(r)] += amountOf(r);
            if (r.pundiId) collectedIds.add(String(r.pundiId));
            if (r.noUrut) collectedNos.add(String(r.noUrut));
        });
        const dijemputList = startSet.filter(p => collectedIds.has(String(p.id || p.ID)) || collectedNos.has(String(p.noUrut)));
        const dijemputIds = new Set(dijemputList.map(p => String(p.id || p.ID)));
        const belumList = startSet.filter(p => !dijemputIds.has(String(p.id || p.ID)));

        // Donasi insidental = donasi berhasil di luar program pundi
        const pundiProgramNames = new Set((programs || []).filter(pr => (pr.category && String(pr.category).includes('Pundi')) || lc(pr.name || pr.Nama).includes('pundi')).map(pr => lc(pr.name || pr.Nama)));
        const insidental = (donations || []).filter(d =>
            lc(d.status) === 'berhasil' &&
            !pundiProgramNames.has(lc(d.programName)) && !lc(d.programName).includes('pundi') &&
            amilMatch(canonName(d.amilName))
        ).map(d => ({ t: tsOf(d.date || d.Tanggal), amount: Number(d.amount || d.Nominal || 0), donor: lc(d.donorName) || ('anon-' + (d.id || d.ID)) })).filter(d => d.t !== null);
        const insPeriod = insidental.filter(d => d.t >= pStart && d.t <= pEnd);
        const danaInsidental = insPeriod.reduce((sum, d) => sum + d.amount, 0);
        const donorInsidental = new Set(insPeriod.map(d => d.donor)).size;
        const firstDonation = new Map();
        insidental.forEach(d => { if (!firstDonation.has(d.donor) || d.t < firstDonation.get(d.donor)) firstDonation.set(d.donor, d.t); });

        const rows = Array.from({ length: 12 }, (_, m) => {
            const a = new Date(Y, m, 1).getTime();
            const b = new Date(Y, m + 1, 0, 23, 59, 59, 999).getTime();
            const baru = list.filter(p => { const t = tsOf(p.createdAt); return t !== null && t >= a && t <= b; });
            const baruSplit = split(baru);
            const baruI = Array.from(firstDonation.values()).filter(t => t >= a && t <= b).length;
            const dana = { u: 0, k: 0 };
            riwayatIn(a, b).forEach(r => { dana[tipeOfRiwayat(r)] += amountOf(r); });
            const danaI = insidental.filter(d => d.t >= a && d.t <= b).reduce((sum, d) => sum + d.amount, 0);
            return { month: m, baruU: baruSplit.u, baruK: baruSplit.k, baruI, danaU: dana.u, danaK: dana.k, danaI, total: dana.u + dana.k + danaI };
        });
        const totalRow = rows.reduce((acc, r) => ({
            baruU: acc.baruU + r.baruU, baruK: acc.baruK + r.baruK, baruI: acc.baruI + r.baruI,
            danaU: acc.danaU + r.danaU, danaK: acc.danaK + r.danaK, danaI: acc.danaI + r.danaI, total: acc.total + r.total
        }), { baruU: 0, baruK: 0, baruI: 0, danaU: 0, danaK: 0, danaI: 0, total: 0 });

        const aktifSplit = split(endSet);
        return {
            aktifU: aktifSplit.u, aktifK: aktifSplit.k, aktifI: donorInsidental,
            totalMuzakki: endSet.length + donorInsidental,
            awal: split(startSet), awalTotal: startSet.length,
            tambah: split(added), tambahTotal: added.length,
            kurang: split(removed), kurangTotal: removed.length,
            dijemput: split(dijemputList), dijemputTotal: dijemputList.length,
            belum: split(belumList), belumTotal: belumList.length,
            danaPundi, danaPundiTotal: danaPundi.u + danaPundi.k,
            danaInsidental, totalNominal: danaPundi.u + danaPundi.k + danaInsidental,
            rows, totalRow
        };
    }, [visiblePundis, visibleRiwayatPundis, pundis, donations, programs, dashMonth, dashYear, amilMatch, canonName]);

    const activePundisSorted = useMemo(() => {
        return [...visiblePundis].filter(p => String(p.status || 'Aktif').trim().toLowerCase() === 'aktif').sort((a, b) => Number(a.noUrut) - Number(b.noUrut));
    }, [visiblePundis]);

    const uniqueMonths = useMemo(() => {
        const map = new Map();
        visibleRiwayatPundis.forEach(r => {
            const d = new Date(r.date || r.Tanggal);
            if (!isNaN(d.getTime())) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
                map.set(key, label);
            }
        });
        return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [visibleRiwayatPundis]);

    const handleGetCurrentLocationGPS = () => {
        if (!navigator.geolocation) {
            setGpsMessage({ type: 'error', text: 'Perangkat atau browser tidak mendukung fitur GPS.' });
            setTimeout(() => setGpsMessage(null), 4000);
            return;
        }

        setGpsLoading(true);
        setGpsMessage(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setGpsLoading(false);
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

                try {
                    const tempTextArea = document.createElement('textarea');
                    tempTextArea.value = mapsUrl;
                    document.body.appendChild(tempTextArea);
                    tempTextArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempTextArea);
                } catch(e) {}

                setGpsMessage({ type: 'success', text: `Tautan GPS berhasil disalin: ${mapsUrl}` });
                setTimeout(() => setGpsMessage(null), 7000);
            },
            (error) => {
                setGpsLoading(false);
                let errText = "Gagal mengambil titik GPS lokasi.";
                if (error.code === 1) errText = "Izin akses lokasi GPS ditolak oleh browser/HP.";
                else if (error.code === 2) errText = "Posisi GPS tidak ditemukan. Pastikan GPS HP aktif.";
                else if (error.code === 3) errText = "Waktu permintaan GPS habis. Coba ulangi lagi.";
                setGpsMessage({ type: 'error', text: errText });
                setTimeout(() => setGpsMessage(null), 5000);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const renderGpsHelperBanner = (isInsideModal = false) => (
        <div className={`p-4 rounded-2xl border shadow-sm space-y-2.5 ${
            isInsideModal 
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white dark:from-emerald-950/40 dark:via-gray-800 dark:to-gray-800 border-emerald-200 dark:border-emerald-800 mb-4' 
                : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/40 dark:via-gray-800 dark:to-gray-800 border-emerald-200 dark:border-emerald-800'
        }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h4 className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-wiz-green text-white flex items-center justify-center text-xs shadow-sm">
                            <i className="fa-solid fa-location-crosshairs"></i>
                        </span>
                        Titik Lokasi Google Maps (GPS)
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Tekan "Cari di Web Maps" untuk mencari lokasi titik di Google Maps, atau "GPS HP" jika Anda sedang berada di lokasi pundi.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleGetCurrentLocationGPS}
                        disabled={gpsLoading}
                        className="px-3.5 py-2 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                        title="Ambil koordinat akurat perangkat saat ini"
                    >
                        <i className={`fa-solid ${gpsLoading ? 'fa-spinner fa-spin' : 'fa-mobile-screen'}`}></i>
                        <span>{gpsLoading ? 'Mendeteksi...' : 'GPS HP'}</span>
                    </button>
                    <a
                        href="https://www.google.com/maps"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        title="Buka Google Maps Web untuk mencari alamat"
                    >
                        <i className="fa-solid fa-globe text-blue-500"></i>
                        <span>Cari di Web Maps</span>
                    </a>
                </div>
            </div>

            {gpsMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in ${gpsMessage.type === 'success' ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-300'}`}>
                    <i className={`fa-solid ${gpsMessage.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-red-500'}`}></i>
                    <span className="truncate">{gpsMessage.text}</span>
                    {gpsMessage.type === 'success' && (
                        <span className="text-[10px] ml-auto bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded font-bold shrink-0">Tersalin</span>
                    )}
                </div>
            )}
        </div>
    );

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const stats = useMemo(() => {
        const totalAktif = visiblePundis.filter(p => p.status === 'Aktif').length;
        const totalUmum = visiblePundis.filter(p => p.status === 'Aktif' && (p.tipePundi || 'Pundi Umum') === 'Pundi Umum').length;
        const totalPribadi = visiblePundis.filter(p => p.status === 'Aktif' && p.tipePundi === 'Pundi Pribadi').length;

        const penambahanUmum = visiblePundis.filter(p => {
            if (!p.createdAt) return false;
            const d = new Date(p.createdAt);
            const matchMonth = dashMonth === 'Semua' ? true : d.getMonth() === Number(dashMonth);
            return matchMonth && d.getFullYear() === Number(dashYear) && (p.tipePundi || 'Pundi Umum') === 'Pundi Umum';
        }).length;

        const penambahanPribadi = visiblePundis.filter(p => {
            if (!p.createdAt) return false;
            const d = new Date(p.createdAt);
            const matchMonth = dashMonth === 'Semua' ? true : d.getMonth() === Number(dashMonth);
            return matchMonth && d.getFullYear() === Number(dashYear) && p.tipePundi === 'Pundi Pribadi';
        }).length;

        const ditarikBulanIni = visiblePundis.filter(p => {
            if (!p.updatedAt) return false;
            const d = new Date(p.updatedAt);
            const matchMonth = dashMonth === 'Semua' ? true : d.getMonth() === Number(dashMonth);
            return p.status === 'Ditarik' && matchMonth && d.getFullYear() === Number(dashYear);
        }).length;

        const riwayatBulanIni = visibleRiwayatPundis.filter(r => {
            const d = new Date(r.date || r.Tanggal);
            const matchMonth = dashMonth === 'Semua' ? true : d.getMonth() === Number(dashMonth);
            return matchMonth && d.getFullYear() === Number(dashYear);
        });

        const berhasil = riwayatBulanIni.filter(r => r.status === 'Berhasil').length;
        const gagal = riwayatBulanIni.filter(r => r.status === 'Gagal').length;

        let danaUmum = 0;
        let danaPribadi = 0;
        riwayatBulanIni.filter(r => r.status === 'Berhasil').forEach(r => {
            const matchedPundi = visiblePundis.find(p => String(p.id || p.ID) === String(r.pundiId) || String(p.noUrut) === String(r.noUrut));
            const tipe = (matchedPundi && matchedPundi.tipePundi) || r.tipePundi || 'Pundi Umum';
            const amt = Number(r.amount || r.Nominal || 0);
            if (tipe === 'Pundi Pribadi') danaPribadi += amt;
            else danaUmum += amt;
        });

        const totalDanaBulanIni = danaUmum + danaPribadi;
        const totalDanaKumulatif = visibleRiwayatPundis.filter(r => r.status === 'Berhasil').reduce((sum, r) => sum + Number(r.amount || r.Nominal || 0), 0);

        const matchedTargets = (targetsList || []).filter(t => {
            const matchYear = Number(t.tahun) === Number(dashYear);
            const matchMonth = dashMonth === 'Semua' ? true : (t.bulan === 'Semua' || Number(t.bulan) === Number(dashMonth));
            const isAllAmil = t.amilName === 'Semua Amil';
            const matchAmil = (isAdmin && effectiveAmil === 'Semua') ? true : (t.amilName === effectiveAmil || isAllAmil);
            return matchYear && matchMonth && matchAmil;
        });

        let targetUangUmum = 0;
        let targetUangPribadi = 0;
        let targetKotakUmum = 0;
        let targetKotakPribadi = 0;

        matchedTargets.forEach(t => {
            const factor = (t.bulan === 'Semua' && dashMonth !== 'Semua') ? (1 / 12) : 1;
            targetUangUmum += Math.round(Number(t.targetUangUmum || 0) * factor);
            targetUangPribadi += Math.round(Number(t.targetUangPribadi || 0) * factor);
            targetKotakUmum += Math.round(Number(t.targetKotakUmum || 0) * factor);
            targetKotakPribadi += Math.round(Number(t.targetKotakPribadi || 0) * factor);
        });

        if (targetUangUmum === 0 && targetUangPribadi === 0) {
            const factor = dashMonth === 'Semua' ? 1 : (1 / 12);
            targetUangUmum = Math.round(300000000 * factor);
            targetUangPribadi = Math.round(120000000 * factor);
            targetKotakUmum = Math.round(120 * factor);
            targetKotakPribadi = Math.round(60 * factor);
        }

        const totalTargetUang = targetUangUmum + targetUangPribadi;
        const totalTargetKotak = targetKotakUmum + targetKotakPribadi;

        const percentUangUmum = targetUangUmum > 0 ? Math.min(Math.round((danaUmum / targetUangUmum) * 100), 100) : 0;
        const percentUangPribadi = targetUangPribadi > 0 ? Math.min(Math.round((danaPribadi / targetUangPribadi) * 100), 100) : 0;
        const percentTotalUang = totalTargetUang > 0 ? Math.min(Math.round((totalDanaBulanIni / totalTargetUang) * 100), 100) : 0;

        const percentKotakUmum = targetKotakUmum > 0 ? Math.min(Math.round((totalUmum / targetKotakUmum) * 100), 100) : 0;
        const percentKotakPribadi = targetKotakPribadi > 0 ? Math.min(Math.round((totalPribadi / targetKotakPribadi) * 100), 100) : 0;
        const percentTotalKotak = totalTargetKotak > 0 ? Math.min(Math.round((totalAktif / totalTargetKotak) * 100), 100) : 0;

        return {
            totalAktif, totalUmum, totalPribadi,
            penambahanUmum, penambahanPribadi, ditarikBulanIni,
            berhasil, gagal,
            danaUmum, danaPribadi, totalDanaBulanIni, totalDanaKumulatif,
            targetUangUmum, targetUangPribadi, totalTargetUang,
            targetKotakUmum, targetKotakPribadi, totalTargetKotak,
            percentUangUmum, percentUangPribadi, percentTotalUang,
            percentKotakUmum, percentKotakPribadi, percentTotalKotak
        };
    }, [visiblePundis, visibleRiwayatPundis, dashMonth, dashYear, targetsList, isAdmin, effectiveAmil]);

    const evaluatedTargets = useMemo(() => {
        return (targetsList || []).map(tgt => {
            const targetAmil = tgt.amilName || 'Semua Amil';
            const isAllAmil = targetAmil === 'Semua Amil';
            const targetZona = tgt.zona || 'Semua Zona';
            const isAllZona = targetZona === 'Semua Zona' || targetZona === 'Semua';

            const matchedRiwayat = (riwayatPundis || []).filter(r => {
                if (r.status !== 'Berhasil') return false;
                if (!isAllAmil && normName(r.amilName) !== normName(targetAmil)) return false;
                const d = new Date(r.date || r.Tanggal);
                if (isNaN(d.getTime())) return false;
                const matchYear = d.getFullYear() === Number(tgt.tahun);
                const matchMonth = tgt.bulan === 'Semua' ? true : d.getMonth() === Number(tgt.bulan);
                if (!matchYear || !matchMonth) return false;

                // Penyaringan berdasarkan target Zona
                if (!isAllZona) {
                    const matchedPundi = (pundis || []).find(p => String(p.id || p.ID) === String(r.pundiId) || String(p.noUrut) === String(r.noUrut));
                    const pundiZona = (matchedPundi && matchedPundi.zona) ? String(matchedPundi.zona).trim().toUpperCase() : '';
                    if (pundiZona !== String(targetZona).trim().toUpperCase()) return false;
                }

                return true;
            });

            let realisasiUangUmum = 0;
            let realisasiUangPribadi = 0;
            matchedRiwayat.forEach(r => {
                const matchedPundi = (pundis || []).find(p => String(p.id || p.ID) === String(r.pundiId) || String(p.noUrut) === String(r.noUrut));
                const tipe = (matchedPundi && matchedPundi.tipePundi) || r.tipePundi || 'Pundi Umum';
                const amt = Number(r.amount || r.Nominal || 0);
                if (tipe === 'Pundi Pribadi') realisasiUangPribadi += amt;
                else realisasiUangUmum += amt;
            });

            const totalTargetUang = Number(tgt.targetUangUmum || 0) + Number(tgt.targetUangPribadi || 0);
            const totalRealisasiUang = realisasiUangUmum + realisasiUangPribadi;
            const percentUangUmum = Number(tgt.targetUangUmum) > 0 ? Math.min(Math.round((realisasiUangUmum / tgt.targetUangUmum) * 100), 100) : 0;
            const percentUangPribadi = Number(tgt.targetUangPribadi) > 0 ? Math.min(Math.round((realisasiUangPribadi / tgt.targetUangPribadi) * 100), 100) : 0;
            const percentTotalUang = totalTargetUang > 0 ? Math.min(Math.round((totalRealisasiUang / totalTargetUang) * 100), 100) : 0;

            const matchedPundiBaru = (pundis || []).filter(p => {
                if (!p.createdAt) return false;
                const creator = ownerMap.get(String(p.id || p.ID)) || '';
                if (!isAllAmil && normName(creator) !== normName(targetAmil)) return false;
                if (!isAllZona && String(p.zona || '').trim().toUpperCase() !== String(targetZona).trim().toUpperCase()) return false;
                const d = new Date(p.createdAt);
                if (isNaN(d.getTime())) return false;
                const matchYear = d.getFullYear() === Number(tgt.tahun);
                const matchMonth = tgt.bulan === 'Semua' ? true : d.getMonth() === Number(tgt.bulan);
                return matchYear && matchMonth;
            });

            const realisasiKotakUmum = matchedPundiBaru.filter(p => (p.tipePundi || 'Pundi Umum') === 'Pundi Umum').length;
            const realisasiKotakPribadi = matchedPundiBaru.filter(p => p.tipePundi === 'Pundi Pribadi').length;

            const totalTargetKotak = Number(tgt.targetKotakUmum || 0) + Number(tgt.targetKotakPribadi || 0);
            const totalRealisasiKotak = realisasiKotakUmum + realisasiKotakPribadi;
            const percentKotakUmum = Number(tgt.targetKotakUmum) > 0 ? Math.min(Math.round((realisasiKotakUmum / tgt.targetKotakUmum) * 100), 100) : 0;
            const percentKotakPribadi = Number(tgt.targetKotakPribadi) > 0 ? Math.min(Math.round((realisasiKotakPribadi / tgt.targetKotakPribadi) * 100), 100) : 0;
            const percentTotalKotak = totalTargetKotak > 0 ? Math.min(Math.round((totalRealisasiKotak / totalTargetKotak) * 100), 100) : 0;

            return {
                ...tgt,
                realisasiUangUmum, realisasiUangPribadi, totalTargetUang, totalRealisasiUang,
                percentUangUmum, percentUangPribadi, percentTotalUang,
                realisasiKotakUmum, realisasiKotakPribadi, totalTargetKotak, totalRealisasiKotak,
                percentKotakUmum, percentKotakPribadi, percentTotalKotak
            };
        });
    }, [targetsList, riwayatPundis, pundis, contacts, ownerMap]);

    const filteredEvaluatedTargets = useMemo(() => {
        return evaluatedTargets.filter(t => {
            const matchYear = Number(t.tahun) === Number(targetFilterYear);
            const matchMonth = targetFilterMonth === 'Semua' ? true : (t.bulan === 'Semua' || Number(t.bulan) === Number(targetFilterMonth));
            const matchAmil = (!isAdmin && user?.name) ? (t.amilName === 'Semua Amil' || t.amilName === user.name) : true;
            const matchZona = targetFilterZona === 'Semua' ? true : (t.zona === targetFilterZona || (!t.zona && targetFilterZona === 'Semua Zona'));
            return matchYear && matchMonth && matchAmil && matchZona;
        });
    }, [evaluatedTargets, targetFilterYear, targetFilterMonth, targetFilterZona, isAdmin, user]);

    const sumTotalTargetUang = filteredEvaluatedTargets.reduce((s, t) => s + t.totalTargetUang, 0);
    const sumTotalRealisasiUang = filteredEvaluatedTargets.reduce((s, t) => s + t.totalRealisasiUang, 0);
    const sumPercentTotalUang = sumTotalTargetUang > 0 ? Math.min(Math.round((sumTotalRealisasiUang / sumTotalTargetUang) * 100), 100) : 0;
    const sumTotalTargetKotak = filteredEvaluatedTargets.reduce((s, t) => s + t.totalTargetKotak, 0);
    const sumTotalRealisasiKotak = filteredEvaluatedTargets.reduce((s, t) => s + t.totalRealisasiKotak, 0);
    const sumPercentTotalKotak = sumTotalTargetKotak > 0 ? Math.min(Math.round((sumTotalRealisasiKotak / sumTotalTargetKotak) * 100), 100) : 0;

    const filteredMasterPundis = useMemo(() => {
        const filtered = visiblePundis.filter(p => {
            const creator = p.createdBy || (contacts || []).find(c => c.name === p.donorName)?.createdBy || '';
            const term = searchMaster.toLowerCase().trim();
            const matchSearch = !term ||
                String(p.noUrut || '').toLowerCase().includes(term) ||
                String(p.donorName || '').toLowerCase().includes(term) ||
                String(p.usaha || '').toLowerCase().includes(term) ||
                String(p.alamat || '').toLowerCase().includes(term) ||
                String(p.tipePundi || '').toLowerCase().includes(term) ||
                String(p.zona || '').toLowerCase().includes(term) ||
                String(p.phone || '').toLowerCase().includes(term);
            const matchStatus = statusMasterFilter === 'Semua' || p.status === statusMasterFilter;
            const matchCreator = creatorMasterFilter === 'Semua' || creator === creatorMasterFilter;
            const matchTipe = tipeMasterFilter === 'Semua' || (p.tipePundi || 'Pundi Umum') === tipeMasterFilter;
            const matchZona = zonaMasterFilter === 'Semua' || String(p.zona || '').toUpperCase() === String(zonaMasterFilter).toUpperCase();
            return matchSearch && matchStatus && matchCreator && matchTipe && matchZona;
        });

        return filtered.sort((a, b) => {
            const numA = Number(a.noUrut) || 0;
            const numB = Number(b.noUrut) || 0;
            return masterSortOrder === 'asc' ? numA - numB : numB - numA;
        });
    }, [visiblePundis, searchMaster, statusMasterFilter, creatorMasterFilter, tipeMasterFilter, zonaMasterFilter, masterSortOrder, contacts]);

    const filteredTugasPundis = useMemo(() => {
        return activePundisSorted.filter(p => {
            const currentRecord = visibleRiwayatPundis.find(r => (String(r.pundiId) === String(p.id || p.ID) || String(r.noUrut) === String(p.noUrut)) && new Date(r.date || r.Tanggal).getMonth() === currentMonth && new Date(r.date || r.Tanggal).getFullYear() === currentYear);
            const pStatus = currentRecord ? currentRecord.status : 'Belum';

            const term = searchTugas.toLowerCase().trim();
            const matchSearch = !term ||
                String(p.noUrut || '').toLowerCase().includes(term) ||
                String(p.donorName || '').toLowerCase().includes(term) ||
                String(p.usaha || '').toLowerCase().includes(term) ||
                String(p.alamat || '').toLowerCase().includes(term) ||
                String(p.zona || '').toLowerCase().includes(term);

            let matchStatus = false;
            if (statusTugasFilter === 'Semua') matchStatus = true;
            else if (statusTugasFilter === 'Belum' && pStatus === 'Belum') matchStatus = true;
            else if (statusTugasFilter === 'Dijemput' && pStatus === 'Dijemput') matchStatus = true;
            else if (statusTugasFilter === 'Sudah Ditarik' && pStatus === 'Berhasil') matchStatus = true;

            const matchTipe = tipeTugasFilter === 'Semua' || (p.tipePundi || 'Pundi Umum') === tipeTugasFilter;
            const matchZona = zonaTugasFilter === 'Semua' || String(p.zona || '').toUpperCase() === String(zonaTugasFilter).toUpperCase();

            const pNo = Number(p.noUrut);
            const matchUrutAwal = urutAwal === '' || isNaN(Number(urutAwal)) || pNo >= Number(urutAwal);
            const matchUrutAkhir = urutAkhir === '' || isNaN(Number(urutAkhir)) || pNo <= Number(urutAkhir);

            return matchSearch && matchStatus && matchTipe && matchZona && matchUrutAwal && matchUrutAkhir;
        });
    }, [activePundisSorted, visibleRiwayatPundis, searchTugas, statusTugasFilter, tipeTugasFilter, zonaTugasFilter, urutAwal, urutAkhir, currentMonth, currentYear]);

    const toggleSelectTask = (id) => {
        const newSet = new Set(selectedTaskIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTaskIds(newSet);
    };

    const toggleSelectAllFiltered = () => {
        const newSet = new Set(selectedTaskIds);
        const isAllSelected = filteredTugasPundis.length > 0 && filteredTugasPundis.every(p => newSet.has(p.id));
        if (isAllSelected) {
            filteredTugasPundis.forEach(p => newSet.delete(p.id));
        } else {
            filteredTugasPundis.forEach(p => newSet.add(p.id));
        }
        setSelectedTaskIds(newSet);
    };

    const filteredRiwayatPundis = useMemo(() => {
        return (visibleRiwayatPundis || []).filter(r => {
            const term = (searchRiwayat || '').toLowerCase().trim();
            const matchSearch = !term ||
                String(r.noUrut || '').toLowerCase().includes(term) ||
                String(r.donorName || '').toLowerCase().includes(term) ||
                String(r.usaha || '').toLowerCase().includes(term) ||
                String(r.notes || '').toLowerCase().includes(term);
            const matchStatus = statusRiwayatFilter === 'Semua' || r.status === statusRiwayatFilter;
            const matchAmil = amilRiwayatFilter === 'Semua' || r.amilName === amilRiwayatFilter;
            const rTipe = r.tipePundi || 'Pundi Umum';
            const matchTipe = tipeRiwayatFilter === 'Semua' || rTipe === tipeRiwayatFilter;
            let matchMonth = true;
            if (monthRiwayatFilter !== 'Semua') {
                const d = new Date(r.date || r.Tanggal);
                if (!isNaN(d.getTime())) {
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    matchMonth = key === monthRiwayatFilter;
                }
            }
            return matchSearch && matchStatus && matchAmil && matchTipe && matchMonth;
        });
    }, [visibleRiwayatPundis, searchRiwayat, statusRiwayatFilter, tipeRiwayatFilter, monthRiwayatFilter, amilRiwayatFilter]);

    const nextNoUrut = useMemo(() => {
        return (pundis || []).reduce((max, p) => Math.max(max, Number(p.noUrut) || 0), 0) + 1;
    }, [pundis]);

    const openPenarikanModal = (pundi, defaultStatus = 'Berhasil') => {
        if (!pundi) return;
        setSelectedPundi(pundi);
        
        // Cari apakah ada entri pundi ini di bulan berjalan (apa pun statusnya: Belum, Dijemput, Berhasil, atau Gagal)
        const existing = (riwayatPundis || []).find(r => {
            const matchPundi = (String(r.pundiId) === String(pundi.id || pundi.ID)) || (String(r.noUrut) === String(pundi.noUrut));
            if (!matchPundi) return false;
            const tgl = r.date || r.Tanggal;
            if (!tgl) return false;
            const d = new Date(tgl);
            // FITUR ANTI DUPLIKAT: Jika ada data di bulan ini (apa pun statusnya), muat data tersebut untuk di-Edit
            return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        if (existing) {
            const tglVal = existing.date || existing.Tanggal;
            setModalFormDate(tglVal ? new Date(tglVal).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            
            const existAmt = (existing.amount !== undefined && existing.amount !== null && existing.amount !== '') 
                ? String(existing.amount) 
                : ((existing.Nominal !== undefined && existing.Nominal !== null && existing.Nominal !== '') ? String(existing.Nominal) : '');

            // Jika sudah ada nominal atau statusnya Berhasil di bulan itu, otomatis set ke 'Berhasil'
            if (existAmt !== '' || existing.status === 'Berhasil' || existing.Status === 'Berhasil') {
                setModalFormStatus('Berhasil');
            } else {
                setModalFormStatus(existing.status || existing.Status || defaultStatus);
            }
            
            setModalFormAmount(existAmt);
            setModalFormReceiptUrl(existing.receiptUrl || '');
            setModalFormNotes(existing.notes || '');
            setModalFormAmil(existing.amilName || user?.name || 'Amil');
        } else {
            setModalFormDate(new Date().toISOString().split('T')[0]);
            setModalFormStatus(defaultStatus);
            setModalFormAmount('');
            setModalFormReceiptUrl('');
            setModalFormNotes('');
            setModalFormAmil(user?.name || 'Amil');
        }

        setIsInputModalOpen(true);
    };

    const handleCaptureReceipt = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setIsProcessingPhoto(true);
        try {
            const compressed = await compressNotaImage(file, 480, 0.6);
            if (compressed) {
                setModalFormReceiptUrl(compressed);
            }
        } catch(err) {
            console.error("Gagal kompres foto:", err);
        } finally {
            setIsProcessingPhoto(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSaveLaporanPenarikan = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedPundi) return;

        // Peringatan jika koneksi terputus sama sekali
        if (!navigator.onLine) {
            setLocalNetworkStatus('bad');
            setSaveSuccessNotice('⚠️ Jaringan offline: Data disimpan di HP & akan otomatis diunggah saat sinyal bagus.');
            setTimeout(() => setSaveSuccessNotice(null), 5000);
        }

        const cleanDigits = String(modalFormAmount || '').replace(/\D/g, '');
        const numericAmount = cleanDigits ? Number(cleanDigits) : 0;
        const recordDate = modalFormDate || new Date().toISOString().split('T')[0];

        // Ambil data atribut pundi secara aman
        const pundiIdVal = String(selectedPundi.id || selectedPundi.ID || selectedPundi.pundiId || Date.now());
        const noUrutVal = selectedPundi.noUrut || selectedPundi.NoUrut || selectedPundi['No. Urut'] || '-';
        const donorNameVal = selectedPundi.donorName || selectedPundi['Nama Donatur'] || selectedPundi.Nama || selectedPundi.donatur || '-';
        const usahaVal = selectedPundi.usaha || selectedPundi['Nama Usaha'] || selectedPundi.Usaha || '-';
        const tipePundiVal = selectedPundi.tipePundi || selectedPundi['Tipe Pundi'] || selectedPundi.TipePundi || 'Pundi Umum';

        // 1. Ambil seluruh riwayat cache & state (SAFE MERGE: Jangan biarkan ada data riwayat yang hilang)
        let cachedRiwayat = [];
        try {
            const raw = localStorage.getItem('wiz_cache_RiwayatPundi');
            if (raw) cachedRiwayat = JSON.parse(raw);
        } catch(err) {}

        const baseRiwayatMap = new Map();
        (Array.isArray(cachedRiwayat) ? cachedRiwayat : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });
        (Array.isArray(riwayatPundis) ? riwayatPundis : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });

        // 2. KUNCI ANTI-DUPLIKAT: Cek apakah ada record di bulan & tahun target apa pun statusnya
        const dObj = new Date(recordDate);
        const targetMonth = !isNaN(dObj.getTime()) ? dObj.getMonth() : currentMonth;
        const targetYear = !isNaN(dObj.getTime()) ? dObj.getFullYear() : currentYear;

        let existingKeyToUpdate = null;
        for (let [id, r] of baseRiwayatMap.entries()) {
            const matchPundi = (String(r.pundiId) === String(pundiIdVal)) || (String(r.noUrut) === String(noUrutVal));
            const tgl = r.date || r.Tanggal;
            if (matchPundi && tgl) {
                const rd = new Date(tgl);
                if (!isNaN(rd.getTime()) && rd.getMonth() === targetMonth && rd.getFullYear() === targetYear) {
                    // Dalam 1 bulan tidak boleh ada 2 baris data untuk pundi yang sama -> update baris yang ada
                    existingKeyToUpdate = id;
                    break;
                }
            }
        }

        // ID Transaksi (gunakan ID lama jika update di bulan yang sama agar tidak duplikat)
        const recordId = existingKeyToUpdate ? String(existingKeyToUpdate) : String(Date.now() + Math.floor(Math.random() * 1000));
        
        // Buat objek record lengkap dengan 16 kolom spreadsheet
        const newRecord = {
            id: recordId,
            ID: recordId,
            date: recordDate,
            Tanggal: recordDate,
            pundiId: String(pundiIdVal),
            noUrut: String(noUrutVal),
            donorName: String(donorNameVal),
            usaha: String(usahaVal),
            tipePundi: String(tipePundiVal),
            amount: numericAmount,
            Nominal: numericAmount,
            status: String(modalFormStatus || 'Berhasil'),
            Status: String(modalFormStatus || 'Berhasil'),
            amilName: String(modalFormAmil || user?.name || user?.Nama || 'Amil'),
            notes: String(modalFormNotes || ''),
            receiptUrl: String(modalFormReceiptUrl || '')
        };

        if (existingKeyToUpdate) {
            const oldItem = baseRiwayatMap.get(existingKeyToUpdate);
            baseRiwayatMap.set(String(existingKeyToUpdate), { ...oldItem, ...newRecord });
        } else {
            baseRiwayatMap.set(String(newRecord.id), newRecord);
        }

        const finalRiwayatList = Array.from(baseRiwayatMap.values());

        // 3. Simpan State Lokal & Sinkronkan langsung ke Google Sheet
        setRiwayatPundis(finalRiwayatList);
        try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(finalRiwayatList)); } catch(err) {}

        if (typeof syncDataToSheet === 'function') {
            syncDataToSheet('RiwayatPundi', finalRiwayatList);
        }

        if (navigator.onLine) {
            setSaveSuccessNotice(existingKeyToUpdate 
                ? `✅ Data Pundi #${noUrutVal} bulan ini berhasil diperbarui (${formatRpLocal(numericAmount)})`
                : `✅ Berhasil menyimpan penarikan Pundi #${noUrutVal} (${formatRpLocal(numericAmount)})`
            );
        }
        setTimeout(() => setSaveSuccessNotice(null), 5000);

        setIsInputModalOpen(false);
        setSelectedPundi(null);
        setModalFormReceiptUrl('');
        setModalFormAmount('');
        setModalFormNotes('');
    };

    const handleQuickScan = (val) => {
        const cleanVal = String(val).trim();
        if (!cleanVal) return;

        let foundPundi = null;
        if (cleanVal.includes('WIZ-PUNDI-')) {
            const extractedId = cleanVal.split('WIZ-PUNDI-')[1].trim();
            foundPundi = (pundis || []).find(p => String(p.id || p.ID) === String(extractedId));
        } else if (!isNaN(cleanVal) && cleanVal.length > 0) {
            foundPundi = (pundis || []).find(p => String(p.noUrut) === cleanVal);
        }

        if (foundPundi) {
            setIsQuickScanOpen(false);
            openPenarikanModal(foundPundi, 'Berhasil');
        } else {
            const el = document.createElement('div');
            el.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all text-center`;
            el.innerText = "❌ QR Pundi tidak ditemukan di sistem.";
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
    };

    const markAsDijemput = (pundisToUpdate) => {
        const todayStr = new Date().toISOString().split('T')[0];

        let cachedRiwayat = [];
        try {
            const raw = localStorage.getItem('wiz_cache_RiwayatPundi');
            if (raw) cachedRiwayat = JSON.parse(raw);
        } catch(e) {}

        const baseRiwayatMap = new Map();
        (Array.isArray(cachedRiwayat) ? cachedRiwayat : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });
        (Array.isArray(riwayatPundis) ? riwayatPundis : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });

        let allRiwayatList = Array.from(baseRiwayatMap.values());
        let hasChanges = false;

        pundisToUpdate.forEach((p, idx) => {
            const existingIdx = allRiwayatList.findIndex(r => {
                const matchPundi = (r.pundiId && String(r.pundiId) === String(p.id || p.ID)) || 
                                   (r.noUrut && String(r.noUrut) === String(p.noUrut));
                const tgl = r.date || r.Tanggal;
                if (!matchPundi || !tgl) return false;
                const d = new Date(tgl);
                if (isNaN(d.getTime())) return false;
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            if (existingIdx >= 0) {
                const existing = allRiwayatList[existingIdx];
                if (existing.status === 'Belum' || !existing.status) {
                    allRiwayatList[existingIdx] = {
                        ...existing,
                        status: 'Dijemput',
                        Status: 'Dijemput',
                        tipePundi: p.tipePundi || existing.tipePundi || 'Pundi Umum',
                        amilName: existing.amilName || user?.name || 'Amil'
                    };
                    hasChanges = true;
                }
            } else {
                const recId = String(Date.now() + idx + Math.floor(Math.random() * 1000));
                const newRow = {
                    id: recId,
                    ID: recId,
                    date: todayStr,
                    Tanggal: todayStr,
                    pundiId: String(p.id || p.ID),
                    noUrut: String(p.noUrut || '-'),
                    donorName: String(p.donorName || '-'),
                    usaha: String(p.usaha || '-'),
                    tipePundi: String(p.tipePundi || 'Pundi Umum'),
                    amount: 0,
                    Nominal: 0,
                    status: 'Dijemput',
                    Status: 'Dijemput',
                    amilName: String(user?.name || user?.Nama || 'Amil'),
                    notes: 'Otomatis dicetak',
                    receiptUrl: ''
                };
                allRiwayatList.push(newRow);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setRiwayatPundis(allRiwayatList);
            try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(allRiwayatList)); } catch(e) {}
            if (typeof syncDataToSheet === 'function') syncDataToSheet('RiwayatPundi', allRiwayatList);
        }
    };

    const handlePrintChecklist = () => {
        const dataToPrint = selectedTaskIds.size > 0 
            ? activePundisSorted.filter(p => selectedTaskIds.has(p.id)) 
            : filteredTugasPundis;
        if (dataToPrint.length === 0) return;

        markAsDijemput(dataToPrint);

        const printWindow = window.open('', '_blank');
        const tglCetak = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        const totalItem = dataToPrint.length;
        const printPetugasName = selectedAmilFilter !== 'Semua' ? selectedAmilFilter : (user?.name || '-');
        const fontSize = totalItem > 25 ? '8px' : totalItem > 15 ? '9px' : '10px';
        const cellPadding = totalItem > 25 ? '2.5px 4px' : totalItem > 15 ? '3.5px 5px' : '5px 6px';
        const rangeKeterangan = selectedTaskIds.size > 0 
            ? `(${selectedTaskIds.size} Pilihan Ceklis Manual)` 
            : (urutAwal || urutAkhir ? `(Urut ${urutAwal || '1'} - ${urutAkhir || 'Akhir'})` : '');

        let html = `
        <html>
        <head>
            <title>Checklist Penarikan Pundi ZIS - WIZ Berau</title>
            <style>
                @page { size: A4 portrait; margin: 6mm 7mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #111; font-size: ${fontSize}; line-height: 1.15; background: #fff; }
                .header-wrap { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #27745F; padding-bottom: 5px; margin-bottom: 6px; }
                .header-left { display: flex; align-items: center; gap: 8px; }
                .header-brand { font-size: 15px; font-weight: 900; letter-spacing: -0.5px; }
                .brand-wiz { color: #27745F; }
                .brand-berau { color: #F59121; }
                .header-title h2 { margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1f2937; letter-spacing: 0.3px; }
                .header-title p { margin: 1px 0 0 0; font-size: 8.5px; color: #4b5563; }
                .header-meta { text-align: right; font-size: 8px; color: #374151; line-height: 1.3; background: #f8faf9; border: 1px solid #e2e8f0; padding: 3px 6px; border-radius: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 2px; table-layout: fixed; }
                th, td { border: 1px solid #94a3b8; padding: ${cellPadding}; text-align: left; vertical-align: middle; }
                th { background-color: #27745F; color: #ffffff; font-weight: 800; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.2px; }
                tr { page-break-inside: avoid; }
                .text-center { text-align: center; }
                .run-no { font-weight: bold; color: #475569; width: 5%; }
                .no-col { font-weight: 900; color: #166534; font-size: 10px; background: #f0fdf4; }
                .cell-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .alamat-text { font-size: 8px; color: #475569; line-height: 1.1; }
                .check-box { width: 13px; height: 13px; border: 1.2px solid #64748b; display: inline-block; border-radius: 2px; vertical-align: middle; }
                .footer-wrap { margin-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 8.5px; page-break-inside: avoid; }
                .summary-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 8px; line-height: 1.35; }
                .ttd-block { width: 180px; text-align: center; font-size: 8px; }
                .ttd-space { height: 28px; }
                .ttd-line { border-bottom: 1px solid #333; font-weight: bold; padding-bottom: 2px; }
            </style>
        </head>
        <body>
            <div class="header-wrap">
                <div class="header-left">
                    <div class="header-brand"><span class="brand-wiz">WIZ</span><span class="brand-berau">BERAU</span></div>
                    <div class="header-title">
                        <h2>Lembar Checklist Penarikan Pundi ZIS</h2>
                        <p>Wahdah Inspirasi Zakat Gerai Berau • Bulan: ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
                <div class="header-meta">
                    <div><b>Tanggal:</b> ${tglCetak}</div>
                    <div><b>Petugas:</b> ${printPetugasName}</div>
                    <div><b>Total Dicetak:</b> ${totalItem} Pundi ${rangeKeterangan}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="text-center run-no">No</th>
                        <th class="text-center" style="width: 10%;">Reg</th>
                        <th style="width: 22%;">Nama Usaha / Titik</th>
                        <th style="width: 20%;">Donatur & Kontak</th>
                        <th style="width: 23%;">Alamat Titik</th>
                        <th style="width: 13%;">Nominal (Rp)</th>
                        <th class="text-center" style="width: 7%;">Cek</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataToPrint.map((p, idx) => `
                        <tr>
                            <td class="text-center run-no">${idx + 1}</td>
                            <td class="text-center no-col">#${p.noUrut || '-'}</td>
                            <td><b style="color: #0f172a;">${p.usaha || '-'}</b> ${p.zona ? `<span style="font-size:7px; background:#e0f2fe; color:#0369a1; padding:1px 3px; border-radius:3px;">${p.zona}</span>` : ''}</td>
                            <td>
                                <div class="cell-truncate"><b>${p.donorName || '-'}</b></div>
                                <div style="font-size: 7.5px; color: #64748b;">${p.phone || '-'}</div>
                            </td>
                            <td class="alamat-text">${p.alamat || '-'}</td>
                            <td style="font-size: 8.5px; color: #64748b;">Rp</td>
                            <td class="text-center"><span class="check-box"></span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer-wrap">
                <div class="summary-box">
                    <b>Catatan Sistem:</b> Pundi yang dicetak ini otomatis berubah statusnya menjadi <b>"Dalam Penjemputan"</b> di aplikasi.<br/>
                    Setelah penjemputan selesai, buka aplikasi menu Tugas dan klik <b>"Hitung Uang"</b> untuk memasukkan nominal.
                </div>
                <div class="ttd-block">
                    <p style="margin: 0;">Berau, ${tglCetak}</p>
                    <div class="ttd-space"></div>
                    <div class="ttd-line">(${printPetugasName})</div>
                    <span style="color: #64748b; font-size: 7.5px;">Petugas Penjemput Pundi</span>
                </div>
            </div>
        </body>
        </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const handlePrintNotaA4 = () => {
        const dataToPrint = selectedTaskIds.size > 0 
            ? activePundisSorted.filter(p => selectedTaskIds.has(p.id)) 
            : filteredTugasPundis;
        if (dataToPrint.length === 0) return;

        markAsDijemput(dataToPrint);

        const printWindow = window.open('', '_blank');
        const tglHariIni = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        const printPetugasName = selectedAmilFilter !== 'Semua' ? selectedAmilFilter : (user?.name || '...................');

        const chunks = [];
        for (let i = 0; i < dataToPrint.length; i += 10) {
            chunks.push(dataToPrint.slice(i, i + 10));
        }

        let pagesHtml = chunks.map((group, pageIdx) => `
            <div class="a4-page">
                ${group.map((p, itemIdx) => {
                    const runningNum = (pageIdx * 10) + itemIdx + 1;
                    return `
                    <div class="nota-card">
                        <div class="nota-header">
                            <div class="nota-brand">
                                <span class="brand-wiz">WIZ</span><span class="brand-berau">BERAU</span>
                                <span class="nota-title">BUKTI INFAQ / SEDEKAH PUNDI</span>
                            </div>
                            <div class="badge-urut">Cetak #${runningNum} | Pundi #${p.noUrut}</div>
                        </div>
                        
                        <div class="nota-body">
                            <div class="qr-col">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=WIZ-PUNDI-${p.id}&margin=0" alt="QR Pundi" class="qr-img" />
                                <span class="qr-id">ID: ${p.id}</span>
                            </div>
                            <div class="info-col">
                                <div class="info-row"><span class="label">Donatur</span>: <b>${p.donorName}</b></div>
                                <div class="info-row"><span class="label">Usaha</span>: <span>${p.usaha || '-'}</span></div>
                                <div class="info-row"><span class="label">Alamat</span>: <span class="alamat-text">${p.alamat || '-'}</span></div>
                                <div class="info-row"><span class="label">Tanggal</span>: <span>${tglHariIni}</span></div>
                                <div class="nominal-box">
                                    <span class="nominal-label">Jumlah:</span>
                                    <span class="nominal-line">Rp .............................................</span>
                                </div>
                            </div>
                        </div>

                        <div class="nota-footer">
                            <div class="ttd-col">
                                <p>Donatur / Toko</p>
                                <div class="ttd-line"></div>
                            </div>
                            <div class="ttd-doa">"Semoga Allah memberkahi harta yang dizakatkan & disedekahkan"</div>
                            <div class="ttd-col">
                                <p>Amil Petugas</p>
                                <div class="ttd-line">(${printPetugasName})</div>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `).join('');

        let html = `
        <html>
        <head>
            <title>Cetak 10 Nota Pundi A4 - WIZ Berau</title>
            <style>
                @page { size: A4 portrait; margin: 6mm 7mm; }
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #fff; }
                .a4-page { width: 100%; height: 284mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(5, 54mm); gap: 3.5mm; page-break-after: always; break-after: page; }
                .a4-page:last-child { page-break-after: avoid; break-after: avoid; }
                .nota-card { border: 1px dashed #4b5563; border-radius: 6px; padding: 5px 7px; display: flex; flex-direction: column; justify-content: space-between; background: #fff; overflow: hidden; position: relative; }
                .nota-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #27745F; padding-bottom: 3px; margin-bottom: 3px; }
                .nota-brand { font-size: 11px; font-weight: 900; line-height: 1.1; }
                .brand-wiz { color: #27745F; }
                .brand-berau { color: #F59121; margin-right: 5px; }
                .nota-title { font-size: 8px; font-weight: bold; color: #374151; letter-spacing: 0.3px; }
                .badge-urut { background: #27745F; color: #ffffff; font-weight: 900; font-size: 11px; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.5px; }
                .nota-body { display: flex; gap: 6px; align-items: center; flex: 1; }
                .qr-col { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 135px; flex-shrink: 0; padding-right: 6px; }
                .qr-img { width: 130px; height: 130px; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px; }
                .qr-id { font-size: 6.5px; color: #6b7280; margin-top: 2px; font-family: monospace; font-weight: bold; }
                .info-col { flex: 1; font-size: 8.5px; line-height: 1.25; }
                .info-row { margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .info-row .label { display: inline-block; width: 38px; color: #4b5563; font-weight: 600; }
                .alamat-text { color: #4b5563; font-size: 8px; }
                .nominal-box { margin-top: 2px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 2px 4px; display: flex; align-items: center; }
                .nominal-label { font-weight: 800; color: #166534; font-size: 8.5px; margin-right: 4px; }
                .nominal-line { font-weight: 900; color: #15803d; font-size: 9.5px; }
                .nota-footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 7.5px; border-top: 0.5px dotted #9ca3af; padding-top: 2px; margin-top: 2px; }
                .ttd-col { text-align: center; width: 65px; }
                .ttd-col p { margin: 0; color: #4b5563; font-weight: 600; font-size: 7px; }
                .ttd-line { height: 14px; border-bottom: 1px dotted #6b7280; margin-top: 1px; font-size: 7px; color: #374151; display: flex; align-items: flex-end; justify-content: center; }
                .ttd-doa { font-size: 6.5px; font-style: italic; color: #6b7280; text-align: center; max-width: 110px; line-height: 1.1; }
            </style>
        </head>
        <body>
            ${pagesHtml}
        </body>
        </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 800);
    };

    const savePundi = (formData, isEdit) => {
        const now = new Date().toISOString();
        const targetId = String(formData.id || formData.ID || Date.now());
        const existing = isEdit ? pundis.find(p => String(p.id || p.ID) === targetId) : null;
        let newData = { 
            ...(existing || {}),
            ...formData, 
            id: Number(targetId),
            ID: Number(targetId),
            tipePundi: formData.tipePundi || (existing && existing.tipePundi) || 'Pundi Umum',
            zona: (formData.zona || (existing && existing.zona) || 'SEKITAR TANJUNG').toString().trim().toUpperCase(),
            updatedAt: now 
        };
        if (!isEdit) {
            newData.createdAt = now;
            newData.createdBy = user?.name || user?.Nama || 'Amil';
        }
        const updatedList = isEdit 
            ? pundis.map(p => String(p.id || p.ID) === targetId ? newData : p) 
            : [...pundis, newData];
        setPundis(updatedList);
        if (typeof syncDataToSheet === 'function') syncDataToSheet('Pundi', updatedList);
    };

    // ===== Impor riwayat sedekah pundi dari CSV (dikunci dengan ID Pundi) =====
    const RiwayatImportSchema = [
        { name: 'id', label: 'ID Riwayat' },
        { name: 'pundiId', label: 'ID Pundi' },
        { name: 'noUrut', label: 'No Urut Pundi', type: 'number' },
        { name: 'donorName', label: 'Nama Donatur' },
        { name: 'usaha', label: 'Nama Usaha / Lokasi' },
        { name: 'date', label: 'Tanggal', type: 'date', required: true, skipIfEmpty: true },
        { name: 'amount', label: 'Nominal', isCurrency: true, required: true, skipIfEmpty: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Berhasil', 'Dijemput', 'Gagal'], required: true },
        { name: 'amilName', label: 'PIC Amil' },
        { name: 'notes', label: 'Catatan' }
    ];
    const riwayatMonthKey = (d) => {
        const t = String(d || '');
        const m = t.match(/^(\d{4})-(\d{2})/);
        if (m) return m[1] + '-' + m[2];
        const x = new Date(t);
        return isNaN(x.getTime()) ? '' : x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
    };
    const cleanPundiIdInput = (v) => String(v || '').trim().replace(/^'/, '').replace(/\.0+$/, '');
    const findPundiById = (rawId) => {
        const id = cleanPundiIdInput(rawId);
        return id ? (pundis || []).find(p => String(p.id || p.ID) === id) : undefined;
    };
    const findPundiByNo = (no) => (pundis || []).find(p => String(Number(p.noUrut || p.NoUrut)) === String(Number(no)));
    // Cari pundi untuk satu baris: utamakan ID Pundi, bila kosong pakai No Urut. Hasil: { pundi } atau { error }
    const resolvePundiForRow = (item) => {
        const raw = cleanPundiIdInput(item.pundiId);
        if (raw) {
            if (/^\d+(\.\d+)?e\+?\d+$/i.test(raw)) return { error: 'ID Pundi "' + raw + '" tampil dalam format ilmiah; ubah format kolom ID di Sheet menjadi Angka biasa lalu unduh ulang' };
            const pundi = findPundiById(raw);
            if (!pundi) return { error: 'ID Pundi "' + raw + '" tidak ada di Data Master Kotak Pundi' };
            if (item.noUrut && String(Number(pundi.noUrut)) !== String(Number(item.noUrut))) return { error: 'ID Pundi dan No Urut tidak cocok (ID ini milik pundi #' + pundi.noUrut + ')' };
            return { pundi };
        }
        if (item.noUrut) {
            const pundi = findPundiByNo(item.noUrut);
            return pundi ? { pundi } : { error: 'No Urut ' + item.noUrut + ' tidak ada di Data Master Kotak Pundi' };
        }
        return { error: 'isi ID Pundi atau No Urut Pundi' };
    };
    // Pemeriksa per baris: pundi harus ditemukan, ID Riwayat unik, maksimal 1 data per pundi per bulan
    const makeRiwayatRowCheck = () => {
        const taken = new Set();
        const usedIds = new Set();
        (riwayatPundis || []).forEach(r => {
            usedIds.add(String(r.id || r.ID));
            const k = riwayatMonthKey(r.date || r.Tanggal);
            if (!k) return;
            if (r.pundiId) taken.add(String(r.pundiId) + '|' + k);
            const p = findPundiById(r.pundiId);
            if (p && r.noUrut) taken.add(String(p.id || p.ID) + '|' + k);
        });
        return (item) => {
            const res = resolvePundiForRow(item);
            if (res.error) return res.error;
            const rid = String(item.id || '').trim();
            if (rid) {
                if (usedIds.has(rid)) return 'ID Riwayat ' + rid + ' sudah dipakai';
                usedIds.add(rid);
            }
            const pundi = res.pundi;
            const k = riwayatMonthKey(item.date);
            const key = String(pundi.id || pundi.ID) + '|' + k;
            if (taken.has(key)) return 'pundi #' + (pundi.noUrut || '') + ' sudah punya data di bulan ' + k;
            taken.add(key);
            return null;
        };
    };
    // Templat riwayat berisi daftar pundi aktif (ID Pundi, No Urut, Donatur, Usaha) agar tinggal isi Tanggal & Nominal
    const riwayatTemplateRows = () => {
        const picDefault = (effectiveAmil && effectiveAmil !== 'Semua' && effectiveAmil !== '__none__') ? effectiveAmil : '';
        return (visiblePundis || [])
            .filter(p => String(p.status || 'Aktif').trim().toLowerCase() === 'aktif')
            .slice().sort((x, y) => Number(x.noUrut || 0) - Number(y.noUrut || 0))
            .map(p => RiwayatImportSchema.map(f => {
                const vals = { pundiId: String(p.id || p.ID), noUrut: p.noUrut || '', donorName: p.donorName || '', usaha: p.usaha || '', status: 'Berhasil', amilName: picDefault };
                return vals[f.name] !== undefined ? vals[f.name] : '';
            }));
    };
    const importRiwayat = (items) => {
        const base = Date.now();
        const prepared = [];
        items.forEach((it, i) => {
            const res = resolvePundiForRow(it);
            if (res.error) return;
            const pundi = res.pundi;
            const id = String(it.id || '').trim() || String(base + i);
            const amount = Number(it.amount) || 0;
            const status = it.status || 'Berhasil';
            prepared.push({
                id, ID: id,
                date: it.date, Tanggal: it.date,
                pundiId: String(pundi.id || pundi.ID),
                noUrut: String(pundi.noUrut || pundi.NoUrut || ''),
                donorName: String(pundi.donorName || pundi['Nama Donatur'] || pundi.Nama || ''),
                usaha: String(pundi.usaha || pundi['Nama Usaha'] || pundi.Usaha || ''),
                tipePundi: String(pundi.tipePundi || pundi['Tipe Pundi'] || 'Pundi Umum'),
                amount, Nominal: amount,
                status, Status: status,
                amilName: String(it.amilName || user?.name || user?.Nama || 'Amil'),
                notes: String(it.notes || ''),
                receiptUrl: ''
            });
        });
        if (prepared.length > 0) {
            const finalList = [...(riwayatPundis || []), ...prepared];
            setRiwayatPundis(finalList);
            try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(finalList)); } catch (err) {}
            if (typeof syncDataToSheet === 'function') syncDataToSheet('RiwayatPundi', finalList);
        }
        return { added: prepared.length, skipped: 0 };
    };
    // Unduh daftar ID pundi (untuk disalin ke Google Sheet)
    const downloadDaftarIdPundi = () => {
        const esc = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
        const rows = [['ID Pundi', 'No Urut', 'Nama Donatur', 'Nama Usaha / Lokasi', 'Zona']]
            .concat((pundis || []).slice().sort((x, y) => Number(x.noUrut || 0) - Number(y.noUrut || 0))
                .map(p => [String(p.id || p.ID), p.noUrut || '', p.donorName || '', p.usaha || '', p.zona || '']));
        const blob = new Blob(['\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'daftar-id-pundi.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    // Pemeriksa baris master: ID Pundi (opsional, kosong = otomatis) harus angka & belum dipakai
    const makeMasterRowCheck = () => {
        const used = new Set((pundis || []).map(p => String(p.id || p.ID)));
        return (item) => {
            const id = cleanPundiIdInput(item.id);
            if (!id) return null;
            if (!/^\d+$/.test(id)) return 'ID Pundi harus berupa angka (kosongkan agar dibuat otomatis)';
            if (used.has(id)) return 'ID Pundi ' + id + ' sudah dipakai';
            used.add(id);
            return null;
        };
    };

    // Impor massal data master pundi dari CSV
    const importPundi = (items) => {
        const now = new Date().toISOString();
        const digits = (v) => String(v || '').replace(/\D/g, '');
        const keyOf = (p) => digits(p.phone) + '|' + String(p.usaha || '').trim().toLowerCase();
        const seen = new Set((pundis || []).map(keyOf));
        const used = new Set((pundis || []).map(p => Number(p.noUrut)).filter(Boolean));
        let nextNo = nextNoUrut;
        const base = Date.now();
        let skipped = 0;
        const prepared = [];
        items.forEach(it => {
            const k = keyOf(it);
            if (seen.has(k)) { skipped++; return; }
            seen.add(k);
            let no = Number(it.noUrut);
            if (!no || used.has(no)) {
                while (used.has(nextNo)) nextNo++;
                no = nextNo;
            }
            used.add(no);
            const givenId = cleanPundiIdInput(it.id);
            let id = base + prepared.length;
            if (givenId && /^\d+$/.test(givenId)) id = Number.isSafeInteger(Number(givenId)) ? Number(givenId) : givenId;
            prepared.push({
                ...it,
                id, ID: id,
                noUrut: no,
                tipePundi: it.tipePundi || 'Pundi Umum',
                status: it.status || 'Aktif',
                zona: String(it.zona || 'SEKITAR TANJUNG').trim().toUpperCase(),
                createdAt: now, updatedAt: now,
                createdBy: user?.name || user?.Nama || 'Amil'
            });
        });
        if (prepared.length > 0) {
            const updatedList = [...(pundis || []), ...prepared];
            setPundis(updatedList);
            if (typeof syncDataToSheet === 'function') syncDataToSheet('Pundi', updatedList);
        }
        return { added: prepared.length, skipped };
    };

    // Fungsi Pemicu Peringatan Konfirmasi Hapus Data
    const requestDeletePundi = (row) => {
        setDeletePrompt({
            type: 'pundi',
            data: row,
            title: `Hapus Kotak Pundi #${row.noUrut || '-'}?`,
            message: `Apakah Anda yakin ingin menghapus data kotak pundi "${row.usaha || row.donorName || '-'}"? Data pundi ini akan dihapus permanen dari sistem dan Google Sheet.`
        });
    };

    const requestDeleteRiwayat = (row) => {
        setDeletePrompt({
            type: 'riwayat',
            data: row,
            title: `Hapus Riwayat Penarikan #${row.noUrut || '-'}?`,
            message: `Apakah Anda yakin ingin menghapus catatan penarikan tanggal ${formatDateLocal(row.date || row.Tanggal)} senilai ${formatRpLocal(row.amount || row.Nominal)} (${row.usaha || row.donorName || '-'})?`
        });
    };

    const requestDeleteTarget = (tgt) => {
        setDeletePrompt({
            type: 'target',
            data: tgt,
            title: `Hapus Target Amil?`,
            message: `Apakah Anda yakin ingin menghapus target untuk "${tgt.amilName}" periode ${tgt.bulan === 'Semua' ? `Tahun ${tgt.tahun}` : `${monthNames[tgt.bulan]} ${tgt.tahun}`}?`
        });
    };

    // Eksekusi Hapus Setelah Dikonfirmasi oleh Pengguna
    const handleConfirmDelete = () => {
        if (!deletePrompt) return;
        const { type, data } = deletePrompt;

        if (type === 'pundi') {
            const targetId = String(data.id || data.ID);
            const updatedList = (pundis || []).filter(p => String(p.id || p.ID) !== targetId);
            setPundis(updatedList);
            try { localStorage.setItem('wiz_cache_Pundi', JSON.stringify(updatedList)); } catch(e) {}
            if (typeof syncDataToSheet === 'function') syncDataToSheet('Pundi', updatedList, null, true);
        } else if (type === 'riwayat') {
            const targetId = String(data.id || data.ID);
            const updated = (riwayatPundis || []).filter(r => String(r.id || r.ID) !== targetId);
            setRiwayatPundis(updated);
            try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(updated)); } catch(e) {}
            // PERBAIKAN: Mengirim ke sheet 'RiwayatPundi' dengan penanda isDelete = true
            if (typeof syncDataToSheet === 'function') syncDataToSheet('RiwayatPundi', updated, null, true);
        } else if (type === 'target') {
            const updated = (targetsList || []).filter(t => String(t.id) !== String(data.id));
            saveTargetsListState(updated);
        }

        setDeletePrompt(null);
    };

    const handleOpenEditRiwayat = (row) => {
        setEditingRiwayat(row);
        setIsEditRiwayatOpen(true);
    };

    const saveEditRiwayat = (formData) => {
        const targetId = String(editingRiwayat?.id || editingRiwayat?.ID);
        const numericAmount = Number(String(formData.amount || formData.Nominal || 0).replace(/\D/g, '')) || 0;
        const updated = (riwayatPundis || []).map(r => {
            if (String(r.id || r.ID) === targetId) {
                return {
                    ...r,
                    ...formData,
                    id: targetId,
                    ID: targetId,
                    amount: numericAmount,
                    Nominal: numericAmount,
                    receiptUrl: formData.receiptUrl || r.receiptUrl || ''
                };
            }
            return r;
        });
        setRiwayatPundis(updated);
        try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(updated)); } catch(e) {}
        if (typeof syncDataToSheet === 'function') syncDataToSheet('RiwayatPundi', updated);
        setIsEditRiwayatOpen(false);
        setEditingRiwayat(null);
    };

    const deleteRiwayat = (row) => {
        const targetId = String(row.id || row.ID);
        const updated = (riwayatPundis || []).filter(r => String(r.id || r.ID) !== targetId);
        setRiwayatPundis(updated);
        try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(updated)); } catch(e) {}
        // PERBAIKAN: Mengirim ke sheet 'RiwayatPundi' dengan penanda isDelete = true
        if (typeof syncDataToSheet === 'function') syncDataToSheet('RiwayatPundi', updated, null, true);
    };

    const MasterPundiSchema = [
        { name: 'noUrut', label: 'Nomor Urut Penarikan (Angka)', type: 'number', required: true },
        { name: 'tipePundi', label: 'Jenis / Tipe Pundi', type: 'select', options: ['Pundi Umum', 'Pundi Pribadi'], required: true },
        { name: 'zona', label: 'Zona Wilayah Pundi (Pilih / Ketik Manual)', type: 'datalist', options: allZonaOptions, required: true },
        { name: 'donorName', label: 'Nama Donatur (Ketik Manual)', type: 'text', required: true },
        { name: 'phone', label: 'Nomor Telp / WhatsApp', type: 'text', required: true },
        { name: 'usaha', label: 'Nama Usaha / Lokasi Titik', required: true },
        { name: 'status', label: 'Status Pundi', type: 'select', options: ['Aktif', 'Ditarik'], required: true },
        { name: 'alamat', label: 'Alamat Spesifik Pundi', type: 'berau_address', fullWidth: true, required: true },
        { name: 'mapUrl', label: 'Titik Lokasi Google Maps (GPS)', type: 'map_location', fullWidth: true }
    ];

    // Skema khusus impor CSV: judul kolom singkat; No. Urut boleh kosong (otomatis)
    const MasterPundiImportSchema = [
        { name: 'id', label: 'ID Pundi' },
        { name: 'noUrut', label: 'No Urut', type: 'number', required: false },
        { name: 'tipePundi', label: 'Tipe Pundi', type: 'select', options: ['Pundi Umum', 'Pundi Pribadi'], required: true },
        { name: 'zona', label: 'Zona', required: true },
        { name: 'donorName', label: 'Nama Donatur', required: true },
        { name: 'phone', label: 'No HP / WA', required: true },
        { name: 'usaha', label: 'Nama Usaha / Lokasi', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Ditarik'], required: true },
        { name: 'alamat', label: 'Alamat', required: true },
        { name: 'mapUrl', label: 'Link Google Maps' }
    ];

    const MasterPundiColumns = [
        { key: 'noUrut', label: 'No. Urut', render: r => <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg font-black text-gray-700 dark:text-gray-300">#{r.noUrut}</span> },
        { key: 'donorName', label: 'Identitas & Lokasi', render: r => (
            <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-gray-800 dark:text-gray-100">{r.donorName}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${r.tipePundi === 'Pundi Pribadi' ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800'}`}>
                        {r.tipePundi || 'Pundi Umum'}
                    </span>
                    {r.zona && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <i className="fa-solid fa-location-dot mr-0.5"></i> {r.zona}
                        </span>
                    )}
                </div>
                <p className="text-xs text-wiz-orange dark:text-amber-400 font-medium mt-0.5"><i className="fa-solid fa-store mr-1"></i> {r.usaha}</p>
                {r.phone && <p className="text-[11px] text-gray-500 mt-0.5"><i className="fa-brands fa-whatsapp text-green-500 mr-1"></i> {r.phone}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5 select-all">ID: {r.id || r.ID}</p>
            </div>
        )},
        { key: 'alamat', label: 'Alamat & Titik Peta', render: r => (
            <div className="space-y-1">
                <span className="truncate max-w-[200px] block text-gray-500">{r.alamat}</span>
                {r.mapUrl ? (() => {
                    const mapUrls = parseMapUrlsLocal(r.mapUrl);
                    return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                                href={mapUrls.navUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-wiz-green/10 text-wiz-green dark:text-emerald-400 text-[11px] font-bold hover:bg-wiz-green hover:text-white transition-colors border border-wiz-green/20"
                                title="Buka di HP"
                            >
                                <i className="fa-solid fa-mobile-screen"></i> Di HP
                            </a>
                            <a
                                href={mapUrls.webUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-800"
                                title="Buka di Web Maps"
                            >
                                <i className="fa-solid fa-globe"></i> Web Maps
                            </a>
                        </div>
                    );
                })() : (
                    <span className="text-[10px] text-gray-400 italic">Belum ada titik GPS</span>
                )}
            </div>
        )},
        { key: 'status', label: 'Status', render: r => <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'Aktif' ? 'bg-wiz-green/10 text-wiz-green' : 'bg-red-50 text-red-500'}`}>{r.status}</span> },
        { key: 'createdBy', label: 'Dibuat Oleh', render: r => {
            const creator = r.createdBy || (contacts || []).find(c => c.name === r.donorName)?.createdBy;
            return (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-[10px] font-bold">
                        {creator ? creator.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{creator || '-'}</span>
                </div>
            );
        }},
        { key: 'print', label: 'QR', render: r => (
            <button onClick={() => setPrintQR(r)} className="p-2 text-wiz-orange hover:bg-wiz-orange/10 rounded-lg transition-colors" title="Cetak Stiker QR">
                <i className="fa-solid fa-qrcode text-lg"></i>
            </button>
        )}
    ];

    return (
        <div className="space-y-6 slide-up relative">
            {/* Input Kamera dan Galeri Tersembunyi */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCaptureReceipt}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCaptureReceipt}
            />

            {/* NOTIFIKASI TOAST SUKSES SIMPAN DATA */}
            {saveSuccessNotice && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in border border-emerald-400">
                    <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
                    <span className="text-xs font-bold">{saveSuccessNotice}</span>
                </div>
            )}

            {/* HEADER MANAJEMEN PUNDI */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
                        <span className="p-2 bg-wiz-green/10 text-wiz-green dark:text-emerald-400 rounded-2xl">
                            <i className="fa-solid fa-box-open"></i>
                        </span>
                        Manajemen Pundi WIZ
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sistem kontrol target, pencatatan penarikan, dan donatur kotak pundi.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* LAMPU KONTROL SINYAL PUNDI */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-xs ${
                        localNetworkStatus === 'good'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    }`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${localNetworkStatus === 'good' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span>{localNetworkStatus === 'good' ? 'Sinyal Bagus' : 'Jaringan Lemah'}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsQuickScanOpen(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-wiz-orange to-amber-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                        <i className="fa-solid fa-qrcode text-base"></i>
                        <span>Pindai QR (Jemput)</span>
                    </button>

                    {isAdmin ? (
                        <div className="flex items-center gap-2.5 bg-white dark:bg-gray-800 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <i className="fa-solid fa-user-tag text-wiz-green text-sm"></i>
                            <select
                                value={selectedAmilFilter}
                                onChange={(e) => setSelectedAmilFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
                            >
                                <option value="Semua" className="dark:bg-gray-800">Semua Amil</option>
                                {allAmilNames.map((name, idx) => (
                                    <option key={idx} value={name} className="dark:bg-gray-800">{name}</option>
                                ))}
                                <option value="__none__" className="dark:bg-gray-800">Tanpa PIC (belum terdata)</option>
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-wiz-green/10 px-3 py-2 rounded-xl border border-wiz-green/20">
                            <i className="fa-solid fa-user-check text-wiz-green text-xs"></i>
                            <span className="text-xs font-bold text-wiz-green">{user?.name}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB NAVIGASI UTAMA */}
            <div className="flex overflow-x-auto gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full hide-scrollbar">
                {[
                    { id: 'dashboard', label: 'Dashboard Analitik', icon: 'fa-chart-pie' },
                    { id: 'target', label: 'Menu Target & Amil', icon: 'fa-bullseye', badge: 'Target' },
                    { id: 'tugas', label: 'Tugas Penarikan', icon: 'fa-clipboard-list' },
                    { id: 'master', label: 'Data Master Pundi', icon: 'fa-boxes-stacked' },
                    { id: 'riwayat', label: 'Riwayat Sedekah', icon: 'fa-money-bill-wave' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                            activeSubTab === tab.id ? 'bg-wiz-green text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                    >
                        <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                        {tab.badge && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-black uppercase ${
                                activeSubTab === tab.id ? 'bg-white/20 text-white' : 'bg-wiz-orange text-white'
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ========================================================================= */}
            {/* SUB TAB: DASHBOARD ANALITIK                                              */}
            {/* ========================================================================= */}
            {activeSubTab === 'dashboard' && (() => {
                const nf = (n) => Number(n || 0).toLocaleString('id-ID');
                const rp = (n) => 'Rp ' + nf(n);
                const dash = (n) => Number(n) ? nf(n) : '-';
                const periodeLabel = dashMonth === 'Semua' ? ('tahun ' + dashYear) : ('bulan ' + monthNames[dashMonth] + ' ' + dashYear);
                const Sep = () => <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>;
                const selectCls = "px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-100";
                const cardCls = "bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm";
                const labelCls = "text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300";
                const bigCls = "text-3xl font-extrabold text-gray-700 dark:text-gray-100 mt-1";
                const subCls = "text-[10px] text-gray-400 mt-3";
                const k = kinerja;
                return (
                    <div className="space-y-5 animate-in">
                        <div className="bg-white dark:bg-gray-800 px-6 py-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-xl font-extrabold text-gray-700 dark:text-gray-100">Statistik Kinerja</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Ringkasan performa kerja {periodeLabel}.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <select value={dashMonth} onChange={(e) => setDashMonth(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value))} className={selectCls}>
                                    <option value="Semua">Semua Bulan</option>
                                    {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                </select>
                                <select value={dashYear} onChange={(e) => setDashYear(Number(e.target.value))} className={selectCls}>
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className={cardCls}>
                                <p className={labelCls}>Total Muzakki Aktif</p>
                                <p className={bigCls}>{nf(k.totalMuzakki)}</p>
                                <p className={subCls}>U:{k.aktifU}<Sep />K:{k.aktifK}<Sep />I:{k.aktifI}</p>
                            </div>
                            <div className={cardCls}>
                                <p className={labelCls}>Pundi Awal Bulan</p>
                                <p className={bigCls}>{nf(k.awalTotal)}</p>
                                <p className={subCls}>U:{k.awal.u}<Sep />K:{k.awal.k} <span className="text-gray-300">(Bln Kemarin)</span></p>
                            </div>
                            <div className="bg-teal-50/70 dark:bg-teal-900/20 p-5 rounded-2xl border border-teal-100 dark:border-teal-800 shadow-sm">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700 dark:text-teal-300">Penambahan Pundi</p>
                                <p className="text-3xl font-extrabold text-teal-900 dark:text-teal-100 mt-1">{nf(k.tambahTotal)}</p>
                                <p className="text-[10px] text-teal-600/70 dark:text-teal-300/70 mt-3">U:{k.tambah.u}<Sep />K:{k.tambah.k} <span className="opacity-70">(Jemput Bln Depan)</span></p>
                            </div>
                            <div className="bg-amber-50/80 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800 shadow-sm">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300">Pengurangan Pundi</p>
                                <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-200 mt-1">{nf(k.kurangTotal)}</p>
                                <p className="text-[10px] text-amber-600/70 dark:text-amber-300/70 mt-3">U:{k.kurang.u}<Sep />K:{k.kurang.k}</p>
                            </div>

                            <div className={cardCls + " grid grid-cols-2 gap-4"}>
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-wiz-green dark:text-emerald-400">Pundi Dijemput</p>
                                    <p className={bigCls}>{nf(k.dijemputTotal)}</p>
                                    <p className={subCls}>U:{k.dijemput.u}<Sep />K:{k.dijemput.k}</p>
                                </div>
                                <div className="border-l border-gray-100 dark:border-gray-700 pl-4">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-wiz-orange">Belum Dijemput</p>
                                    <p className="text-3xl font-extrabold text-wiz-orange mt-1">{nf(k.belumTotal)}</p>
                                    <p className={subCls}>U:{k.belum.u}<Sep />K:{k.belum.k}</p>
                                </div>
                            </div>
                            <div className={cardCls}>
                                <p className={labelCls}>Nominal Pundi</p>
                                <p className="text-2xl font-extrabold text-gray-700 dark:text-gray-100 mt-1">{rp(k.danaPundiTotal)}</p>
                                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase text-blue-600">Umum</p>
                                        <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{rp(k.danaPundi.u)}</p>
                                    </div>
                                    <div className="border-l border-gray-100 dark:border-gray-700 pl-3">
                                        <p className="text-[10px] font-extrabold uppercase text-purple-600">Khusus</p>
                                        <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{rp(k.danaPundi.k)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cardCls}>
                                <p className={labelCls}>Infaq &amp; Zakat</p>
                                <p className="text-2xl font-extrabold text-gray-700 dark:text-gray-100 mt-1">{rp(k.danaInsidental)}</p>
                            </div>
                            <div className="bg-wiz-green p-5 rounded-2xl shadow-md text-white">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-white/85">Total Nominal</p>
                                <p className="text-2xl sm:text-3xl font-extrabold mt-1">{rp(k.totalNominal)}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-5 sm:p-7 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h4 className="text-lg font-extrabold text-gray-700 dark:text-gray-100 pb-4 border-b border-gray-100 dark:border-gray-700">Rekapitulasi Capaian (Tahun {dashYear})</h4>
                            <div className="overflow-x-auto mt-5 border border-gray-100 dark:border-gray-700 rounded-xl">
                                <table className="w-full min-w-[860px] text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/40 text-[11px] font-extrabold uppercase text-gray-500 dark:text-gray-300">
                                            <th rowSpan={2} className="text-left px-5 py-3 border-r border-gray-100 dark:border-gray-700 w-40 sticky left-0 bg-gray-50 dark:bg-gray-900">Bulan</th>
                                            <th colSpan={3} className="px-3 py-3 border-r border-gray-100 dark:border-gray-700 border-b">Pundi / Muzakki Baru</th>
                                            <th colSpan={3} className="px-3 py-3 border-r border-gray-100 dark:border-gray-700 border-b">Donasi Diterima (Rp)</th>
                                            <th rowSpan={2} className="text-right px-5 py-3 whitespace-nowrap">Total Donasi (Rp)</th>
                                        </tr>
                                        <tr className="bg-gray-50 dark:bg-gray-900/40 text-[11px] font-extrabold uppercase border-b border-gray-100 dark:border-gray-700">
                                            <th className="px-3 py-2.5 text-blue-600">Umum</th>
                                            <th className="px-3 py-2.5 text-purple-600">Khusus</th>
                                            <th className="px-3 py-2.5 text-amber-600 border-r border-gray-100 dark:border-gray-700">Insidental</th>
                                            <th className="px-3 py-2.5 text-right text-blue-600">Umum</th>
                                            <th className="px-3 py-2.5 text-right text-purple-600">Khusus</th>
                                            <th className="px-3 py-2.5 text-right text-amber-600 border-r border-gray-100 dark:border-gray-700">Insidental</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {k.rows.map(r => (
                                            <tr key={r.month} className={"border-b border-gray-50 dark:border-gray-700/60 " + (dashMonth !== 'Semua' && Number(dashMonth) === r.month ? 'bg-wiz-green/5' : '')}>
                                                <td className="px-5 py-2.5 text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800">{monthNames[r.month]}</td>
                                                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{dash(r.baruU)}</td>
                                                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300">{dash(r.baruK)}</td>
                                                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{dash(r.baruI)}</td>
                                                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{dash(r.danaU)}</td>
                                                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{dash(r.danaK)}</td>
                                                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{dash(r.danaI)}</td>
                                                <td className="px-5 py-2.5 text-right font-extrabold text-gray-700 dark:text-gray-100">{dash(r.total)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 dark:bg-gray-900/40 font-extrabold text-gray-700 dark:text-gray-100">
                                            <td className="px-5 py-3 border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900">Total {dashYear}</td>
                                            <td className="px-3 py-3 text-center">{dash(k.totalRow.baruU)}</td>
                                            <td className="px-3 py-3 text-center">{dash(k.totalRow.baruK)}</td>
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-gray-700">{dash(k.totalRow.baruI)}</td>
                                            <td className="px-3 py-3 text-right">{dash(k.totalRow.danaU)}</td>
                                            <td className="px-3 py-3 text-right">{dash(k.totalRow.danaK)}</td>
                                            <td className="px-3 py-3 text-right border-r border-gray-100 dark:border-gray-700">{dash(k.totalRow.danaI)}</td>
                                            <td className="px-5 py-3 text-right">{dash(k.totalRow.total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-3">U = Pundi Umum, K/Khusus = Pundi Pribadi, I/Insidental = donasi berhasil di luar program pundi (Infaq &amp; Zakat).</p>
                        </div>
                    </div>
                );
            })()}

            {/* ========================================================================= */}
            {activeSubTab === 'dashboard' && (
                <div className="space-y-6 animate-in">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-1.5">
                                <i className="fa-solid fa-filter text-wiz-green"></i> Filter Periode Analitik Dashboard
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">Pilih bulan dan tahun untuk melihat capaian perolehan pundi.</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <select
                                value={dashMonth}
                                onChange={(e) => setDashMonth(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value))}
                                className="flex-1 sm:flex-none px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                            >
                                <option value="Semua">Semua Bulan</option>
                                {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                            </select>
                            <select
                                value={dashYear}
                                onChange={(e) => setDashYear(Number(e.target.value))}
                                className="flex-1 sm:flex-none px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Banner Utama Target Capaian */}
                    <div className="p-6 bg-gradient-to-r from-wiz-green_dark via-wiz-green to-teal-700 rounded-3xl text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase mb-2">
                                    <i className="fa-solid fa-bullseye"></i> Capaian Sedekah Pundi ({dashMonth === 'Semua' ? `Semua Bulan ${dashYear}` : `${monthNames[dashMonth]} ${dashYear}`})
                                </span>
                                <h3 className="text-3xl sm:text-4xl font-black">{formatRpLocal(stats.totalDanaBulanIni)}</h3>
                                <p className="text-white/80 text-xs sm:text-sm mt-1">
                                    Target Rencana: <b>{formatRpLocal(stats.totalTargetUang)}</b> (Akumulasi Pundi Umum & Pribadi)
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="bg-white/15 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-right">
                                    <p className="text-[10px] uppercase font-bold text-white/75">Ketercapaian</p>
                                    <p className="text-2xl sm:text-3xl font-black text-amber-300">{stats.percentTotalUang}%</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('target')}
                                    className="px-3.5 py-2.5 bg-white text-wiz-green_dark font-bold text-xs rounded-xl shadow hover:bg-gray-100 transition-all shrink-0 flex items-center gap-1.5"
                                >
                                    <i className="fa-solid fa-gear"></i> Atur Target
                                </button>
                            </div>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-2.5 mt-5 overflow-hidden">
                            <div className="bg-amber-300 h-2.5 rounded-full transition-all duration-1000 shadow-md" style={{ width: `${stats.percentTotalUang}%` }}></div>
                        </div>
                    </div>

                    {/* Section 1: Kuantitas Kotak Pundi & Target Distribusi */}
                    <div>
                        <h4 className="text-xs sm:text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-boxes-stacked text-wiz-green"></i> 1. Kuantitas Kotak Pundi & Target Distribusi
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-wiz-green to-wiz-green_dark p-5 rounded-3xl text-white shadow-md flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <p className="text-[11px] font-bold opacity-80 uppercase">Total Pundi (Kolektif)</p>
                                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black">{stats.percentTotalKotak}%</span>
                                    </div>
                                    <h3 className="text-3xl font-black mt-1">{stats.totalAktif} <span className="text-sm font-normal opacity-80">Kotak</span></h3>
                                    <p className="text-xs text-white/80 mt-0.5">Target: <b>{stats.totalTargetKotak} Kotak</b></p>
                                </div>
                                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden mt-4">
                                    <div className="bg-white h-1.5 rounded-full" style={{ width: `${stats.percentTotalKotak}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-black uppercase">Pundi Umum (Toko)</span>
                                        <span className="text-xs font-black text-blue-600">{stats.percentKotakUmum}%</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-800 dark:text-gray-100 mt-2">{stats.totalUmum} <span className="text-sm font-normal text-gray-400">Kotak</span></h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Target: <b>{stats.targetKotakUmum} Kotak</b></p>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mt-4">
                                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${stats.percentKotakUmum}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span className="px-2.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-black uppercase">Pundi Pribadi (Rumah)</span>
                                        <span className="text-xs font-black text-purple-600">{stats.percentKotakPribadi}%</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-800 dark:text-gray-100 mt-2">{stats.totalPribadi} <span className="text-sm font-normal text-gray-400">Kotak</span></h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Target: <b>{stats.targetKotakPribadi} Kotak</b></p>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mt-4">
                                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${stats.percentKotakPribadi}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Rincian Capaian Hasil Uang (Rp) */}
                    <div>
                        <h4 className="text-xs sm:text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-hand-holding-dollar text-wiz-orange"></i> 2. Rincian Capaian Hasil Uang (Rp) & Target
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-blue-100 dark:border-blue-900 shadow-sm space-y-3">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-bold text-sm text-gray-800 dark:text-gray-100">Hasil Uang Pundi Umum</h5>
                                    <span className="text-sm font-black text-blue-600">{stats.percentUangUmum}%</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Terkumpul:</span>
                                    <span className="font-black text-blue-600 text-base">{formatRpLocal(stats.danaUmum)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Target Uang:</span>
                                    <span className="font-bold">{formatRpLocal(stats.targetUangUmum)}</span>
                                </div>
                                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${stats.percentUangUmum}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-purple-100 dark:border-purple-900 shadow-sm space-y-3">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-bold text-sm text-gray-800 dark:text-gray-100">Hasil Uang Pundi Pribadi</h5>
                                    <span className="text-sm font-black text-purple-600">{stats.percentUangPribadi}%</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Terkumpul:</span>
                                    <span className="font-black text-purple-600 text-base">{formatRpLocal(stats.danaPribadi)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Target Uang:</span>
                                    <span className="font-bold">{formatRpLocal(stats.targetUangPribadi)}</span>
                                </div>
                                <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${stats.percentUangPribadi}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB TAB: MENU TARGET & AMIL                                              */}
            {/* ========================================================================= */}
            {activeSubTab === 'target' && (
                <div className="space-y-6 animate-in">
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="font-black text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                                <i className="fa-solid fa-bullseye text-wiz-green"></i> Manajemen Target Pundi & Amil
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Kontrol target perolehan uang dan rekrutmen kotak pundi baru berdasarkan zona wilayah.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* Filter Bulan Default Bulan Sekarang */}
                            <select
                                value={targetFilterMonth}
                                onChange={(e) => setTargetFilterMonth(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value))}
                                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                            >
                                <option value="Semua">Semua Bulan</option>
                                {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                            </select>

                            <select
                                value={targetFilterYear}
                                onChange={(e) => setTargetFilterYear(Number(e.target.value))}
                                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>

                            {/* Filter Zona Wilayah */}
                            <select
                                value={targetFilterZona}
                                onChange={(e) => setTargetFilterZona(e.target.value)}
                                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                            >
                                <option value="Semua">Semua Zona</option>
                                {allZonaOptions.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>

                            <button
                                type="button"
                                onClick={() => { setEditingTarget(null); setIsTargetModalOpen(true); }}
                                className="px-4 py-2 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                                <i className="fa-solid fa-plus-circle"></i> + Tetapkan Target Baru
                            </button>
                        </div>
                    </div>

                    {/* Ringkasan Akumulatif Target */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-6 bg-gradient-to-br from-wiz-green_dark to-wiz-green rounded-3xl text-white shadow-xl relative overflow-hidden">
                            <p className="text-xs font-bold uppercase opacity-80">Total Capaian Hasil Uang ({targetFilterMonth === 'Semua' ? `Tahun ${targetFilterYear}` : `${monthNames[targetFilterMonth]} ${targetFilterYear}`})</p>
                            <h3 className="text-3xl font-black mt-1">{formatRpLocal(sumTotalRealisasiUang)}</h3>
                            <p className="text-xs text-white/80 mt-0.5">Target: {formatRpLocal(sumTotalTargetUang)} ({sumPercentTotalUang}%)</p>
                            <div className="w-full bg-black/20 rounded-full h-2 mt-4 overflow-hidden">
                                <div className="bg-amber-300 h-2 rounded-full" style={{ width: `${sumPercentTotalUang}%` }}></div>
                            </div>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-wiz-orange_dark via-wiz-orange to-amber-500 rounded-3xl text-white shadow-xl relative overflow-hidden">
                            <p className="text-xs font-bold uppercase opacity-80">Penambahan Kotak Baru</p>
                            <h3 className="text-3xl font-black mt-1">{sumTotalRealisasiKotak} Kotak</h3>
                            <p className="text-xs text-white/80 mt-0.5">Target Kotak Baru: {sumTotalTargetKotak} Kotak ({sumPercentTotalKotak}%)</p>
                            <div className="w-full bg-black/20 rounded-full h-2 mt-4 overflow-hidden">
                                <div className="bg-white h-2 rounded-full" style={{ width: `${sumPercentTotalKotak}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Daftar Target Tiap Amil */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredEvaluatedTargets.map(tgt => (
                            <div key={tgt.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{tgt.amilName}</h4>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                <i className="fa-solid fa-location-dot mr-1"></i>{tgt.zona || 'Semua Zona'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-1">{tgt.bulan === 'Semua' ? `Tahun ${tgt.tahun}` : `${monthNames[tgt.bulan]} ${tgt.tahun}`} • {tgt.catatan || 'Penugasan'}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => { setEditingTarget(tgt); setIsTargetModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg text-xs" title="Edit Target"><i className="fa-solid fa-pen"></i></button>
                                        <button onClick={() => requestDeleteTarget(tgt)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs" title="Hapus Target"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                                        <p className="text-[10px] text-gray-400 uppercase">Uang Umum</p>
                                        <p className="font-bold text-blue-600">{formatRpLocal(tgt.realisasiUangUmum)}</p>
                                        <p className="text-[10px] text-gray-400">Target: {formatRpLocal(tgt.targetUangUmum)}</p>
                                    </div>
                                    <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
                                        <p className="text-[10px] text-gray-400 uppercase">Uang Pribadi</p>
                                        <p className="font-bold text-purple-600">{formatRpLocal(tgt.realisasiUangPribadi)}</p>
                                        <p className="text-[10px] text-gray-400">Target: {formatRpLocal(tgt.targetUangPribadi)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB TAB: TUGAS PENARIKAN (CHECKLIST & NOTA DENGAN SCROLL TABEL STABIL)   */}
            {/* ========================================================================= */}
            {activeSubTab === 'tugas' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 sm:p-6 space-y-4 animate-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">Antrean Penarikan Pundi Bulan Ini</h3>
                            <p className="text-xs text-gray-400">
                                {selectedTaskIds.size > 0 ? (
                                    <span className="text-wiz-green font-bold bg-wiz-green/10 px-2 py-0.5 rounded">{selectedTaskIds.size} Pundi Dipilih</span>
                                ) : (
                                    <span>Tersedia {filteredTugasPundis.length} kotak siap cetak/jemput.</span>
                                )}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={toggleSelectAllFiltered}
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold"
                            >
                                <i className={`fa-solid ${filteredTugasPundis.length > 0 && filteredTugasPundis.every(p => selectedTaskIds.has(p.id)) ? 'fa-square-check text-wiz-green' : 'fa-square'} mr-1`}></i>
                                {filteredTugasPundis.length > 0 && filteredTugasPundis.every(p => selectedTaskIds.has(p.id)) ? 'Batal Pilih' : 'Pilih Semua'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsQuickScanOpen(true)}
                                className="px-3 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm"
                            >
                                <i className="fa-solid fa-qrcode mr-1"></i> Pindai QR
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintChecklist}
                                disabled={filteredTugasPundis.length === 0}
                                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50"
                            >
                                <i className="fa-solid fa-clipboard-check mr-1"></i> Cetak Checklist ({selectedTaskIds.size > 0 ? selectedTaskIds.size : filteredTugasPundis.length})
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintNotaA4}
                                disabled={filteredTugasPundis.length === 0}
                                className="px-3 py-2 bg-wiz-green text-white rounded-xl text-xs font-bold shadow-sm"
                            >
                                <i className="fa-solid fa-receipt mr-1"></i> Cetak Nota ({selectedTaskIds.size > 0 ? selectedTaskIds.size : filteredTugasPundis.length})
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar Tugas */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-2xl flex flex-wrap gap-2.5 items-center justify-between">
                        <div className="relative flex-1 min-w-[180px]">
                            <input
                                type="text"
                                value={searchTugas}
                                onChange={(e) => setSearchTugas(e.target.value)}
                                placeholder="Cari nomor, toko, donatur..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-xs"
                            />
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-gray-400 text-xs"></i>
                        </div>

                        <select
                            value={zonaTugasFilter}
                            onChange={(e) => setZonaTugasFilter(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 rounded-xl text-xs font-bold"
                        >
                            <option value="Semua">Semua Zona</option>
                            {allZonaOptions.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>

                        <select
                            value={tipeTugasFilter}
                            onChange={(e) => setTipeTugasFilter(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 rounded-xl text-xs font-bold"
                        >
                            <option value="Semua">Semua Tipe</option>
                            <option value="Pundi Umum">Pundi Umum</option>
                            <option value="Pundi Pribadi">Pundi Pribadi</option>
                        </select>

                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-bold">
                            <span className="text-gray-400">Urut:</span>
                            <input type="number" placeholder="Awal" value={urutAwal} onChange={(e) => setUrutAwal(e.target.value)} className="w-12 text-center bg-gray-50 dark:bg-gray-700 rounded py-0.5" />
                            <span className="text-gray-400">-</span>
                            <input type="number" placeholder="Akhir" value={urutAkhir} onChange={(e) => setUrutAkhir(e.target.value)} className="w-12 text-center bg-gray-50 dark:bg-gray-700 rounded py-0.5" />
                        </div>

                        <div className="flex rounded-xl bg-white dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-600">
                            {['Semua', 'Belum', 'Dijemput', 'Sudah Ditarik'].map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setStatusTugasFilter(st)}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold ${statusTugasFilter === st ? 'bg-wiz-green text-white' : 'text-gray-500'}`}
                                >
                                    {st === 'Sudah Ditarik' ? 'Selesai' : st}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SCROLLBAR HORIZONTAL ATAS & KONTROL GESER KIRI-KANAN (ANTI TERTUTUP MENU BAWAH) */}
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col gap-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300 px-1">
                            <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-arrows-left-right text-wiz-green text-sm"></i>
                                <span>Scroll Samping (Geser Kolom Tabel di Sini)</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(tugasTableContainerRef, -220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kiri"
                                >
                                    <i className="fa-solid fa-chevron-left"></i> Kiri
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(tugasTableContainerRef, 220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kanan"
                                >
                                    Kanan <i className="fa-solid fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        {/* Bar Track Scroll Samping Atas */}
                        <div
                            ref={tugasTopScrollRef}
                            onScroll={() => syncScroll(tugasTopScrollRef, tugasTableContainerRef)}
                            className="overflow-x-auto overflow-y-hidden h-3.5 bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-700 custom-scrollbar shadow-inner cursor-pointer"
                        >
                            <div className="min-w-[850px] sm:min-w-[950px] h-1"></div>
                        </div>
                    </div>

                    {/* TABEL ANTREAN TUGAS DENGAN SCROLL HORIZONTAL DAN VERTIKAL STABIL */}
                    <div 
                        ref={tugasTableContainerRef}
                        onScroll={() => syncScroll(tugasTableContainerRef, tugasTopScrollRef)}
                        className="overflow-x-auto overflow-y-auto max-h-[55vh] sm:max-h-[62vh] rounded-2xl border border-gray-100 dark:border-gray-700 custom-scrollbar shadow-inner pb-6"
                    >
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[760px]">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-center w-10 bg-gray-50 dark:bg-gray-700">Pilih</th>
                                    <th className="px-4 py-3 text-center w-12 bg-gray-50 dark:bg-gray-700">Urut</th>
                                    <th className="px-4 py-3 bg-gray-50 dark:bg-gray-700">Nama Usaha / Lokasi</th>
                                    <th className="px-4 py-3 bg-gray-50 dark:bg-gray-700">Donatur & Alamat</th>
                                    <th className="px-4 py-3 bg-gray-50 dark:bg-gray-700">Status ({monthNames[currentMonth]})</th>
                                    <th className="px-4 py-3 text-center bg-gray-50 dark:bg-gray-700">Aksi Laporan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredTugasPundis.map(p => {
                                    const rec = visibleRiwayatPundis.find(r => (String(r.pundiId) === String(p.id || p.ID) || String(r.noUrut) === String(p.noUrut)) && new Date(r.date || r.Tanggal).getMonth() === currentMonth && new Date(r.date || r.Tanggal).getFullYear() === currentYear);
                                    const tStatus = rec ? rec.status : 'Belum';
                                    const isChecked = selectedTaskIds.has(p.id);

                                    return (
                                        <tr key={p.id || p.ID} className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isChecked ? 'bg-emerald-50/40' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSelectTask(p.id || p.ID)}
                                                    className="w-4 h-4 text-wiz-green accent-wiz-green cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center font-black">#{p.noUrut}</td>
                                            <td className="px-4 py-3 font-bold">
                                                {p.usaha}
                                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 font-semibold">{p.tipePundi || 'Pundi Umum'}</span>
                                                {p.zona && <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700">{p.zona}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">
                                                {p.donorName} • {p.alamat || '-'}
                                                {p.mapUrl && (() => {
                                                    const mapUrls = parseMapUrlsLocal(p.mapUrl);
                                                    return (
                                                        <span className="ml-2 inline-flex items-center gap-1 font-bold">
                                                            <a href={mapUrls.navUrl} target="_blank" rel="noreferrer" className="text-wiz-green"><i className="fa-solid fa-mobile-screen"></i> HP</a>
                                                            <span className="text-gray-300">|</span>
                                                            <a href={mapUrls.webUrl} target="_blank" rel="noreferrer" className="text-blue-500"><i className="fa-solid fa-globe"></i> Web</a>
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                    tStatus === 'Berhasil' ? 'bg-emerald-100 text-emerald-800' :
                                                    tStatus === 'Dijemput' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {tStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {tStatus === 'Berhasil' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openPenarikanModal(p, 'Berhasil')}
                                                        className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square mr-1"></i> Edit Hasil
                                                    </button>
                                                ) : tStatus === 'Dijemput' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openPenarikanModal(p, 'Berhasil')}
                                                        className="px-2.5 py-1 bg-wiz-green text-white rounded-lg font-bold hover:bg-wiz-green_dark shadow-sm"
                                                    >
                                                        <i className="fa-solid fa-calculator mr-1"></i> Hitung Uang
                                                    </button>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsQuickScanOpen(true)}
                                                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold"
                                                        >
                                                            <i className="fa-solid fa-qrcode"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openPenarikanModal(p, 'Berhasil')}
                                                            className="px-2.5 py-1 bg-wiz-orange text-white rounded-lg font-bold shadow-sm hover:bg-amber-600"
                                                        >
                                                            Jemput Manual
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB TAB: DATA MASTER PUNDI                                               */}
            {/* ========================================================================= */}
            {activeSubTab === 'master' && (
                <div className="space-y-4 animate-in">
                    {renderGpsHelperBanner(false)}

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchMaster}
                                    onChange={(e) => setSearchMaster(e.target.value)}
                                    placeholder="Cari nomor urut, donatur, usaha, alamat, no. HP..."
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-semibold"
                                />
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-xs"></i>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMasterSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                                >
                                    <i className={`fa-solid ${masterSortOrder === 'asc' ? 'fa-arrow-down-1-9' : 'fa-arrow-up-9-1'} text-wiz-green mr-1`}></i> Urutkan
                                </button>
                                <select
                                    value={zonaMasterFilter}
                                    onChange={(e) => setZonaMasterFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Zona</option>
                                    {allZonaOptions.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                                <select
                                    value={tipeMasterFilter}
                                    onChange={(e) => setTipeMasterFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Tipe</option>
                                    <option value="Pundi Umum">Pundi Umum</option>
                                    <option value="Pundi Pribadi">Pundi Pribadi</option>
                                </select>
                                <select
                                    value={statusMasterFilter}
                                    onChange={(e) => setStatusMasterFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Status</option>
                                    <option value="Aktif">Aktif</option>
                                    <option value="Ditarik">Ditarik</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SCROLLBAR HORIZONTAL ATAS & KONTROL GESER KIRI-KANAN MASTER PUNDI */}
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col gap-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300 px-1">
                            <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-arrows-left-right text-wiz-green text-sm"></i>
                                <span>Scroll Samping Master Pundi (Geser Kolom Tabel di Sini)</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(masterTableContainerRef, -220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kiri"
                                >
                                    <i className="fa-solid fa-chevron-left"></i> Kiri
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(masterTableContainerRef, 220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kanan"
                                >
                                    Kanan <i className="fa-solid fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        {/* Bar Track Scroll Samping Atas */}
                        <div
                            ref={masterTopScrollRef}
                            onScroll={() => syncScroll(masterTopScrollRef, masterTableContainerRef)}
                            className="overflow-x-auto overflow-y-hidden h-3.5 bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-700 custom-scrollbar shadow-inner cursor-pointer"
                        >
                            <div className="min-w-[850px] sm:min-w-[1000px] h-1"></div>
                        </div>
                    </div>

                    <div 
                        ref={masterTableContainerRef}
                        onScroll={() => syncScroll(masterTableContainerRef, masterTopScrollRef)}
                        className="overflow-x-auto overflow-y-auto max-h-[65vh] rounded-2xl border border-gray-100 dark:border-gray-700 custom-scrollbar shadow-inner pb-6"
                    >
                        {typeof window.ModuleView !== 'undefined' ? (
                            <window.ModuleView
                                title="Data Master Kotak Pundi"
                                data={filteredMasterPundis}
                                columns={MasterPundiColumns}
                                schema={MasterPundiSchema}
                                defaultValues={{ noUrut: nextNoUrut, status: 'Aktif', tipePundi: 'Pundi Umum', zona: 'SEKITAR TANJUNG' }}
                                modalTopContent={renderGpsHelperBanner(true)}
                                onSave={savePundi}
                                onImport={importPundi}
                                importSchema={MasterPundiImportSchema}
                                makeImportRowCheck={makeMasterRowCheck}
                                onDelete={isAdmin ? requestDeletePundi : null}
                                canDelete={isAdmin}
                            />
                        ) : null}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB TAB: RIWAYAT SEDEKAH PUNDI                                           */}
            {/* ========================================================================= */}
            {activeSubTab === 'riwayat' && (
                <div className="space-y-4 animate-in">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                        {typeof window.CsvImportBar !== 'undefined' && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400"><i className="fa-solid fa-file-import mr-1"></i>Impor riwayat dari Google Sheet:</span>
                                <window.CsvImportBar schema={RiwayatImportSchema} defaultValues={{ status: 'Berhasil' }} onImport={importRiwayat} makeRowCheck={makeRiwayatRowCheck} templateRows={riwayatTemplateRows} title="Riwayat Sedekah Pundi" />
                                <button onClick={downloadDaftarIdPundi} className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"><i className="fa-solid fa-list-ol mr-1.5"></i>Daftar ID Pundi</button>
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchRiwayat}
                                    onChange={(e) => setSearchRiwayat(e.target.value)}
                                    placeholder="Cari donatur, usaha, nomor pundi, amil..."
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-semibold"
                                />
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-xs"></i>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={monthRiwayatFilter}
                                    onChange={(e) => setMonthRiwayatFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Bulan</option>
                                    {uniqueMonths.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                </select>

                                {/* Filter Tipe Pundi: Pundi Umum dan Pundi Pribadi */}
                                <select
                                    value={tipeRiwayatFilter}
                                    onChange={(e) => setTipeRiwayatFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Tipe Pundi</option>
                                    <option value="Pundi Umum">Pundi Umum (Toko/Usaha)</option>
                                    <option value="Pundi Pribadi">Pundi Pribadi (Rumah)</option>
                                </select>

                                <select
                                    value={statusRiwayatFilter}
                                    onChange={(e) => setStatusRiwayatFilter(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Status</option>
                                    <option value="Berhasil">Berhasil (Dihitung)</option>
                                    <option value="Dijemput">Dijemput (Belum)</option>
                                    <option value="Gagal">Gagal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SCROLLBAR HORIZONTAL ATAS UNTUK RIWAYAT */}
                    <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col gap-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300 px-1">
                            <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-arrows-left-right text-wiz-green text-sm"></i>
                                <span>Scroll Samping Riwayat (Geser Kiri - Kanan di Sini)</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(riwayatTableContainerRef, -220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kiri"
                                >
                                    <i className="fa-solid fa-chevron-left"></i> Kiri
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollTableHorizontally(riwayatTableContainerRef, 220)}
                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                    title="Geser ke Kanan"
                                >
                                    Kanan <i className="fa-solid fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        <div
                            ref={riwayatTopScrollRef}
                            onScroll={() => syncScroll(riwayatTopScrollRef, riwayatTableContainerRef)}
                            className="overflow-x-auto overflow-y-hidden h-3.5 bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-700 custom-scrollbar shadow-inner cursor-pointer"
                        >
                            <div className="min-w-[850px] sm:min-w-[950px] h-1"></div>
                        </div>
                    </div>

                    <div 
                        ref={riwayatTableContainerRef}
                        onScroll={() => syncScroll(riwayatTableContainerRef, riwayatTopScrollRef)}
                        className="overflow-x-auto overflow-y-auto max-h-[58vh] rounded-2xl border border-gray-100 dark:border-gray-700 custom-scrollbar shadow-inner pb-6"
                    >
                        {typeof window.Table !== 'undefined' ? (
                            <window.Table
                                columns={[
                                    { key: 'date', label: 'Tanggal', render: r => formatDateLocal(r.date || r.Tanggal) },
                                    { key: 'donorName', label: 'Donatur & Usaha', render: r => (
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-gray-800 dark:text-gray-100">{r.donorName}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${r.tipePundi === 'Pundi Pribadi' ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'}`}>
                                                    {r.tipePundi || 'Pundi Umum'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400">{r.usaha} (#{r.noUrut})</p>
                                        </div>
                                    )},
                                    { key: 'amount', label: 'Nominal', render: r => <span className="font-black text-wiz-green dark:text-emerald-400">{formatRpLocal(r.amount || r.Nominal)}</span> },
                                    { key: 'status', label: 'Status', render: r => (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                            r.status === 'Berhasil' ? 'bg-emerald-100 text-emerald-800' :
                                            r.status === 'Dijemput' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {r.status}
                                        </span>
                                    ) },
                                    { key: 'amilName', label: 'Amil Petugas' },
                                    { key: 'receiptUrl', label: 'Bukti Nota', render: r => {
                                        if (!r.receiptUrl || String(r.receiptUrl).trim() === '') {
                                            return (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                    <i className="fa-solid fa-image-slash text-[9px]"></i> Tanpa Nota
                                                </span>
                                            );
                                        }

                                        const notaData = {
                                            url: r.receiptUrl,
                                            pundiNo: r.noUrut || '-',
                                            usaha: r.usaha || '-',
                                            donorName: r.donorName || '-',
                                            amount: r.amount || r.Nominal || 0,
                                            date: r.date || r.Tanggal,
                                            amilName: r.amilName || '-'
                                        };

                                        return (
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    onClick={() => setPreviewNota(notaData)}
                                                    className="group relative w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-500/30 hover:border-emerald-500 cursor-pointer shadow-sm hover:shadow-md transition-all shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                                    title="Klik untuk melihat foto nota ukuran besar"
                                                >
                                                    <img
                                                        src={r.receiptUrl}
                                                        alt="Nota"
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div style={{ display: 'none' }} className="w-full h-full items-center justify-center text-gray-400 text-xs">
                                                        <i className="fa-solid fa-receipt"></i>
                                                    </div>
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px]">
                                                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewNota(notaData)}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1 shadow-xs"
                                                    title="Lihat rincian foto nota"
                                                >
                                                    <i className="fa-solid fa-eye text-[9px]"></i>
                                                    <span>Lihat</span>
                                                </button>
                                            </div>
                                        );
                                    }},
                                    { key: 'notes', label: 'Catatan' }
                                ]}
                                data={[...filteredRiwayatPundis].sort((a,b) => new Date(b.date || b.Tanggal) - new Date(a.date || a.Tanggal))}
                                onEdit={handleOpenEditRiwayat}
                                onDelete={isAdmin ? requestDeleteRiwayat : null}
                            />
                        ) : null}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL KONFIRMASI PERINGATAN HAPUS DATA                                   */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={!!deletePrompt}
                    onClose={() => setDeletePrompt(null)}
                    title="Konfirmasi Penghapusan"
                >
                    {deletePrompt && (
                        <div className="p-2 sm:p-4 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 text-red-500 flex items-center justify-center text-3xl shadow-inner relative">
                                <div className="absolute inset-0 bg-red-400 opacity-20 rounded-full animate-ping"></div>
                                <i className="fa-solid fa-trash-can relative z-10"></i>
                            </div>

                            <div>
                                <h3 className="text-base font-black text-gray-800 dark:text-gray-100 mb-1.5">
                                    {deletePrompt.title}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                                    {deletePrompt.message}
                                </p>
                            </div>

                            <div className="w-full p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-300 font-semibold flex items-center gap-2 text-left">
                                <i className="fa-solid fa-triangle-exclamation text-base shrink-0"></i>
                                <span>Tindakan ini tidak dapat dibatalkan dan data akan langsung disinkronkan ke Google Sheet.</span>
                            </div>

                            <div className="flex gap-2.5 w-full pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeletePrompt(null)}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    <span>Ya, Hapus Sekarang</span>
                                </button>
                            </div>
                        </div>
                    )}
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* POP-UP MODAL LAPORAN PENARIKAN (FOTO LANGSUNG KAMERA / GALERI + INPUT UANG) */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={isInputModalOpen}
                    onClose={() => { setIsInputModalOpen(false); setSelectedPundi(null); }}
                    title={selectedPundi ? `Laporan Penarikan: ${selectedPundi.usaha}` : 'Laporan Penarikan Pundi'}
                >
                    {selectedPundi && (() => {
                        const isAlreadySubmittedThisMonth = (riwayatPundis || []).some(r => {
                            const matchPundi = (String(r.pundiId) === String(selectedPundi.id || selectedPundi.ID)) || (String(r.noUrut) === String(selectedPundi.noUrut));
                            if (!matchPundi) return false;
                            const tgl = r.date || r.Tanggal;
                            if (!tgl) return false;
                            const d = new Date(tgl);
                            // Cek di bulan ini apa pun statusnya, jika ada berarti mode edit
                            return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                        });

                        return (
                        <form onSubmit={handleSaveLaporanPenarikan} className="space-y-4">
                            <div className="p-3 bg-wiz-green/10 rounded-2xl flex items-center justify-between border border-wiz-green/20">
                                <div>
                                    <p className="text-xs font-black text-wiz-green dark:text-emerald-400">
                                        Kotak Pundi #{selectedPundi.noUrut} • {selectedPundi.usaha}
                                    </p>
                                    <p className="text-[11px] text-gray-500">{selectedPundi.donorName} ({selectedPundi.tipePundi || 'Pundi Umum'})</p>
                                </div>
                                <span className="px-2 py-1 rounded bg-white dark:bg-gray-800 text-[10px] font-bold text-wiz-green">
                                    ID: {selectedPundi.id || selectedPundi.ID}
                                </span>
                            </div>

                            {isAlreadySubmittedThisMonth && (
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                    <i className="fa-solid fa-circle-info text-sm shrink-0"></i>
                                    <span>Pundi ini sudah diinput pada bulan ini. Menyimpan formulir ini akan <b>memperbarui (mengedit)</b> data yang ada tanpa membuat data duplikat.</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">
                                        Tanggal Penarikan <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={modalFormDate}
                                        onChange={(e) => setModalFormDate(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">
                                        Hasil Kunjungan <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={modalFormStatus}
                                        onChange={(e) => setModalFormStatus(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold outline-none"
                                    >
                                        <option value="Berhasil">Berhasil (Selesai Dihitung)</option>
                                        <option value="Dijemput">Kotak Dijemput (Hitung Nanti)</option>
                                        <option value="Gagal">Gagal / Pundi Kosong</option>
                                    </select>
                                </div>
                            </div>

                            {/* Kolom Input Nominal Uang Lancar */}
                            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase">
                                        Nominal Uang (Rp)
                                    </label>
                                    <span className="text-[11px] font-mono text-gray-400">
                                        Rp {Number(String(modalFormAmount).replace(/\D/g, '') || 0).toLocaleString('id-ID')}
                                    </span>
                                </div>

                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-black text-gray-400 pointer-events-none">
                                        Rp
                                    </span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={modalFormAmount === '0' ? '0' : (modalFormAmount ? Number(String(modalFormAmount).replace(/\D/g, '')).toLocaleString('id-ID') : '')}
                                        onChange={(e) => {
                                            const clean = e.target.value.replace(/\D/g, '');
                                            setModalFormAmount(clean);
                                            // Otomatis beralih ke Berhasil saat nominal diinput/diketik
                                            if (clean !== '') {
                                                setModalFormStatus('Berhasil');
                                            }
                                        }}
                                        placeholder="0"
                                        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl text-base font-black text-emerald-700 dark:text-emerald-300 outline-none font-mono"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-1 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalFormAmount('0');
                                            setModalFormStatus('Berhasil');
                                        }}
                                        className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold shadow-xs hover:bg-emerald-50"
                                    >
                                        Rp 0
                                    </button>
                                    {[50000, 100000, 200000, 250000, 500000, 1000000].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => {
                                                setModalFormAmount(String(val));
                                                setModalFormStatus('Berhasil');
                                            }}
                                            className="px-2 py-1 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold shadow-xs hover:bg-emerald-50"
                                        >
                                            +{val >= 1000000 ? `${val/1000000}jt` : `${val/1000}rb`}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setModalFormAmount('')}
                                        className="px-2 py-1 bg-red-50 text-red-500 rounded text-[10px] font-bold ml-auto"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>

                            <div className="p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 space-y-2.5">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                                    Foto Bukti Nota / Penarikan
                                </label>

                                {modalFormReceiptUrl ? (
                                    <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                        <img
                                            src={modalFormReceiptUrl}
                                            alt="Pratinjau Bukti Nota"
                                            className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0 shadow-sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <i className="fa-solid fa-circle-check"></i> Foto Nota Siap Disimpan
                                            </p>
                                            <p className="text-[10px] text-gray-400 truncate mt-0.5">Ukuran foto terkompresi otomatis & aman</p>
                                            <button
                                                type="button"
                                                onClick={() => setModalFormReceiptUrl('')}
                                                className="text-[11px] text-red-500 hover:text-red-700 font-bold mt-1 flex items-center gap-1"
                                            >
                                                <i className="fa-solid fa-trash-can"></i> Hapus / Ambil Ulang Foto
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => cameraInputRef.current?.click()}
                                            disabled={isProcessingPhoto}
                                            className="py-2.5 px-3 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                                        >
                                            <i className={`fa-solid ${isProcessingPhoto ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
                                            <span>{isProcessingPhoto ? 'Memproses...' : 'Foto Kamera Langsung'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isProcessingPhoto}
                                            className="py-2.5 px-3 bg-white dark:bg-gray-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                                        >
                                            <i className="fa-solid fa-image text-blue-500"></i>
                                            <span>Unggah dari Galeri</span>
                                        </button>
                                    </div>
                                )}

                                <input
                                    type="text"
                                    value={modalFormReceiptUrl && modalFormReceiptUrl.startsWith('data:') ? '' : modalFormReceiptUrl}
                                    onChange={(e) => setModalFormReceiptUrl(e.target.value)}
                                    placeholder={modalFormReceiptUrl && modalFormReceiptUrl.startsWith('data:') ? 'Foto telah terlampir via kamera/berkas' : 'Atau tempel link URL foto Google Drive...'}
                                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-[11px] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">
                                    Keterangan / Catatan (Opsional)
                                </label>
                                <textarea
                                    rows="2"
                                    value={modalFormNotes}
                                    onChange={(e) => setModalFormNotes(e.target.value)}
                                    placeholder="Tulis catatan penjemputan..."
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs"
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => { setIsInputModalOpen(false); setSelectedPundi(null); }}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
                                >
                                    Simpan Data
                                </button>
                            </div>
                        </form>
                        );
                    })()}
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* MODAL PENENTUAN TARGET AMIL                                              */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={isTargetModalOpen}
                    onClose={() => { setIsTargetModalOpen(false); setEditingTarget(null); }}
                    title={editingTarget ? "Edit Target Pundi Amil" : "Tetapkan Target Pundi Amil Baru"}
                >
                    <form onSubmit={handleSaveTarget} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">Target Untuk Amil</label>
                                <select 
                                    name="amilName" 
                                    required 
                                    defaultValue={editingTarget?.amilName || 'Semua Amil'}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua Amil">Semua Amil (Kolektif)</option>
                                    {uniqueAmils.map((name, i) => (
                                        <option key={i} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">Zona Wilayah</label>
                                <select 
                                    name="zona" 
                                    required 
                                    defaultValue={editingTarget?.zona || 'Semua Zona'}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua Zona">Semua Zona Wilayah</option>
                                    {allZonaOptions.map((z, idx) => (
                                        <option key={idx} value={z}>{z}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">Tahun</label>
                                <select 
                                    name="tahun" 
                                    required 
                                    defaultValue={editingTarget?.tahun || new Date().getFullYear()}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                                >
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">Bulan</label>
                                <select 
                                    name="bulan" 
                                    required 
                                    defaultValue={editingTarget?.bulan !== undefined ? editingTarget.bulan : new Date().getMonth()}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold"
                                >
                                    <option value="Semua">Semua Bulan (Tahunan)</option>
                                    {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* 1. Target Hasil Uang */}
                        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2.5">
                            <h5 className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase flex items-center gap-1.5">
                                <i className="fa-solid fa-money-bill-wave"></i> 1. Target Hasil Uang (Rp)
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Target Pundi Umum (Rp)</label>
                                    <input 
                                        type="text" 
                                        name="targetUangUmum" 
                                        required 
                                        defaultValue={Number(editingTarget?.targetUangUmum || 0).toLocaleString('id-ID')}
                                        onInput={(e) => e.target.value = Number(e.target.value.replace(/\D/g, '')).toLocaleString('id-ID')}
                                        placeholder="0" 
                                        className="w-full p-2.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-xl text-xs font-bold text-blue-600 outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Target Pundi Pribadi (Rp)</label>
                                    <input 
                                        type="text" 
                                        name="targetUangPribadi" 
                                        required 
                                        defaultValue={Number(editingTarget?.targetUangPribadi || 0).toLocaleString('id-ID')}
                                        onInput={(e) => e.target.value = Number(e.target.value.replace(/\D/g, '')).toLocaleString('id-ID')}
                                        placeholder="0" 
                                        className="w-full p-2.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-xl text-xs font-bold text-purple-600 outline-none" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Target Penambahan Data Kotak Baru */}
                        <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2.5">
                            <h5 className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase flex items-center gap-1.5">
                                <i className="fa-solid fa-box-open"></i> 2. Target Penambahan Kotak Baru (Unit)
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Target Kotak Baru Umum</label>
                                    <input 
                                        type="number" 
                                        name="targetKotakUmum" 
                                        required 
                                        defaultValue={editingTarget?.targetKotakUmum || 0}
                                        placeholder="Jumlah kotak" 
                                        className="w-full p-2.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-100 outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">Target Kotak Baru Pribadi</label>
                                    <input 
                                        type="number" 
                                        name="targetKotakPribadi" 
                                        required 
                                        defaultValue={editingTarget?.targetKotakPribadi || 0}
                                        placeholder="Jumlah kotak" 
                                        className="w-full p-2.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-100 outline-none" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase">Catatan / Strategi Target</label>
                            <textarea 
                                name="catatan" 
                                rows="2" 
                                defaultValue={editingTarget?.catatan || ''}
                                placeholder="Contoh: Fokus penyebaran di area pertokoan Pasar Segah..."
                                className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-100 outline-none"
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => { setIsTargetModalOpen(false); setEditingTarget(null); }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl text-xs font-bold shadow-md active:scale-95"
                            >
                                Simpan Target
                            </button>
                        </div>
                    </form>
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* MODAL SCAN QR KAMERA                                                     */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={isQuickScanOpen}
                    onClose={() => setIsQuickScanOpen(false)}
                    title="Pindai QR Pundi (Kamera)"
                >
                    <div className="flex flex-col items-center justify-center p-2 space-y-3">
                        <p className="text-xs text-gray-500 text-center">
                            Arahkan kamera ke kode QR stiker pundi untuk langsung membuka formulir penarikan.
                        </p>
                        <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-inner bg-black">
                            {typeof window.Html5QrcodePlugin !== 'undefined' && (
                                <window.Html5QrcodePlugin qrCodeSuccessCallback={handleQuickScan} />
                            )}
                        </div>
                        <div className="w-full pt-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Atau Ketik Nomor Urut Manual</label>
                            <input
                                type="text"
                                onChange={(e) => handleQuickScan(e.target.value)}
                                placeholder="Contoh: 5"
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-sm"
                            />
                        </div>
                    </div>
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* MODAL EDIT RIWAYAT SEDEKAH                                               */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={isEditRiwayatOpen}
                    onClose={() => { setIsEditRiwayatOpen(false); setEditingRiwayat(null); }}
                    title={editingRiwayat ? `Edit Riwayat: ${editingRiwayat.usaha || ''}` : 'Edit Riwayat'}
                >
                    {editingRiwayat && (
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target;
                            saveEditRiwayat({
                                date: form.date.value,
                                status: form.status.value,
                                amount: form.amount.value,
                                receiptUrl: form.receiptUrl.value,
                                notes: form.notes.value
                            });
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label>
                                <input type="date" name="date" defaultValue={editingRiwayat.date || editingRiwayat.Tanggal} required className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                                <select name="status" defaultValue={editingRiwayat.status || 'Berhasil'} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold">
                                    <option value="Berhasil">Berhasil (Dihitung)</option>
                                    <option value="Dijemput">Dijemput (Belum Dihitung)</option>
                                    <option value="Gagal">Gagal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Nominal Uang (Rp)</label>
                                <input type="text" name="amount" defaultValue={editingRiwayat.amount || editingRiwayat.Nominal || 0} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Bukti Foto / Nota</label>
                                <input type="text" name="receiptUrl" defaultValue={editingRiwayat.receiptUrl || ''} placeholder="Link URL foto..." className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Catatan</label>
                                <textarea name="notes" defaultValue={editingRiwayat.notes || ''} rows="2" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"></textarea>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button type="button" onClick={() => { setIsEditRiwayatOpen(false); setEditingRiwayat(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">Batal</button>
                                <button type="submit" className="px-5 py-2 bg-wiz-green text-white rounded-xl text-xs font-bold shadow-md">Simpan Perubahan</button>
                            </div>
                        </form>
                    )}
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* MODAL CETAK STIKER QR PUNDI                                              */}
            {/* ========================================================================= */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal isOpen={!!printQR} onClose={() => setPrintQR(null)} title="Cetak Stiker Pundi">
                    {printQR && (
                        <div className="flex flex-col items-center space-y-6">
                            <div id="print-qr-area" className="w-72 bg-white border-2 border-wiz-green rounded-3xl p-6 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-wiz-orange"></div>
                                <h4 className="font-black text-gray-800 text-lg uppercase tracking-tight mb-1">{printQR.tipePundi === 'Pundi Pribadi' ? 'Pundi Pribadi' : 'Kotak Amal'}</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Wahdah Inspirasi Zakat</p>
                                
                                <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 mb-4">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=WIZ-PUNDI-${printQR.id || printQR.ID}&margin=0`} alt="QR Code Pundi" className="w-32 h-32" />
                                </div>
                                
                                <div className="bg-wiz-green/10 text-wiz-green_dark w-full py-2.5 rounded-xl mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70">Nomor Registrasi</p>
                                    <p className="text-3xl font-black">#{printQR.noUrut}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5 opacity-70">ID Pundi</p>
                                    <p className="text-[12px] font-black font-mono tracking-wide break-all px-2">{printQR.id || printQR.ID}</p>
                                </div>
                                <p className="font-bold text-gray-800 text-sm line-clamp-2 mt-2">{printQR.usaha}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{printQR.donorName} ({printQR.tipePundi || 'Pundi Umum'})</p>
                            </div>
                            
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    type="button"
                                    onClick={() => setPrintQR(null)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl"
                                >
                                    Tutup
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const printWindow = window.open('', '_blank');
                                        printWindow.document.write(`
                                            <html><head><title>Stiker QR Pundi - No ${printQR.noUrut} - ID ${printQR.id || printQR.ID}</title>
                                            <script src="https://cdn.tailwindcss.com"><\/script>
                                            </head><body class="flex items-center justify-center p-10 bg-white">
                                            ${document.getElementById('print-qr-area').outerHTML}
                                            <script>setTimeout(() => { window.print(); }, 1000);<\/script>
                                            </body></html>
                                        `);
                                        printWindow.document.close();
                                    }}
                                    className="flex-1 py-3 bg-wiz-green text-white font-bold text-xs rounded-xl shadow-md"
                                >
                                    <i className="fa-solid fa-print mr-1"></i> Cetak Stiker
                                </button>
                            </div>
                        </div>
                    )}
                </window.Modal>
            )}

            {/* ========================================================================= */}
            {/* MODAL PRATINJAU FOTO BUKTI NOTA (LIGHTBOX VIEWER)                        */}
            {/* ========================================================================= */}
            {/* MODAL PRATINJAU FOTO BUKTI NOTA (LIGHTBOX VIEWER ANTI-GEPENG)            */}
            {/* ========================================================================= */}
            {previewNota && (
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in"
                    onClick={() => setPreviewNota(null)}
                >
                    <div 
                        className="bg-white dark:bg-gray-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-white/20 dark:border-gray-700 slide-up flex flex-col max-h-[92vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
                            <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-xl bg-wiz-green text-white flex items-center justify-center text-xs shadow-sm">
                                    <i className="fa-solid fa-receipt"></i>
                                </span>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-100">
                                        Bukti Foto Nota Penarikan
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        Pundi #{previewNota.pundiNo} • {previewNota.usaha}
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setPreviewNota(null)}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-500 dark:text-gray-300 flex items-center justify-center text-sm transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Tampilan Foto Nota dengan Preservasi Rasio Asli */}
                        <div className="p-3 sm:p-4 bg-gray-950 flex items-center justify-center overflow-auto min-h-[260px] max-h-[58vh]">
                            <img 
                                src={previewNota.url} 
                                alt="Bukti Nota Pundi" 
                                className="h-auto max-h-[54vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-white/10"
                                style={{ aspectRatio: 'auto' }}
                            />
                        </div>

                        {/* Rincian Nota di Bawah */}
                        <div className="p-4 bg-white dark:bg-gray-800 space-y-3 border-t border-gray-100 dark:border-gray-700 text-xs">
                            <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div>
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Donatur / Titik</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-100 truncate block">{previewNota.donorName || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Nominal Terhitung</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 block">{formatRpLocal(previewNota.amount)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Tanggal Tarik</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300 block">{formatDateLocal(previewNota.date)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Petugas Amil</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300 block">{previewNota.amilName || '-'}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <a
                                    href={previewNota.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={`Nota_Pundi_${previewNota.pundiNo}_${previewNota.date}.jpg`}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Buka Penuh / Unduh
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreviewNota(null)}
                                    className="px-4 py-2 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.PundiView = PundiView;
}