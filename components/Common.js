// Komponen UI Dasar CRM WIZ Berau (Button, Modal, Table, DynamicForm, ModuleView, Html5QrcodePlugin, StatusBadge, AutocompleteInput)
// Dilengkapi Kompresi Foto Otomatis (<10KB) agar Muat di Sel Google Sheet, GPS Google Maps & Autocomplete

const { useState, useEffect, useMemo, useRef } = React;

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', icon, disabled = false }) => {
    const baseStyle = "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
    const variants = {
        primary: "bg-wiz-green hover:bg-wiz-green_dark text-white focus:ring-wiz-green hover:shadow-md active:scale-95",
        accent: "bg-gradient-to-r from-wiz-orange to-[#fca545] hover:from-wiz-orange_dark hover:to-wiz-orange text-white focus:ring-wiz-orange shadow-md active:scale-95",
        secondary: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 active:scale-95",
        danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-md active:scale-95"
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}>
            {icon && <i className={icon}></i>}
            {children}
        </button>
    );
};

const StatusBadge = ({ text }) => {
    const safeText = String(text || '').trim();
    let colorStyle = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    
    if (safeText === 'Aktif' || safeText === 'Berhasil' || safeText === 'Selesai') {
        colorStyle = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    } else if (safeText === 'Dijemput' || safeText === 'Dalam Penjemputan') {
        colorStyle = "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    } else if (safeText === 'Ditarik' || safeText === 'Gagal' || safeText === 'Batal' || safeText === 'Nonaktif') {
        colorStyle = "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800";
    }

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${colorStyle}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${safeText === 'Aktif' || safeText === 'Berhasil' || safeText === 'Selesai' ? 'bg-emerald-500' : safeText.includes('Jemput') ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
            {safeText || '-'}
        </span>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/60 dark:bg-black/75 backdrop-blur-sm animate-in">
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto slide-up border border-white/20 dark:border-gray-700 text-gray-800 dark:text-gray-100 flex flex-col">
                {title && (
                    <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur z-10">
                        <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 truncate pr-2">{title}</h2>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-wiz-green rounded-full transition-colors">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                )}
                <div className="p-4 sm:p-6 pb-8 sm:pb-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Table = ({ columns, data = [], onEdit, onDelete }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50/80 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-100 dark:border-gray-700">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className="px-4 py-3.5 text-xs uppercase tracking-wider">{col.label}</th>
                            ))}
                            {(onEdit || onDelete) && <th className="px-4 py-3.5 text-xs text-center uppercase tracking-wider">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-4 py-8 text-center text-gray-400 text-xs">
                                    Tidak ada data untuk ditampilkan.
                                </td>
                            </tr>
                        ) : data.map((row, rIdx) => (
                            <tr key={row.id || row.ID || rIdx} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40 transition-colors">
                                {columns.map((col, cIdx) => (
                                    <td key={cIdx} className="px-4 py-3 text-xs">
                                        {col.render ? col.render(row) : (row[col.key] !== undefined ? row[col.key] : '-')}
                                    </td>
                                ))}
                                {(onEdit || onDelete) && (
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {onEdit && (
                                                <button onClick={() => onEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors" title="Edit Data">
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button onClick={() => onDelete(row)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors" title="Hapus Data">
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const compressImageFile = (file, maxWidth = 360, maxHeight = 360, quality = 0.6) => {
    return new Promise((resolve) => {
        if (!file) return resolve('');
        try {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const naturalW = img.naturalWidth || img.width;
                        const naturalH = img.naturalHeight || img.height;
                        let width = naturalW;
                        let height = naturalH;

                        if (width > height) {
                            if (width > maxWidth) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = Math.round((width * maxHeight) / height);
                                height = maxHeight;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                        resolve(compressedBase64);
                    } catch (err) {
                        resolve(readerEvent.target.result || '');
                    }
                };
                img.onerror = () => resolve(readerEvent.target.result || '');
                img.src = readerEvent.target.result;
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        } catch (err) {
            resolve('');
        }
    });
};

// Komponen Input Pencarian Cerdas (Autocomplete: Ketik langsung muncul nama donatur tanpa scroll)
const SearchableInput = ({ value, onChange, options = [], placeholder, required, hint }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value || '');
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const stringOptions = useMemo(() => {
        if (!Array.isArray(options)) return [];
        return options.map(opt => {
            if (opt === null || opt === undefined) return '';
            if (typeof opt === 'object') return String(opt.value || opt.label || opt.name || opt.Nama || '');
            return String(opt);
        }).filter(item => item.trim() !== '');
    }, [options]);

    const filtered = useMemo(() => {
        const q = String(searchTerm || '').toLowerCase().trim();
        if (!q) return stringOptions.slice(0, 30);
        return stringOptions.filter(item => item.toLowerCase().includes(q)).slice(0, 30);
    }, [stringOptions, searchTerm]);

    const handleSelect = (val) => {
        setSearchTerm(val);
        onChange(val);
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        onChange(val);
        setIsOpen(true);
    };

    const isExactMatch = stringOptions.some(opt => opt.toLowerCase() === String(searchTerm || '').toLowerCase().trim());

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                    placeholder={placeholder || "Ketik nama untuk mencari..."}
                    required={required}
                    autoComplete="off"
                    className="w-full p-2.5 pr-8 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-wiz-green"
                />
                <button
                    type="button"
                    tabIndex="-1"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                >
                    <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                </button>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl z-[100] py-1 text-xs">
                    {filtered.map((item, idx) => (
                        <div
                            key={idx}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(item);
                            }}
                            className="px-3 py-2 cursor-pointer transition-colors flex items-center justify-between hover:bg-wiz-green/10 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold"
                        >
                            <span className="truncate">{item}</span>
                            {String(searchTerm).toLowerCase() === item.toLowerCase() && (
                                <i className="fa-solid fa-check text-[10px] text-wiz-green ml-2"></i>
                            )}
                        </div>
                    ))}
                    {searchTerm && !isExactMatch && (
                        <div
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(searchTerm.trim());
                            }}
                            className="px-3 py-2 cursor-pointer transition-colors flex items-center gap-1.5 bg-wiz-orange/10 hover:bg-wiz-orange/20 text-wiz-orange font-bold border-t border-gray-100 dark:border-gray-700"
                        >
                            <i className="fa-solid fa-plus-circle text-xs"></i>
                            <span>Gunakan "{searchTerm.trim()}" (Data Baru)</span>
                        </div>
                    )}
                    {filtered.length === 0 && !searchTerm && (
                        <div className="px-3 py-2 text-gray-400 italic text-[11px]">
                            Tidak ada pilihan
                        </div>
                    )}
                </div>
            )}
            {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
        </div>
    );
};

const DynamicForm = ({ schema = [], initialData = {}, defaultValues = {}, onSubmit, onCancel }) => {
    // Inisialisasi data form dengan menjamin field select terisi default agar tidak kosong saat disimpan
    const initializeForm = () => {
        const init = { ...defaultValues, ...initialData };
        schema.forEach(field => {
            if (field.type === 'select') {
                const currentVal = init[field.name];
                if (currentVal === undefined || currentVal === null || currentVal === '') {
                    const firstOpt = Array.isArray(field.options) && field.options.length > 0 ? field.options[0] : '';
                    init[field.name] = typeof firstOpt === 'object' ? firstOpt.value : firstOpt;
                }
            }
        });
        return init;
    };

    const [formData, setFormData] = useState(initializeForm);
    const [gpsDetecting, setGpsDetecting] = useState(false);
    const [gpsNotice, setGpsNotice] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Kunci stabil: form TIDAK akan me-reset dirinya sendiri saat pengguna sedang mengetik
    const activeDataId = initialData?.id || initialData?.ID || 'new';
    const lastDataIdRef = useRef(activeDataId);

    useEffect(() => {
        if (activeDataId !== lastDataIdRef.current) {
            lastDataIdRef.current = activeDataId;
            setFormData(initializeForm());
        }
    }, [activeDataId]);

    const handleInputChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileUpload = async (name, file) => {
        if (!file) return;
        setUploadingImage(true);
        try {
            const compressed = await compressImageFile(file, 180, 180, 0.7);
            if (compressed) {
                handleInputChange(name, compressed);
            }
        } finally {
            setUploadingImage(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const finalSubmission = { ...formData };
        schema.forEach(field => {
            if (field.type === 'select') {
                if (!finalSubmission[field.name]) {
                    const firstOpt = Array.isArray(field.options) && field.options.length > 0 ? field.options[0] : '';
                    finalSubmission[field.name] = typeof firstOpt === 'object' ? firstOpt.value : firstOpt;
                }
            }
        });
        onSubmit(finalSubmission);
    };

    const detectGpsDirectly = (fieldName) => {
        if (!navigator.geolocation) {
            setGpsNotice({ type: 'error', text: 'Browser tidak mendukung GPS.' });
            setTimeout(() => setGpsNotice(null), 4000);
            return;
        }

        setGpsDetecting(true);
        setGpsNotice(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsDetecting(false);
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

                handleInputChange(fieldName, mapsUrl);

                try {
                    const el = document.createElement('textarea');
                    el.value = mapsUrl;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                } catch(e) {}

                setGpsNotice({ type: 'success', text: `GPS dideteksi & disalin: ${lat}, ${lng}` });
                setTimeout(() => setGpsNotice(null), 5000);
            },
            (err) => {
                setGpsDetecting(false);
                let text = "Gagal membaca titik GPS.";
                if (err.code === 1) text = "Izin GPS ditolak.";
                else if (err.code === 2) text = "GPS HP belum aktif.";
                setGpsNotice({ type: 'error', text });
                setTimeout(() => setGpsNotice(null), 4000);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {schema.map(field => {
                    const val = formData[field.name] !== undefined && formData[field.name] !== null ? formData[field.name] : '';

                    if (field.type === 'file') {
                        return (
                            <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                    {val ? (
                                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                                <img
                                                    src={typeof getDirectImageUrl === 'function' ? getDirectImageUrl(val) : val}
                                                    alt="Preview Foto"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }}
                                                />
                                                <i style={{ display: 'none' }} className="fa-solid fa-image text-gray-400"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-wiz-green dark:text-emerald-400 truncate flex items-center gap-1">
                                                    <i className="fa-solid fa-circle-check"></i>
                                                    <span>{String(val).startsWith('data:') ? 'Foto Terpasang (<8KB) Siap Disimpan' : 'Foto URL Terpasang'}</span>
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange(field.name, '')}
                                                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold mt-0.5 flex items-center gap-1"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i> Hapus / Ganti Foto
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="flex flex-col sm:flex-row gap-2 items-center">
                                        <label className="w-full sm:w-auto px-3.5 py-2 bg-wiz-green/10 hover:bg-wiz-green text-wiz-green hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 shrink-0 border border-wiz-green/20">
                                            <i className={`fa-solid ${uploadingImage ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
                                            <span>{uploadingImage ? 'Mengompresi...' : 'Ambil / Pilih Berkas'}</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                disabled={uploadingImage}
                                                onClick={(e) => { e.target.value = ''; }}
                                                onChange={(e) => {
                                                    const file = e.target.files && e.target.files[0];
                                                    if (file) handleFileUpload(field.name, file);
                                                }}
                                                className="hidden"
                                            />
                                        </label>
                                        <input
                                            type="text"
                                            value={String(val).startsWith('data:') ? '' : (val || '')}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            placeholder={String(val).startsWith('data:') ? 'Foto berkas telah dipilih. Atau tempel link URL di sini...' : 'Atau tempel link URL foto / Google Drive...'}
                                            className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-medium text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-wiz-green font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (field.type === 'autocomplete' || field.type === 'datalist') {
                        return (
                            <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <SearchableInput
                                    value={val}
                                    onChange={(newVal) => handleInputChange(field.name, newVal)}
                                    options={field.options || []}
                                    placeholder={field.placeholder || "Ketik nama untuk mencari..."}
                                    required={field.required}
                                    hint={field.hint}
                                />
                            </div>
                        );
                    }

                    if (field.type === 'select') {
                        return (
                            <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    value={val}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    required={field.required}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-wiz-green"
                                >
                                    {(field.options || []).map((opt, idx) => {
                                        const optVal = typeof opt === 'object' ? opt.value : opt;
                                        const optLbl = typeof opt === 'object' ? opt.label : opt;
                                        return <option key={idx} value={optVal} className="dark:bg-gray-800">{optLbl}</option>;
                                    })}
                                </select>
                            </div>
                        );
                    }

                    if (field.type === 'map_location') {
                        return (
                            <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => detectGpsDirectly(field.name)}
                                            disabled={gpsDetecting}
                                            className="px-2 py-0.5 bg-wiz-green hover:bg-wiz-green_dark text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                            title="Ambil titik koordinat saat ini"
                                        >
                                            <i className={`fa-solid ${gpsDetecting ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`}></i>
                                            <span>{gpsDetecting ? 'GPS...' : '📍 Isi GPS'}</span>
                                        </button>
                                        <a
                                            href="https://www.google.com/maps"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                            title="Buka Google Maps"
                                        >
                                            <i className="fa-solid fa-map-location-dot text-blue-500"></i>
                                            <span>Maps</span>
                                        </a>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    placeholder="Tempel link Google Maps atau klik Isi GPS..."
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-wiz-green font-mono"
                                />
                                {gpsNotice && (
                                    <p className={`text-[10px] mt-1 font-semibold ${gpsNotice.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                        {gpsNotice.text}
                                    </p>
                                )}
                            </div>
                        );
                    }

                    if (field.type === 'textarea' || field.type === 'berau_address') {
                        return (
                            <div key={field.name} className="col-span-full">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <textarea
                                    rows="2"
                                    value={val}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    placeholder={field.placeholder || "Tulis alamat / catatan..."}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-wiz-green"
                                ></textarea>
                            </div>
                        );
                    }

                    return (
                        <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type={field.type || 'text'}
                                value={field.isCurrency && val ? Number(val).toLocaleString('id-ID') : val}
                                onChange={(e) => {
                                    const raw = field.isCurrency ? e.target.value.replace(/\D/g, '') : e.target.value;
                                    handleInputChange(field.name, raw);
                                }}
                                placeholder={field.placeholder || ''}
                                required={field.required}
                                className="w-full p-2.5 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-wiz-green"
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                {onCancel && <Button variant="secondary" onClick={onCancel}>Batal</Button>}
                <Button type="submit" variant="primary" disabled={uploadingImage}>Simpan Data</Button>
            </div>
        </form>
    );
};

// ===== Impor data dari CSV (Google Sheet / Excel) =====
const csvNormKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const parseCSVText = (input) => {
    const text = String(input || '').replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const counts = { ',': (firstLine.match(/,/g) || []).length, ';': (firstLine.match(/;/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length };
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) {
            if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
            else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === delim) { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cur); cur = ''; rows.push(row); row = [];
        } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
};

const csvParseMoney = (v) => {
    let t = String(v).replace(/[^\d.,-]/g, '');
    if (!t) return NaN;
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.includes(',')) t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return Number(t);
};

const csvParseDate = (v) => {
    const t = String(v).trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    let y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
        m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
        if (!m) return null;
        d = +m[1]; mo = +m[2]; y = +m[3];
        if (y < 100) y += 2000;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
};

const buildImportPreview = (rows, schema, defaultValues, rowCheck) => {
    const fields = schema.filter(f => f.type !== 'file');
    const header = rows[0].map(csvNormKey);
    const colFor = (f) => {
        const keys = [csvNormKey(f.name), csvNormKey(f.label)];
        let idx = header.findIndex(h => h && keys.includes(h));
        if (idx < 0) {
            const loose = header.map((h, i) => (h.length >= 3 && csvNormKey(f.label).startsWith(h)) ? i : -1).filter(i => i >= 0);
            if (loose.length === 1) idx = loose[0];
        }
        return idx;
    };
    const cols = fields.map(f => ({ f, idx: colFor(f) }));
    const missing = cols.filter(c => c.idx < 0 && c.f.required && c.f.type !== 'select').map(c => c.f.label || c.f.name);
    if (missing.length > 0) return { fatal: 'Kolom wajib tidak ditemukan di baris pertama: ' + missing.join(', ') + '. Gunakan templat agar judul kolom sesuai.' };

    const valid = [], errors = [];
    let blank = 0;
    const skipCols = cols.filter(c => c.f.skipIfEmpty && c.idx >= 0);
    rows.slice(1).forEach((r, ri) => {
        const line = ri + 2;
        if (skipCols.length > 0 && skipCols.every(c => String(r[c.idx] === undefined ? '' : r[c.idx]).trim() === '')) { blank++; return; }
        const item = {};
        const problems = [];
        cols.forEach(({ f, idx }) => {
            const raw = idx >= 0 ? String(r[idx] === undefined ? '' : r[idx]).trim() : '';
            const label = f.label || f.name;
            if (raw === '') {
                if (f.type === 'select') {
                    const dv = defaultValues && defaultValues[f.name];
                    const first = Array.isArray(f.options) && f.options.length > 0 ? f.options[0] : '';
                    item[f.name] = dv !== undefined ? dv : (typeof first === 'object' ? first.value : first);
                } else if (f.required) problems.push('kolom "' + label + '" kosong');
                return;
            }
            if (f.isCurrency) {
                const n = csvParseMoney(raw);
                if (isNaN(n)) problems.push('"' + label + '" bukan angka'); else item[f.name] = n;
            } else if (f.type === 'number') {
                const n = csvParseMoney(raw);
                if (isNaN(n)) problems.push('"' + label + '" bukan angka'); else item[f.name] = n;
            } else if (f.type === 'date') {
                const dt = csvParseDate(raw);
                if (!dt) problems.push('"' + label + '" format tanggal tidak dikenal (pakai DD/MM/YYYY)'); else item[f.name] = dt;
            } else if (f.type === 'select') {
                const opts = (Array.isArray(f.options) ? f.options : []).map(o => typeof o === 'object' ? o : { value: o, label: o });
                const hit = opts.find(o => csvNormKey(o.value) === csvNormKey(raw) || csvNormKey(o.label) === csvNormKey(raw));
                if (!hit) problems.push('"' + label + '" berisi "' + raw + '" yang tidak ada di pilihan'); else item[f.name] = hit.value;
            } else item[f.name] = raw;
        });
        if (!problems.length && typeof rowCheck === 'function') { const extra = rowCheck(item); if (extra) problems.push(extra); }
        if (problems.length) errors.push('Baris ' + line + ': ' + problems.join('; '));
        else valid.push(item);
    });
    return { valid, errors, blank, total: rows.length - 1 - blank };
};

const CsvImportBar = ({ schema = [], defaultValues = {}, onImport, makeRowCheck = null, templateRows = null, title = '' }) => {
    const fileRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const downloadTemplate = () => {
        const esc = (v) => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
        const fields = schema.filter(f => f.type !== 'file');
        const lines = [fields.map(f => esc(f.label || f.name)).join(',')];
        const extra = typeof templateRows === 'function' ? templateRows() : [];
        (extra || []).forEach(r => lines.push(r.map(esc).join(',')));
        const blob = new Blob(['\uFEFF' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'templat-' + String(title || 'data').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    const handleFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setMessage('');
        try {
            const rows = parseCSVText(await file.text());
            if (rows.length < 2) { setMessage('File kosong atau hanya berisi judul kolom.'); return; }
            const result = buildImportPreview(rows, schema, defaultValues, typeof makeRowCheck === 'function' ? makeRowCheck() : null);
            if (result.fatal) { setMessage(result.fatal); return; }
            setPreview({ ...result, fileName: file.name });
        } catch (err) {
            setMessage('Gagal membaca file: ' + (err && err.message ? err.message : 'galat'));
        }
    };

    const confirmImport = async () => {
        if (!preview || !preview.valid.length) return;
        setBusy(true);
        try {
            const res = await onImport(preview.valid);
            const added = res && typeof res.added === 'number' ? res.added : preview.valid.length;
            const skipped = res && res.skipped ? res.skipped : 0;
            setMessage('Impor selesai: ' + added + ' data ditambahkan' + (skipped ? ', ' + skipped + ' dilewati karena sudah ada' : '') + (preview.errors.length ? ', ' + preview.errors.length + ' baris ditolak' : '') + '.');
        } catch (err) {
            setMessage('Impor gagal: ' + (err && err.message ? err.message : 'galat'));
        }
        setBusy(false);
        setPreview(null);
    };

    return (
        <>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current && fileRef.current.click()} icon="fa-solid fa-file-import" variant="secondary" className="text-xs py-2 px-3.5">Impor CSV</Button>
            <Button onClick={downloadTemplate} icon="fa-solid fa-download" variant="secondary" className="text-xs py-2 px-3.5">Templat</Button>
            {message && <p className="basis-full text-xs text-gray-600 dark:text-gray-300 mt-1">{message}</p>}
            <Modal isOpen={!!preview} onClose={() => setPreview(null)} title={'Impor ' + title}>
                {preview && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-700 dark:text-gray-200">File <b>{preview.fileName}</b>: {preview.total} baris data terbaca. <b className="text-wiz-green">{preview.valid.length}</b> siap diimpor, <b className="text-red-600">{preview.errors.length}</b> ditolak{preview.blank ? ', ' + preview.blank + ' baris kosong dilewati' : ''}.</p>
                        {preview.errors.length > 0 && (
                            <div className="max-h-40 overflow-y-auto text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 space-y-1">
                                {preview.errors.slice(0, 20).map((er, i) => <div key={i}>{er}</div>)}
                                {preview.errors.length > 20 && <div>... dan {preview.errors.length - 20} baris lain.</div>}
                            </div>
                        )}
                        <p className="text-[11px] text-gray-400">Tanggal dibaca sebagai DD/MM/YYYY atau YYYY-MM-DD. Baris yang ditolak tidak diimpor; perbaiki di Sheet lalu unggah ulang.</p>
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setPreview(null)} variant="secondary" className="text-xs py-2 px-3.5">Batal</Button>
                            <Button onClick={confirmImport} disabled={busy || preview.valid.length === 0} variant="primary" className="text-xs py-2 px-3.5">{busy ? 'Menyimpan...' : 'Impor ' + preview.valid.length + ' data'}</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

const ModuleView = ({ title, data = [], columns = [], schema = [], defaultValues = {}, onSave, onImport = null, importSchema = null, makeImportRowCheck = null, onDelete, canAdd = true, canEdit = true, canDelete = true, modalTopContent = null }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingData, setEditingData] = useState(null);

    const handleOpenAdd = () => {
        setEditingData(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditingData(item);
        setIsModalOpen(true);
    };

    const handleFormSubmit = (formData) => {
        const finalData = editingData ? { ...editingData, ...formData } : formData;
        if (typeof onSave === 'function') {
            onSave(finalData, !!editingData);
        }
        setIsModalOpen(false);
        setEditingData(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
                    <p className="text-xs text-gray-400">Kelola dan perbarui data master.</p>
                </div>
                {canAdd && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {typeof onImport === 'function' && <CsvImportBar schema={importSchema || schema} defaultValues={defaultValues} onImport={onImport} makeRowCheck={makeImportRowCheck} title={title} />}
                        <Button onClick={handleOpenAdd} icon="fa-solid fa-plus" variant="primary" className="text-xs py-2 px-3.5">
                            Tambah Data
                        </Button>
                    </div>
                )}
            </div>

            <Table 
                columns={columns} 
                data={data} 
                onEdit={canEdit ? handleOpenEdit : null} 
                onDelete={canDelete ? onDelete : null} 
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setEditingData(null); }} 
                title={editingData ? `Edit ${title}` : `Tambah ${title}`}
            >
                {modalTopContent}

                <DynamicForm
                    key={editingData ? (editingData.id || editingData.ID || 'edit') : 'new'}
                    schema={schema}
                    initialData={editingData || {}}
                    defaultValues={defaultValues}
                    onSubmit={handleFormSubmit}
                    onCancel={() => { setIsModalOpen(false); setEditingData(null); }}
                />
            </Modal>
        </div>
    );
};

const Html5QrcodePlugin = ({ qrCodeSuccessCallback }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        const scannerId = "html5-qr-reader";
        let html5QrCode = null;

        const startScanner = async () => {
            try {
                if (!window.Html5Qrcode) return;
                html5QrCode = new window.Html5Qrcode(scannerId);
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 220, height: 220 } },
                    (decodedText) => {
                        if (typeof qrCodeSuccessCallback === 'function') {
                            qrCodeSuccessCallback(decodedText);
                        }
                    },
                    () => {}
                );
            } catch (err) {
                console.warn("Kamera tidak aktif:", err);
            }
        };

        const timer = setTimeout(startScanner, 250);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                try {
                    scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
                } catch(e) {}
            }
        };
    }, []);

    return (
        <div className="w-full flex flex-col items-center justify-center">
            <div id="html5-qr-reader" className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-inner bg-black"></div>
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.Button = Button;
    window.Modal = Modal;
    window.Table = Table;
    window.DynamicForm = DynamicForm;
    window.ModuleView = ModuleView;
    window.CsvImportBar = CsvImportBar;
    window.Html5QrcodePlugin = Html5QrcodePlugin;
    window.StatusBadge = StatusBadge;
    window.SearchableInput = SearchableInput;
}