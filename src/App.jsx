import React, { useState } from 'react';
import ReconciliationTool from './components/ReconciliationTool';
import InvoiceScanner from './components/InvoiceScanner';
import { Scan, Banknote } from 'lucide-react';

function App() {
  const [view, setView] = useState('reconcile'); // 'reconcile' or 'scan'

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Global Navigation */}
      <nav className="bg-slate-900 text-white p-2 flex justify-center gap-4 shadow-lg z-[100]">
        <button
          onClick={() => setView('scan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${view === 'scan' ? 'bg-emerald-600 font-bold' : 'hover:bg-slate-800 text-slate-400'}`}
        >
          <Scan size={18} /> Mòdul Escàner (TaxVision Pro)
        </button>
        <button
          onClick={() => setView('reconcile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${view === 'reconcile' ? 'bg-indigo-600 font-bold' : 'hover:bg-slate-800 text-slate-400'}`}
        >
          <Banknote size={18} /> Conciliació (FinMatch)
        </button>
      </nav>

      <main className="flex-1 overflow-auto">
        {view === 'reconcile' ? <ReconciliationTool /> : <InvoiceScanner />}
      </main>
    </div>
  );
}

export default App;