const { useState } = React;

const LoginScreen = ({ onLogin, onForgot, notice, amilsData, darkMode, setDarkMode, onRefresh, isRefreshing }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Silakan lengkapi email dan password.');
            return;
        }
        onLogin(email, password, setError);
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-wiz-light dark:bg-gray-900 transition-colors duration-200">
            {/* Background Ornaments */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-wiz-green/10 dark:bg-wiz-green/20 blur-[80px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-wiz-orange/10 dark:bg-wiz-orange/20 blur-[100px]"></div>

            <div className="w-full max-w-md p-4 relative z-10 slide-up">
                <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white dark:border-gray-700">
                    
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex items-center justify-center mb-6">
                            <img 
                                src="https://drive.google.com/uc?id=1TcpcZtGKBKAOBAthf6Rea4HHDZ0l9tBU" 
                                alt="Logo WIZ" 
                                className="h-14 object-contain"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                            />
                            <div style={{display: 'none'}} className="text-[2.75rem] font-black text-wiz-green dark:text-emerald-400 tracking-tighter">WIZ<span className="text-wiz-orange">BERAU</span></div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Portal Amil WIZ</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Masuk untuk mengelola data WIZ BERAU</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {(error || notice) && (
                            <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 p-3 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in">
                                <i className="fa-solid fa-circle-xmark"></i>
                                <p className="text-sm font-medium">{error || notice}</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email Akses</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fa-solid fa-envelope text-gray-400"></i>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-wiz-green/20 focus:border-wiz-green focus:bg-white dark:focus:bg-gray-700 transition-all outline-none"
                                    placeholder="Masukkan email"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kata Sandi</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fa-solid fa-lock text-gray-400"></i>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-wiz-green/20 focus:border-wiz-green focus:bg-white dark:focus:bg-gray-700 transition-all outline-none"
                                    placeholder="••••••••"
                                />
                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-2 text-gray-400 hover:text-wiz-green dark:hover:text-emerald-400 focus:outline-none transition-colors rounded-lg"
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <Button type="submit" variant="accent" className="w-full py-3.5 text-[15px] mt-2 shadow-wiz-orange/30">
                            Masuk ke Dashboard <i className="fa-solid fa-arrow-right-to-bracket ml-1"></i>
                        </Button>
                        {typeof firebaseConfig !== 'undefined' && (
                            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">Terhubung ke proyek: {firebaseConfig.projectId}</p>
                        )}

                        {window.location.hash === '#debug' && <div className="text-[10px] leading-snug text-gray-400 dark:text-gray-500 break-words">
                            <div>Versi: 2026-10-22-g</div>
                            {(() => { try { return JSON.parse(localStorage.getItem('wiz_debug_log') || '[]').slice(-6).map((l, i) => <div key={i}>{l}</div>); } catch (e) { return null; } })()}
                        </div>}

                        {/* Tombol Refresh & Mode Malam */}
                        <div className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/70">
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isRefreshing}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-50 dark:bg-gray-700/60 hover:bg-wiz-green/10 dark:hover:bg-emerald-950/40 border border-gray-200 dark:border-gray-600 hover:border-wiz-green/30 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-wiz-green dark:hover:text-emerald-400 transition-all shadow-sm active:scale-95"
                                title="Segarkan Data Server"
                            >
                                <i className={`fa-solid fa-rotate text-sm ${isRefreshing ? 'fa-spin text-wiz-green dark:text-emerald-400' : ''}`}></i>
                                <span>{isRefreshing ? 'Menyinkron...' : 'Segarkan Data'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDarkMode(!darkMode)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-50 dark:bg-gray-700/60 hover:bg-wiz-orange/10 dark:hover:bg-amber-950/40 border border-gray-200 dark:border-gray-600 hover:border-wiz-orange/30 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-wiz-orange dark:hover:text-amber-400 transition-all shadow-sm active:scale-95"
                                title={darkMode ? "Mode Terang" : "Mode Gelap"}
                            >
                                <i className={`fa-solid ${darkMode ? 'fa-sun text-yellow-400' : 'fa-moon text-gray-500 dark:text-gray-400'} text-sm`}></i>
                                <span>{darkMode ? 'Mode Terang' : 'Mode Gelap'}</span>
                            </button>
                        </div>
                    </form>
                </div>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 font-medium tracking-wide uppercase">
                    &copy; 2026 Wahdah Inspirasi Zakat Berau
                </p>
            </div>
        </div>
    );
};

if (typeof window !== 'undefined') window.LoginScreen = LoginScreen;
