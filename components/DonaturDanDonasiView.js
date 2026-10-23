// Komponen Manajemen Direktori Donatur & Penerimaan Donasi Reguler

const DonaturDanDonasiView = ({ contactConfig, donationConfig, isAdmin }) => {
    const [activeSubTab, setActiveSubTab] = useState('donatur');
    return (
        <div className="space-y-6 slide-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        <i className="fa-solid fa-hand-holding-heart text-wiz-green mr-2"></i> Donatur & Penerimaan
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Pusat manajemen direktori donatur dan histori donasi ZISWAF reguler.
                    </p>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full hide-scrollbar">
                <button 
                    onClick={() => setActiveSubTab('donatur')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${activeSubTab === 'donatur' ? 'bg-wiz-green text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                >
                    <i className="fa-solid fa-address-book"></i> Direktori Donatur
                </button>
                <button 
                    onClick={() => setActiveSubTab('donasi')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${activeSubTab === 'donasi' ? 'bg-wiz-green text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                >
                    <i className="fa-solid fa-hand-holding-dollar"></i> Penerimaan Reguler
                </button>
            </div>

            {activeSubTab === 'donatur' && (
                <div className="animate-in">
                    <ModuleView {...contactConfig} canAdd={true} canEdit={isAdmin} canDelete={isAdmin} />
                </div>
            )}
            {activeSubTab === 'donasi' && (
                <div className="animate-in">
                    <ModuleView {...donationConfig} canAdd={true} canEdit={isAdmin} canDelete={isAdmin} />
                </div>
            )}
        </div>
    );
};
