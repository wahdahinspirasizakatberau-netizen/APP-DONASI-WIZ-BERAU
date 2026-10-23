// Komponen Dashboard Utama dengan Filter Periode & Sortir Donasi Masuk

const DashboardView = ({ data, darkMode }) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } = window.Recharts;
    const { programs = [], donations = [], tasks = [], amils = [], riwayatPundis = [], pundis = [], contacts = [] } = data;
    const [selectedPundiBreakdown, setSelectedPundiBreakdown] = useState(null);

    // State Filter Waktu Periode: 'semua', 'bulanan', 'tahunan'
    const [filterMode, setFilterMode] = useState('semua');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // State Sortir Donasi Masuk: 'terbaru', 'tertinggi', 'terendah', 'terlama'
    const [donationSortOrder, setDonationSortOrder] = useState('terbaru');

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const yearOptions = Array.from({length: 7}, (_, i) => new Date().getFullYear() - 3 + i);

    const totalPundiCollected = useMemo(() => {
        return riwayatPundis
            .filter(r => r.status === 'Berhasil')
            .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    }, [riwayatPundis]);

    const activeProgramList = useMemo(() => {
        const activeProgramsRaw = programs.filter(p => p.status === 'Aktif');
        const pundiPrograms = activeProgramsRaw.filter(p => 
            (p.category && p.category.includes('Pundi')) || 
            (p.name && p.name.toLowerCase().includes('pundi'))
        );
        const nonPundiPrograms = activeProgramsRaw.filter(p => 
            !(p.category && p.category.includes('Pundi')) && 
            !(p.name && p.name.toLowerCase().includes('pundi'))
        );

        const result = [];
        if (pundiPrograms.length > 0) {
            const totalTargetPundi = pundiPrograms.reduce((sum, p) => sum + Number(p.target || 0), 0);
            const donationPundiCollected = donations
                .filter(d => pundiPrograms.some(prog => prog.name === d.programName) && d.status === 'Berhasil')
                .reduce((sum, d) => sum + Number(d.amount || 0), 0);
            
            result.push({
                id: 'pundi-umum-consolidated',
                name: 'PUNDI UMUM',
                target: totalTargetPundi,
                collected: donationPundiCollected + totalPundiCollected,
                isPundiCampaign: true,
                isConsolidated: true,
                subCampaigns: pundiPrograms
            });
        }

        nonPundiPrograms.forEach(prog => {
            const donationCollected = donations
                .filter(d => d.programName === prog.name && d.status === 'Berhasil')
                .reduce((sum, d) => sum + Number(d.amount || 0), 0);
            result.push({
                ...prog,
                collected: donationCollected,
                isPundiCampaign: false
            });
        });

        return result;
    }, [programs, donations, totalPundiCollected]);

    const filteredDonations = useMemo(() => {
        return donations.filter(d => {
            if (d.status !== 'Berhasil') return false;
            if (!d.date) return false;
            const dObj = new Date(d.date);
            if (isNaN(dObj.getTime())) return false;

            if (filterMode === 'bulanan') {
                return dObj.getMonth() === Number(selectedMonth) && dObj.getFullYear() === Number(selectedYear);
            } else if (filterMode === 'tahunan') {
                return dObj.getFullYear() === Number(selectedYear);
            }
            return true;
        });
    }, [donations, filterMode, selectedMonth, selectedYear]);

    const stats = useMemo(() => {
        const donasiReguler = filteredDonations.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        const totalDonasi = filterMode === 'semua' ? (donasiReguler + totalPundiCollected) : donasiReguler;
        const uniqueDonors = new Set([...filteredDonations.map(d => d.donorName)]).size;
        const completedTasks = tasks.filter(t => t.status === 'Selesai').length;
        return { totalDonasi, uniqueDonors, activePrograms: activeProgramList.length, completedTasks, totalTasks: tasks.length };
    }, [filteredDonations, tasks, activeProgramList, totalPundiCollected, filterMode]);

    const donationStats = useMemo(() => {
        const grouped = {};
        const sortedDonations = [...filteredDonations].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedDonations.forEach(d => {
            const dateObj = new Date(d.date);
            if(isNaN(dateObj.getTime())) return;
            
            let key = '';
            if (filterMode === 'bulanan') {
                key = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            } else {
                key = dateObj.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            }
            grouped[key] = (grouped[key] || 0) + Number(d.amount);
        });
        return Object.keys(grouped).map(key => ({ name: key, total: grouped[key] }));
    }, [filteredDonations, filterMode]);

    const amilPerformance = useMemo(() => {
        return amils.map(amil => {
            const amilDonations = filteredDonations.filter(d => d.amilName === amil.name);
            const totalDonation = amilDonations.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
            const amilTasks = tasks.filter(t => t.assignedTo === amil.name);
            const completed = amilTasks.filter(t => t.status === 'Selesai').length;
            return { id: amil.id, name: amil.name, totalDonation, completedTasks: completed, totalTasks: amilTasks.length };
        }).sort((a, b) => b.totalDonation - a.totalDonation);
    }, [amils, filteredDonations, tasks]);

    // Donasi Masuk yang telah diurutkan berdasarkan filter
    const sortedRecentDonations = useMemo(() => {
        const list = [...filteredDonations];
        if (donationSortOrder === 'tertinggi') {
            list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
        } else if (donationSortOrder === 'terendah') {
            list.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
        } else if (donationSortOrder === 'terlama') {
            list.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            list.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return list.slice(0, 6);
    }, [filteredDonations, donationSortOrder]);

    const totalTargetAll = activeProgramList.reduce((sum, p) => sum + Number(p.target || 0), 0);
    const totalCollectedAll = activeProgramList.reduce((sum, p) => sum + Number(p.collected || 0), 0);
    const totalPercentAll = totalTargetAll > 0 ? Math.min(Math.round((totalCollectedAll / totalTargetAll) * 100), 100) : 0;

    const StatCard = ({ icon, label, value, colorClass, bgClass, subtitle }) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${bgClass} opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out`}></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className={`w-14 h-14 rounded-2xl ${bgClass} ${colorClass} flex items-center justify-center text-2xl shadow-inner`}>
                    <i className={icon}></i>
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 truncate">{value}</h3>
                    {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 slide-up">
            {/* Filter Waktu Utama */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                        <span className="p-1.5 bg-wiz-green/10 text-wiz-green dark:text-emerald-400 rounded-lg">
                            <i className="fa-solid fa-filter"></i>
                        </span>
                        Filter Periode Tren & Donasi Masuk
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Pilih untuk menyaring data Semua, Bulanan, atau Tahunan pada dashboard.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                        {[
                            { id: 'semua', label: 'Semua Data' },
                            { id: 'bulanan', label: 'Bulanan' },
                            { id: 'tahunan', label: 'Tahunan' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilterMode(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterMode === tab.id 
                                        ? 'bg-wiz-green text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {filterMode === 'bulanan' && (
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))} 
                            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer focus:ring-2 focus:ring-wiz-green"
                        >
                            {monthNames.map((m, idx) => <option key={idx} value={idx} className="dark:bg-gray-800">{m}</option>)}
                        </select>
                    )}

                    {(filterMode === 'bulanan' || filterMode === 'tahunan') && (
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))} 
                            className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer focus:ring-2 focus:ring-wiz-green"
                        >
                            {yearOptions.map(y => <option key={y} value={y} className="dark:bg-gray-800">Tahun {y}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon="fa-solid fa-wallet" label="Total Donasi Masuk" value={formatRp(stats.totalDonasi)} colorClass="text-wiz-green dark:text-emerald-400" bgClass="bg-wiz-green/10 dark:bg-wiz-green/20" />
                <StatCard icon="fa-solid fa-user-heart" label="Donatur Berpartisipasi" value={`${stats.uniqueDonors} Orang`} colorClass="text-wiz-orange dark:text-amber-400" bgClass="bg-wiz-orange/10 dark:bg-wiz-orange/20" />
                <StatCard icon="fa-solid fa-bullseye" label="Program Aktif" value={`${stats.activePrograms} Campaign`} colorClass="text-blue-500 dark:text-blue-400" bgClass="bg-blue-50 dark:bg-blue-900/30" />
                <StatCard icon="fa-solid fa-list-check" label="Kinerja Tugas" value={`${stats.completedTasks} / ${stats.totalTasks}`} subtitle="Tugas terselesaikan" colorClass="text-purple-500 dark:text-purple-400" bgClass="bg-purple-50 dark:bg-purple-900/30" />
            </div>

            {/* Grafik & Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 p-6 lg:col-span-2 transition-shadow">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-wiz-green/10 dark:bg-wiz-green/20 rounded-lg text-wiz-green dark:text-emerald-400"><i className="fa-solid fa-chart-line"></i></div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Tren Penerimaan Donasi</h3>
                                <p className="text-xs text-gray-400">
                                    Menampilkan: <b className="text-wiz-green dark:text-emerald-400">{filterMode === 'semua' ? 'Semua Riwayat' : filterMode === 'bulanan' ? `${monthNames[selectedMonth]} ${selectedYear}` : `Tahun ${selectedYear}`}</b>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        {donationStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={donationStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#374151" : "#f1f5f9"} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: darkMode ? '#9ca3af' : '#94a3b8', fontSize: 11, fontWeight: 500}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: darkMode ? '#9ca3af' : '#94a3b8', fontSize: 11}} tickFormatter={(val) => `${val >= 1000000 ? (val/1000000).toFixed(1)+'M' : (val/1000)+'k'}`} />
                                    <Tooltip cursor={{fill: darkMode ? '#374151' : '#f8fafc'}} contentStyle={{borderRadius: '12px', border: darkMode ? '1px solid #4b5563' : '1px solid #e2e8f0', backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#f3f4f6' : '#1f2937', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(value) => [formatRp(value), "Total"]} />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={45}>
                                        {donationStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === donationStats.length - 1 ? '#F59121' : '#27745F'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                <i className="fa-solid fa-chart-column text-4xl mb-3 text-gray-200 dark:text-gray-700"></i>
                                <p className="text-xs">Tidak ada data donasi pada periode filter ini</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg text-yellow-600 dark:text-yellow-400"><i className="fa-solid fa-award"></i></div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Leaderboard Amil</h3>
                    </div>
                    <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                        {amilPerformance.map((amil, idx) => (
                            <div key={amil.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 hover:bg-wiz-light dark:hover:bg-gray-700/50 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300 ring-2 ring-yellow-200 dark:ring-yellow-700' : idx === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ring-2 ring-gray-200 dark:ring-gray-600' : 'bg-wiz-green/10 text-wiz-green dark:text-emerald-400'}`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm group-hover:text-wiz-green dark:group-hover:text-emerald-400 transition-colors">{amil.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><i className="fa-solid fa-check-double text-[10px] text-wiz-green dark:text-emerald-400"></i> {amil.completedTasks} Tugas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Donasi</p>
                                    <p className="font-bold text-wiz-green dark:text-emerald-400 text-sm">{formatRp(amil.totalDonation)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Donasi Masuk & Campaign */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg text-blue-500 dark:text-blue-400"><i className="fa-solid fa-clock-rotate-left"></i></div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                    {donationSortOrder === 'tertinggi' ? 'Donasi Nominal Tertinggi' : donationSortOrder === 'terendah' ? 'Donasi Nominal Terendah' : donationSortOrder === 'terlama' ? 'Donasi Masuk Terlama' : 'Donasi Masuk Terbaru'}
                                </h3>
                                <p className="text-xs text-gray-400">{filteredDonations.length} Transaksi Terfilter</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={donationSortOrder}
                                onChange={(e) => setDonationSortOrder(e.target.value)}
                                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer focus:ring-2 focus:ring-wiz-green"
                            >
                                <option value="terbaru">🕒 Donasi Terbaru</option>
                                <option value="tertinggi">💰 Nominal Tertinggi</option>
                                <option value="terendah">📉 Nominal Terendah</option>
                                <option value="terlama">🗓️ Donasi Terlama</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {sortedRecentDonations.length > 0 ? sortedRecentDonations.map((donasi) => (
                            <div key={donasi.id} className="flex justify-between items-center p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-wiz-green/10 dark:bg-wiz-green/20 text-wiz-green dark:text-emerald-400 flex items-center justify-center font-bold">
                                        {donasi.donorName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{donasi.donorName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{donasi.programName} • <span className="text-wiz-orange">{donasi.amilName}</span></p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{formatRp(donasi.amount)}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{formatDate(donasi.date)}</p>
                                </div>
                            </div>
                        )) : <p className="text-gray-400 dark:text-gray-500 text-center py-6 italic text-sm">Tidak ada donasi masuk pada periode filter ini.</p>}
                    </div>
                </div>

                {/* Progress Campaign */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-wiz-orange/10 dark:bg-wiz-orange/20 rounded-lg text-wiz-orange dark:text-amber-400"><i className="fa-solid fa-bars-progress"></i></div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Progres Campaign Aktif</h3>
                    </div>
                    
                    {activeProgramList.length > 0 && (
                        <div className="mb-6 p-5 bg-gradient-to-br from-wiz-green_dark to-wiz-green rounded-2xl text-white shadow-lg shadow-wiz-green/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl"><i className="fa-solid fa-chart-pie"></i></div>
                            <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-2 relative z-10">Pencapaian Akumulatif</h4>
                            <div className="flex justify-between items-end mb-3 relative z-10">
                                <div>
                                    <p className="text-3xl font-black">{formatRp(totalCollectedAll)}</p>
                                    <p className="text-xs text-white/70 mt-1">Target Total: {formatRp(totalTargetAll)}</p>
                                </div>
                                <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                                    <span className="text-lg font-bold">{totalPercentAll}%</span>
                                </div>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-1.5 relative z-10">
                                <div className="bg-wiz-orange h-1.5 rounded-full shadow-[0_0_10px_rgba(245,145,33,0.8)]" style={{ width: `${totalPercentAll}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                        {activeProgramList.length > 0 ? activeProgramList.map(prog => {
                            const percent = prog.target > 0 ? Math.min(Math.round((prog.collected / prog.target) * 100), 100) : 0;
                            return (
                                <div key={prog.id} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{prog.name}</span>
                                        <span className="text-wiz-orange font-bold text-xs">{percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="bg-wiz-green h-2 rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-semibold text-gray-400">
                                        <span className="text-wiz-green dark:text-emerald-400">{formatRp(prog.collected)}</span>
                                        <span>Target: {formatRp(prog.target)}</span>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-gray-400 dark:text-gray-500 text-center py-6 text-sm">Tidak ada program aktif.</p>}
                    </div>
                </div>
            </div>

            {/* Modal Rincian Target & Capaian Pundi */}
            <Modal isOpen={!!selectedPundiBreakdown} onClose={() => setSelectedPundiBreakdown(null)} title="Rincian Target & Capaian Pundi per Amil">
                {selectedPundiBreakdown && (
                    <div className="space-y-5">
                        <div className="p-4 bg-gradient-to-br from-wiz-green to-wiz-green_dark rounded-2xl text-white shadow-md relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-white/80 font-bold">Total Terkumpul (Semua Amil)</p>
                                    <p className="text-2xl font-black mt-0.5">{formatRp(selectedPundiBreakdown.collected)}</p>
                                </div>
                                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold">
                                    {selectedPundiBreakdown.target > 0 ? Math.min(Math.round((selectedPundiBreakdown.collected / selectedPundiBreakdown.target) * 100), 100) : 0}% Target
                                </div>
                            </div>
                            <p className="text-xs text-white/70">Akumulasi Target Pundi: <span className="font-bold text-white">{formatRp(selectedPundiBreakdown.target)}</span></p>
                            <div className="w-full bg-black/20 rounded-full h-1.5 mt-3 overflow-hidden">
                                <div 
                                    className="bg-wiz-orange h-1.5 rounded-full" 
                                    style={{ width: `${selectedPundiBreakdown.target > 0 ? Math.min(Math.round((selectedPundiBreakdown.collected / selectedPundiBreakdown.target) * 100), 100) : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400 mb-3">
                                Kontribusi & Capaian Masing-Masing Amil:
                            </h4>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {(() => {
                                    const activePundiAmils = amils.map(amil => {
                                        const amilSpecificCampaigns = selectedPundiBreakdown.subCampaigns?.filter(p => p.assignedAmil === amil.name) || [];
                                        const amilTarget = amilSpecificCampaigns.reduce((sum, p) => sum + Number(p.target || 0), 0);

                                        const amilPundi = riwayatPundis
                                            .filter(r => r.amilName === amil.name && r.status === 'Berhasil')
                                            .reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                            
                                        const amilBoxes = pundis.filter(p => {
                                            const creator = p.createdBy || contacts.find(c => c.name === p.donorName)?.createdBy;
                                            return creator === amil.name && p.status === 'Aktif';
                                        }).length;

                                        const hasData = amilTarget > 0 || amilPundi > 0 || amilBoxes > 0;
                                        const amilPercent = amilTarget > 0 ? Math.min(Math.round((amilPundi / amilTarget) * 100), 100) : null;
                                        const shareOfTotal = selectedPundiBreakdown.collected > 0 
                                            ? Math.round((amilPundi / selectedPundiBreakdown.collected) * 100) 
                                            : 0;

                                        return { ...amil, amilTarget, amilPundi, amilBoxes, amilPercent, shareOfTotal, hasData };
                                    }).filter(a => a.hasData);

                                    if (activePundiAmils.length === 0) {
                                        return (
                                            <div className="p-6 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                                <i className="fa-solid fa-box-open text-3xl mb-2 opacity-50"></i>
                                                <p className="text-xs">Belum ada Amil yang memiliki kotak atau riwayat penarikan Pundi.</p>
                                            </div>
                                        );
                                    }

                                    return activePundiAmils.map(amil => (
                                        <div key={amil.id} className="p-4 bg-gray-50 dark:bg-gray-700/60 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-wiz-green/10 dark:bg-wiz-green/20 text-wiz-green dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                                                        {amil.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{amil.name}</p>
                                                        <p className="text-[11px] text-gray-400 dark:text-gray-400 flex items-center gap-1.5">
                                                            <span><i className="fa-solid fa-box-open text-wiz-orange"></i> {amil.amilBoxes} Kotak Aktif</span>
                                                            <span>•</span>
                                                            <span>{amil.shareOfTotal}% dari total</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-wiz-green dark:text-emerald-400 text-sm">{formatRp(amil.amilPundi)}</p>
                                                    {amil.amilTarget > 0 && (
                                                        <p className="text-[11px] text-gray-400">Target: {formatRp(amil.amilTarget)}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {amil.amilTarget > 0 ? (
                                                <div>
                                                    <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1">
                                                        <span>Ketercapaian Target Khusus</span>
                                                        <span className="text-wiz-orange font-bold">{amil.amilPercent}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                                                        <div 
                                                            className="bg-wiz-green dark:bg-emerald-500 h-1.5 rounded-full" 
                                                            style={{ width: `${amil.amilPercent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-gray-400 italic">Target kolektif (tanpa batas target personal).</p>
                                            )}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                            <Button variant="secondary" onClick={() => setSelectedPundiBreakdown(null)}>Tutup</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
