// Komponen Pindai QR Pundi (Standalone Scanner)
// Dilengkapi Foto Kamera Langsung, Kompresi Nota Otomatis, Input Nominal Lancar, dan Safe Merge ke Google Sheet RiwayatPundi

const { useState, useRef } = React;

const formatRpLocal = (num) => {
    if (typeof window.formatRp === 'function') return window.formatRp(num);
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
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

                if (naturalW > maxDim || naturalH > maxDim) {
                    const ratio = Math.min(maxDim / naturalW, maxDim / naturalH);
                    targetWidth = Math.round(naturalW * ratio);
                    targetHeight = Math.round(naturalH * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                let dataUrl = canvas.toDataURL('image/jpeg', quality);
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

const ScannerView = ({ pundis = [], riwayatPundis = [], setRiwayatPundis, user, syncDataToSheet, setActiveTab }) => {
    const [scanInput, setScanInput] = useState('');
    const [selectedPundi, setSelectedPundi] = useState(null);
    const [isInputModalOpen, setIsInputModalOpen] = useState(false);

    // State Form Laporan Penarikan
    const [modalFormDate, setModalFormDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [modalFormStatus, setModalFormStatus] = useState('Berhasil');
    const [modalFormAmount, setModalFormAmount] = useState('');
    const [modalFormReceiptUrl, setModalFormReceiptUrl] = useState('');
    const [modalFormNotes, setModalFormNotes] = useState('');
    const [modalFormAmil, setModalFormAmil] = useState(user?.name || user?.Nama || 'Amil');
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
    const [saveSuccessNotice, setSaveSuccessNotice] = useState(null);

    // Ref Kamera dan File Picker
    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleScan = (val) => {
        const cleanVal = String(val || '').trim();
        if (!cleanVal) return;

        let found = null;
        // 1. Deteksi otomatis hasil scan stiker QR (WIZ-PUNDI-...)
        if (cleanVal.includes('WIZ-PUNDI-')) {
            const extractedId = cleanVal.split('WIZ-PUNDI-')[1].trim();
            found = pundis.find(p => String(p.id || p.ID) === String(extractedId));
        } 
        // 2. Deteksi input manual nomor urut
        else if (!isNaN(cleanVal) && cleanVal.length > 0) {
            found = pundis.find(p => String(p.noUrut) === cleanVal);
        }

        if (found) {
            setScanInput('');
            setSelectedPundi(found);
            
            // Cek apakah pundi ini sudah ada riwayat di bulan berjalan (apa pun statusnya: Belum, Dijemput, Berhasil, Gagal)
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const existing = (riwayatPundis || []).find(r => {
                const matchPundi = (String(r.pundiId) === String(found.id || found.ID)) || (String(r.noUrut) === String(found.noUrut));
                if (!matchPundi) return false;
                const tgl = r.date || r.Tanggal;
                if (!tgl) return false;
                const d = new Date(tgl);
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
                    setModalFormStatus(existing.status || existing.Status || 'Berhasil');
                }

                setModalFormAmount(existAmt);
                setModalFormReceiptUrl(existing.receiptUrl || '');
                setModalFormNotes(existing.notes || '');
                setModalFormAmil(existing.amilName || user?.name || user?.Nama || 'Amil');
            } else {
                setModalFormDate(new Date().toISOString().split('T')[0]);
                setModalFormStatus('Berhasil');
                setModalFormAmount('');
                setModalFormReceiptUrl('');
                setModalFormNotes('');
                setModalFormAmil(user?.name || user?.Nama || 'Amil');
            }

            setTimeout(() => setIsInputModalOpen(true), 350);
        } else if (cleanVal.length > 15) {
            setScanInput('❌ Pundi Tidak Ditemukan!');
            setTimeout(() => setScanInput(''), 2500);
        }
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
        } catch (err) {
            console.error("Gagal memproses foto:", err);
        } finally {
            setIsProcessingPhoto(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSaveLaporanPenarikan = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedPundi) return;

        const cleanDigits = String(modalFormAmount || '').replace(/\D/g, '');
        const numericAmount = cleanDigits ? Number(cleanDigits) : 0;
        const recordDate = modalFormDate || new Date().toISOString().split('T')[0];

        // Ambil data atribut pundi secara aman
        const pundiIdVal = String(selectedPundi.id || selectedPundi.ID || Date.now());
        const noUrutVal = selectedPundi.noUrut || selectedPundi.NoUrut || selectedPundi['No. Urut'] || '-';
        const donorNameVal = selectedPundi.donorName || selectedPundi['Nama Donatur'] || selectedPundi.Nama || selectedPundi.donatur || '-';
        const usahaVal = selectedPundi.usaha || selectedPundi['Nama Usaha'] || selectedPundi.Usaha || '-';
        const tipePundiVal = selectedPundi.tipePundi || selectedPundi['Tipe Pundi'] || selectedPundi.TipePundi || 'Pundi Umum';

        // 1. Ambil seluruh riwayat cache & state
        let cachedRiwayat = [];
        try {
            const raw = localStorage.getItem('wiz_cache_RiwayatPundi');
            if (raw) cachedRiwayat = JSON.parse(raw);
        } catch (err) {}

        const baseRiwayatMap = new Map();
        (Array.isArray(cachedRiwayat) ? cachedRiwayat : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });
        (Array.isArray(riwayatPundis) ? riwayatPundis : []).forEach(r => {
            if (r && (r.id || r.ID)) baseRiwayatMap.set(String(r.id || r.ID), r);
        });

        // 2. KUNCI ANTI-DUPLIKAT: Cek apakah ada record di bulan & tahun target apa pun statusnya
        const dObj = new Date(recordDate);
        const targetMonth = !isNaN(dObj.getTime()) ? dObj.getMonth() : new Date().getMonth();
        const targetYear = !isNaN(dObj.getTime()) ? dObj.getFullYear() : new Date().getFullYear();

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

        // Tentukan ID transaksi: gunakan ID lama jika sedang memperbarui pundi di bulan ini, atau ID baru
        const recordId = existingKeyToUpdate ? String(existingKeyToUpdate) : String(Date.now() + Math.floor(Math.random() * 1000));

        // Buat objek record lengkap dengan 16 kolom persis sesuai sheet RiwayatPundi
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
        try { localStorage.setItem('wiz_cache_RiwayatPundi', JSON.stringify(finalRiwayatList)); } catch (err) {}

        if (typeof syncDataToSheet === 'function') {
            syncDataToSheet('RiwayatPundi', finalRiwayatList);
        }

        setSaveSuccessNotice(existingKeyToUpdate 
            ? `✅ Data Pundi #${noUrutVal} bulan ini berhasil diperbarui (${formatRpLocal(numericAmount)})`
            : `✅ Berhasil menyimpan penarikan Pundi #${noUrutVal} (${formatRpLocal(numericAmount)})`
        );
        setTimeout(() => setSaveSuccessNotice(null), 5000);

        setIsInputModalOpen(false);
        setSelectedPundi(null);
        setModalFormReceiptUrl('');
        setModalFormAmount('');
        setModalFormNotes('');
    };

    return (
        <div className="space-y-6 slide-up h-full flex flex-col justify-center items-center py-4 sm:py-10 relative">
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

            {/* Notifikasi Toast Sukses */}
            {saveSuccessNotice && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in border border-emerald-400">
                    <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
                    <span className="text-xs font-bold">{saveSuccessNotice}</span>
                </div>
            )}

            {/* Kartu Utama Pemindai QR */}
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-wiz-green to-wiz-orange"></div>

                <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-1 mt-2 flex items-center gap-2">
                    <span className="p-2 bg-wiz-green/10 text-wiz-green rounded-xl text-lg">
                        <i className="fa-solid fa-qrcode"></i>
                    </span>
                    Pindai QR Pundi
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 px-2">
                    Arahkan kamera ke stiker QR pundi atau ketik nomor registrasi di bawah.
                </p>

                {/* Wadah Kamera Scanner */}
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-inner border-4 border-gray-100 dark:border-gray-700 relative bg-black mb-5 min-h-[250px] flex items-center justify-center [&_video]:w-full [&_video]:h-auto [&_video]:max-h-[360px] [&_video]:object-contain">
                    {!isInputModalOpen ? (
                        typeof window.Html5QrcodePlugin !== 'undefined' ? (
                            <window.Html5QrcodePlugin qrCodeSuccessCallback={handleScan} />
                        ) : (
                            <div className="text-gray-400 text-xs p-4">Modul scanner kamera sedang disiapkan...</div>
                        )
                    ) : (
                        <div className="w-full min-h-[250px] py-10 flex flex-col items-center justify-center text-wiz-green bg-gray-900">
                            <i className="fa-solid fa-circle-check text-6xl mb-3 animate-bounce"></i>
                            <span className="font-bold text-lg">Pundi Ditemukan!</span>
                        </div>
                    )}
                </div>

                <div className="w-full">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 text-left">
                        Atau Ketik ID / Nomor Urut Pundi
                    </p>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fa-solid fa-keyboard text-gray-400"></i>
                        </div>
                        <input
                            type="text"
                            value={scanInput}
                            onChange={(e) => {
                                setScanInput(e.target.value);
                                handleScan(e.target.value);
                            }}
                            placeholder="Contoh: 5 atau WIZ-PUNDI-..."
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-center font-mono text-sm focus:ring-2 focus:ring-wiz-green focus:border-wiz-green outline-none text-gray-800 dark:text-gray-100 shadow-inner font-bold transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* POP-UP MODAL LAPORAN PENARIKAN LENGKAP & FOTO NOTA */}
            {typeof window.Modal !== 'undefined' && (
                <window.Modal
                    isOpen={isInputModalOpen}
                    onClose={() => { setIsInputModalOpen(false); setSelectedPundi(null); }}
                    title={selectedPundi ? `Laporan Penarikan: ${selectedPundi.usaha}` : 'Laporan Penarikan'}
                >
                    {selectedPundi && (() => {
                        const curM = new Date().getMonth();
                        const curY = new Date().getFullYear();
                        const isAlreadySubmittedThisMonth = (riwayatPundis || []).some(r => {
                            const matchPundi = (String(r.pundiId) === String(selectedPundi.id || selectedPundi.ID)) || (String(r.noUrut) === String(selectedPundi.noUrut));
                            if (!matchPundi) return false;
                            const tgl = r.date || r.Tanggal;
                            if (!tgl) return false;
                            const d = new Date(tgl);
                            return !isNaN(d.getTime()) && d.getMonth() === curM && d.getFullYear() === curY;
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

                            {/* Lencana Pemberitahuan Anti-Duplikat */}
                            {isAlreadySubmittedThisMonth && (
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                    <i className="fa-solid fa-circle-info text-sm shrink-0"></i>
                                    <span>Pundi ini sudah diinput pada bulan ini. Menyimpan akan memperbarui (mengedit) data yang ada tanpa membuat data duplikat.</span>
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

                                {/* Tombol Cepat Nominal: Rp 0 di Paling Depan */}
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
                                            className="px-2 py-1 bg-white dark:bg-gray-800 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold shadow-xs hover:bg-emerald-50"
                                        >
                                            +{val >= 1000000 ? `${val / 1000000}jt` : `${val / 1000}rb`}
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

                            {/* Fitur Foto Kamera Langsung & Unggah Galeri */}
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
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.ScannerView = ScannerView;
}