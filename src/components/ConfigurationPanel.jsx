import React from 'react';
import ProviderManager from './ProviderManager';
import { Settings, Sun, Moon } from 'lucide-react';

export default function ConfigurationPanel({ isDarkMode, toggleTheme }) {
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-8 transition-colors duration-200">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Settings className="w-8 h-8 text-slate-700 dark:text-slate-200" />
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Configuració del Sistema</h1>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm"
                    >
                        {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
                        <span className="font-medium">{isDarkMode ? 'Mode Dia' : 'Mode Nit'}</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Gestió de Proveïdors */}
                    <section className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                        <div className="p-6 bg-slate-800 border-b border-slate-700">
                            <h2 className="text-xl font-semibold text-white">Gestió de Proveïdors Recurrents</h2>
                            <p className="text-slate-400 mt-1">Configura els proveïdors habituals i puja exemples de factures per millorar la precisió de l'IA.</p>
                        </div>
                        <div className="p-6">
                            <ProviderManager />
                        </div>
                    </section>

                    {/* Configuració Gmail - Missatge informatiu */}
                    <section className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                        <div className="p-6 bg-slate-800 border-b border-slate-700">
                            <h2 className="text-xl font-semibold text-white">Integració Gmail</h2>
                            <p className="text-slate-400 mt-1">La connexió està configurada correctament amb les claus del sistema.</p>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-400">
                                L'aplicació està connectada al teu compte i busca automàticament les factures amb l'etiqueta <span className="text-emerald-400 font-mono">"factures pendents"</span>. Un cop processades, es mouen automàticament a <span className="text-blue-400 font-mono">"factures escanejades"</span>.
                            </p>
                        </div>
                    </section>

                    {/* Futured Configs */}
                    {/* <section className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6 opacity-50">
             <h2 className="text-xl font-semibold text-white">Configuració d'Usuaris</h2>
             <p className="text-slate-400">Pròximament...</p>
          </section> */}
                </div>
            </div>
        </div>
    );
}
