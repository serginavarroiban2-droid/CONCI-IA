import React, { useState } from 'react';
import ReconciliationTool from './components/ReconciliationTool';
import InvoiceScanner from './components/InvoiceScanner';
import InvoiceChatBot from './components/InvoiceChatBot';
import { Scan, Banknote, Settings } from 'lucide-react';
import ConfigurationPanel from './components/ConfigurationPanel';

function App() {
  const [view, setView] = useState('reconcile'); // 'reconcile', 'scan', or 'config'
  // Default to true (Dark Mode) as requested by user initially
  const [isDarkMode, setIsDarkMode] = useState(true);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Global Navigation - Folder Tabs Style */}
      <nav className="pt-4 px-6 flex items-end gap-2 shrink-0 z-20 select-none">
        <button
          onClick={() => setView('scan')}
          className={`relative group px-6 py-3 rounded-t-xl transition-all duration-200 border-t border-x border-transparent ${view === 'scan'
            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold border-slate-300 dark:border-slate-700 translate-y-[1px] z-20'
            : 'bg-slate-200 dark:bg-slate-900/40 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 border-slate-300/50 dark:border-slate-800/50'
            }`}
        >
          <div className="flex items-center gap-3">
            <Scan size={20} className={view === 'scan' ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-50'} />
            <span className="text-sm tracking-wide">MÒDUL ESCÀNER</span>
          </div>
          {/* Active Tab Indicator/Connector */}
          {view === 'scan' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-white dark:bg-slate-900"></div>}
        </button>

        <button
          onClick={() => setView('reconcile')}
          className={`relative group px-6 py-3 rounded-t-xl transition-all duration-200 border-t border-x border-transparent ${view === 'reconcile'
            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold border-slate-300 dark:border-slate-700 translate-y-[1px] z-20'
            : 'bg-slate-200 dark:bg-slate-900/40 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 border-slate-300/50 dark:border-slate-800/50'
            }`}
        >
          <div className="flex items-center gap-3">
            <Banknote size={20} className={view === 'reconcile' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-50'} />
            <span className="text-sm tracking-wide">CONCILIACIÓ</span>
          </div>
          {view === 'reconcile' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-white dark:bg-slate-900"></div>}
        </button>

        <button
          onClick={() => setView('config')}
          className={`relative group px-6 py-3 rounded-t-xl transition-all duration-200 border-t border-x border-transparent ${view === 'config'
            ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold border-slate-300 dark:border-slate-700 translate-y-[1px] z-20'
            : 'bg-slate-200 dark:bg-slate-900/40 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 border-slate-300/50 dark:border-slate-800/50'
            }`}
        >
          <div className="flex items-center gap-3">
            <Settings size={20} className={view === 'config' ? 'text-slate-700 dark:text-slate-200' : 'opacity-50'} />
            <span className="text-sm tracking-wide">CONFIGURACIÓ</span>
          </div>
          {view === 'config' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-white dark:bg-slate-900"></div>}
        </button>
      </nav>

      {/* Main Content "Folder Body" */}
      <main className="flex-1 overflow-hidden relative z-10">
        <div className="absolute inset-0 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 shadow-2xl overflow-auto custom-scrollbar transition-colors duration-200">
          {view === 'reconcile' && <div className="min-h-full"><ReconciliationTool /></div>}
          {view === 'scan' && <div className="min-h-full"><InvoiceScanner /></div>}
          {view === 'config' && <div className="min-h-full"><ConfigurationPanel isDarkMode={isDarkMode} toggleTheme={toggleTheme} /></div>}
        </div>
      </main>

      {/* Global ChatBot */}
      <InvoiceChatBot />
    </div>
  );
}

export default App;