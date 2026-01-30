import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, Upload, Loader2, Save, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ProviderManager() {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);

    // New Provider Form State
    const [newProvider, setNewProvider] = useState({
        name: '',
        nif: '',
        address: '',
        sampleFile: null,
        previewUrl: null
    });
    const [analyzing, setAnalyzing] = useState(false);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const { data, error } = await supabase
                .from('providers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProviders(data || []);
        } catch (err) {
            console.error('Error fetching providers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileDrop = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setNewProvider({ ...newProvider, sampleFile: file, previewUrl: objectUrl });
        setAnalyzing(true);
        setVerified(false);

        try {
            // 1. Convert to base64
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.readAsDataURL(file);
            });

            // 2. Call Edge Function to extract data
            // We pass the "Golden Records" (known providers) context from client to help the AI
            const goldenRecords = providers
                .filter(p => p.extraction_config)
                .map(p => ({
                    name: p.name,
                    nif: p.nif,
                    config: p.extraction_config
                }));

            const { data, error } = await supabase.functions.invoke('process-document', {
                body: {
                    file: base64Data,
                    fileType: file.type,
                    knownProviders: goldenRecords
                }
            });

            if (error) throw error;

            // 3. Pre-fill form if data found
            if (data.factures && data.factures.length > 0) {
                const firstInv = data.factures[0];
                setNewProvider(prev => ({
                    ...prev,
                    name: firstInv.proveedor || '',
                    nif: firstInv.nif_proveedor || '',
                    sampleFile: file,
                    previewUrl: objectUrl, // Keep preview
                    sampleData: firstInv
                }));
                // Auto-verify if name and nif are present
                if (firstInv.proveedor && firstInv.nif_proveedor) {
                    // But let user confirm manually
                }
            } else {
                alert("No s'han pogut extreure dades automàticament. Si us plau, omple-les manualment.");
            }

        } catch (err) {
            console.error('Al Analysis Error:', err);
            alert('Error analitzant el fitxer. Omple les dades manualment.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSaveProvider = async () => {
        if (!newProvider.name) return alert("EL nom del proveïdor és obligatori");

        setAnalyzing(true);
        try {
            let sampleUrl = null;

            // 1. Upload sample file if exists
            if (newProvider.sampleFile) {
                const fileExt = newProvider.sampleFile.name.split('.').pop();
                const fileName = `provider_samples/${Date.now()}_${newProvider.name.replace(/\s+/g, '_')}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('factures') // Reusing existing bucket
                    .upload(fileName, newProvider.sampleFile, {
                        contentType: newProvider.sampleFile.type,
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('factures')
                    .getPublicUrl(fileName);

                sampleUrl = urlData.publicUrl;
            }

            // 2. Insert into DB
            const { error: insertError } = await supabase
                .from('providers')
                .insert([{
                    name: newProvider.name,
                    nif: newProvider.nif,
                    address: newProvider.address,
                    sample_invoice_url: sampleUrl,
                    extraction_config: newProvider.sampleData
                }]);

            if (insertError) throw insertError;

            // 3. Reset
            setIsAdding(false);
            setNewProvider({
                name: '',
                nif: '',
                address: '',
                sampleFile: null,
                previewUrl: null,
                sampleData: null
            });
            setVerified(false);
            fetchProviders();
            alert("✅ Proveïdor afegit correctament!");

        } catch (err) {
            console.error('Error saving provider:', err);
            alert('Error guardant el proveïdor: ' + err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const deleteProvider = async (id) => {
        if (!confirm("Segur que vols eliminar aquest proveïdor?")) return;

        try {
            const { error } = await supabase.from('providers').delete().eq('id', id);
            if (error) throw error;
            fetchProviders();
        } catch (err) {
            alert("Error eliminant: " + err.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg text-slate-300 font-medium">Llistat de Proveïdors ({providers.length})</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
                >
                    <Plus size={18} /> Afegir Proveïdor
                </button>
            </div>

            {isAdding && (
                <div className="mb-8 p-6 bg-slate-700/50 rounded-xl border border-emerald-500/30 animate-in fade-in slide-in-from-top-4">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                        <FileText className="text-emerald-400" /> Nou Proveïdor
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* File Upload Zone */}
                        <div className="border-2 border-dashed border-slate-500 hover:border-emerald-400 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors bg-slate-800/50 relative min-h-[300px]">
                            {analyzing ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                    <span className="text-slate-300 text-sm">Analitzant factura amb IA...</span>
                                </div>
                            ) : newProvider.previewUrl ? (
                                <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden rounded-lg">
                                    {newProvider.sampleFile?.type.includes('pdf') ? (
                                        <iframe
                                            src={newProvider.previewUrl}
                                            className="w-full h-full min-h-[300px] rounded-lg pointer-events-none"
                                            title="Preview"
                                        />
                                    ) : (
                                        <img
                                            src={newProvider.previewUrl}
                                            alt="Preview"
                                            className="max-h-[300px] rounded-lg object-contain shadow-lg"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <p className="text-white font-medium bg-black/80 px-4 py-2 rounded-lg pointer-events-none">
                                            Clic per canviar fitxer
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileDrop}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 text-slate-400 mb-3" />
                                    <p className="text-slate-300 font-medium mb-1">Arrossega una factura d'exemple</p>
                                    <p className="text-slate-500 text-xs mb-4">La IA extraurà automàticament les dades i es previsualitzarà aquí</p>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileDrop}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </>
                            )}
                        </div>

                        {/* Form Fields & Data Preview */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Nom Proveïdor *</label>
                                <input
                                    type="text"
                                    value={newProvider.name}
                                    onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Ex: Mercadona..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">NIF / CIF</label>
                                    <input
                                        type="text"
                                        value={newProvider.nif}
                                        onChange={e => setNewProvider({ ...newProvider, nif: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="A12345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Adreça</label>
                                    <input
                                        type="text"
                                        value={newProvider.address}
                                        onChange={e => setNewProvider({ ...newProvider, address: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Carrer Exemple, 123"
                                    />
                                </div>
                            </div>



                            {/* Fiscal Data Preview */}
                            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                                <h5 className="text-slate-400 text-xs uppercase tracking-wider mb-3">Dades Fiscals Extretes (Mostra)</h5>

                                {newProvider.sampleData ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-1">Data Factura</label>
                                                <input
                                                    type="text"
                                                    value={newProvider.sampleData.data || ''}
                                                    onChange={(e) => setNewProvider({
                                                        ...newProvider,
                                                        sampleData: { ...newProvider.sampleData, data: e.target.value }
                                                    })}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm font-mono focus:border-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-1 flex justify-between">
                                                    <span>Total Factura</span>
                                                    {(() => {
                                                        const total = parseFloat(newProvider.sampleData.total_factura || 0);
                                                        let calculated = 0;
                                                        ['21', '10', '5', '4', '2'].forEach(rate => {
                                                            calculated += parseFloat(newProvider.sampleData[`base_iva_${rate}`] || 0);
                                                            calculated += parseFloat(newProvider.sampleData[`import_iva_${rate}`] || 0);
                                                        });
                                                        calculated += parseFloat(newProvider.sampleData.base_exempte || 0);
                                                        calculated -= parseFloat(newProvider.sampleData.import_irpf || 0); // Subtract IRPF

                                                        // Allow small margin of error for float
                                                        return Math.abs(total - calculated) < 0.05 ? (
                                                            <span className="text-emerald-400 flex items-center gap-1 font-bold"><CheckCircle size={12} /> Correcte</span>
                                                        ) : (
                                                            <span className="text-amber-500/80 font-mono text-[10px]">Calc: {calculated.toFixed(2)}€</span>
                                                        );
                                                    })()}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={newProvider.sampleData.total_factura || ''}
                                                        onChange={(e) => setNewProvider({
                                                            ...newProvider,
                                                            sampleData: { ...newProvider.sampleData, total_factura: e.target.value }
                                                        })}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-emerald-400 font-bold font-mono text-right focus:border-emerald-500 outline-none"
                                                    />
                                                    <span className="absolute right-8 top-1.5 text-slate-500 text-xs">€</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Breakdown Table - Editable */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px] text-slate-300">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-slate-500">
                                                        <th className="text-left py-1 w-20">Tipus</th>
                                                        <th className="text-right py-1">Base</th>
                                                        <th className="text-right py-1">Quota</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {['21', '10', '5', '4', '2'].map(rate => (
                                                        <tr key={rate}>
                                                            <td className="py-1 flex items-center gap-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!newProvider.sampleData[`base_iva_${rate}`]}
                                                                    onChange={(e) => {
                                                                        const isChecked = e.target.checked;
                                                                        setNewProvider({
                                                                            ...newProvider,
                                                                            sampleData: {
                                                                                ...newProvider.sampleData,
                                                                                [`base_iva_${rate}`]: isChecked ? 0 : null,
                                                                                [`import_iva_${rate}`]: isChecked ? 0 : null
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-0 w-3 h-3"
                                                                />
                                                                <span>IVA {rate}%</span>
                                                            </td>
                                                            <td className="text-right py-1">
                                                                {newProvider.sampleData[`base_iva_${rate}`] !== null && newProvider.sampleData[`base_iva_${rate}`] !== undefined && (
                                                                    <input
                                                                        type="number" step="0.01"
                                                                        value={newProvider.sampleData[`base_iva_${rate}`]}
                                                                        onChange={(e) => setNewProvider({
                                                                            ...newProvider,
                                                                            sampleData: { ...newProvider.sampleData, [`base_iva_${rate}`]: e.target.value }
                                                                        })}
                                                                        className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-slate-200 focus:border-emerald-500 outline-none text-xs"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="text-right py-1">
                                                                {newProvider.sampleData[`import_iva_${rate}`] !== null && newProvider.sampleData[`import_iva_${rate}`] !== undefined && (
                                                                    <input
                                                                        type="number" step="0.01"
                                                                        value={newProvider.sampleData[`import_iva_${rate}`]}
                                                                        onChange={(e) => setNewProvider({
                                                                            ...newProvider,
                                                                            sampleData: { ...newProvider.sampleData, [`import_iva_${rate}`]: e.target.value }
                                                                        })}
                                                                        className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-slate-200 focus:border-emerald-500 outline-none text-xs"
                                                                    />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {/* Exempte */}
                                                    <tr>
                                                        <td className="py-1 text-teal-400 flex items-center gap-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={newProvider.sampleData.base_exempte !== undefined && newProvider.sampleData.base_exempte !== null && newProvider.sampleData.base_exempte !== 0}
                                                                onChange={(e) => {
                                                                    setNewProvider({
                                                                        ...newProvider,
                                                                        sampleData: {
                                                                            ...newProvider.sampleData,
                                                                            base_exempte: e.target.checked ? 0 : 0
                                                                        }
                                                                    });
                                                                }}
                                                                className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-0 w-3 h-3"
                                                            />
                                                            Exempte
                                                        </td>
                                                        <td className="text-right py-1">
                                                            <input
                                                                type="number" step="0.01"
                                                                value={newProvider.sampleData.base_exempte || 0}
                                                                onChange={(e) => setNewProvider({
                                                                    ...newProvider,
                                                                    sampleData: { ...newProvider.sampleData, base_exempte: e.target.value }
                                                                })}
                                                                className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-slate-200 focus:border-emerald-500 outline-none text-xs"
                                                            />
                                                        </td>
                                                        <td className="text-right py-1 text-slate-600">-</td>
                                                    </tr>

                                                    {/* IRPF */}
                                                    <tr>
                                                        <td className="py-1 text-orange-400 flex items-center gap-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!newProvider.sampleData.import_irpf}
                                                                onChange={(e) => {
                                                                    setNewProvider({
                                                                        ...newProvider,
                                                                        sampleData: {
                                                                            ...newProvider.sampleData,
                                                                            import_irpf: e.target.checked ? 0 : 0,
                                                                            base_irpf: e.target.checked ? 0 : 0
                                                                        }
                                                                    });
                                                                }}
                                                                className="rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-0 w-3 h-3"
                                                            />
                                                            IRPF
                                                        </td>
                                                        <td className="text-right py-1">
                                                            <input
                                                                type="number" step="0.01"
                                                                placeholder="Base"
                                                                value={newProvider.sampleData.base_irpf || 0}
                                                                onChange={(e) => setNewProvider({
                                                                    ...newProvider,
                                                                    sampleData: { ...newProvider.sampleData, base_irpf: e.target.value }
                                                                })}
                                                                className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-slate-200 focus:border-emerald-500 outline-none text-xs"
                                                            />
                                                        </td>
                                                        <td className="text-right py-1">
                                                            <input
                                                                type="number" step="0.01"
                                                                placeholder="Retenció"
                                                                value={newProvider.sampleData.import_irpf || 0}
                                                                onChange={(e) => setNewProvider({
                                                                    ...newProvider,
                                                                    sampleData: { ...newProvider.sampleData, import_irpf: e.target.value }
                                                                })}
                                                                className="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-red-300 focus:border-emerald-500 outline-none text-xs"
                                                            />
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 text-center py-4 bg-slate-900/50 rounded border border-dashed border-slate-700">
                                        Pujant la mostra apareixerà aquí el desglossament...
                                    </div>
                                )}
                            </div>

                            {/* JSON Debug Preview (Collapsed) */}
                            {newProvider.sampleData && (
                                <div className="text-[10px] text-slate-500 font-mono bg-slate-900/50 p-2 rounded overflow-hidden h-16 opacity-50 hover:opacity-100 transition-opacity">
                                    {JSON.stringify(newProvider.sampleData).slice(0, 150)}...
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
                                >
                                    Cancel·lar
                                </button>
                                <button
                                    onClick={handleSaveProvider}
                                    disabled={analyzing || !newProvider.name}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Confirmar i Guardar
                                </button>
                            </div>
                        </div>
                    </div>

                    {newProvider.name && newProvider.nif && !verified && (
                        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-amber-200 text-sm font-medium">Revisa les dades!</p>
                                <p className="text-amber-400/80 text-xs">Assegura't que el Nom i el NIF extrets per la IA són correctes abans de guardar. Aquesta informació s'utilitzarà per entrenar tot el sistema.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Grid of Providers */}
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-slate-500 animate-spin" /></div>
            ) : providers.length === 0 ? (
                <div className="text-center p-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                    <p className="text-slate-400">Encara no hi ha proveïdors configurats.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {providers.map(prov => (
                        <div
                            key={prov.id}
                            onClick={(e) => {
                                // Prevent opening if clicking delete button
                                if (e.target.closest('button')) return;
                                setSelectedProvider(prov);
                            }}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all hover:shadow-lg group relative"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white text-lg">{prov.name}</h4>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    deleteProvider(prov.id);
                                }} className="text-slate-600 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 text-sm">
                                <p className="text-slate-400 flex justify-between">
                                    <span>NIF:</span> <span className="text-slate-200 font-mono">{prov.nif || '-'}</span>
                                </p>
                                <p className="text-slate-500 truncate">{prov.address || 'Sense adreça'}</p>
                            </div>
                            {prov.sample_invoice_url && (
                                <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 text-xs text-emerald-400">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Entrenament actiu (1 mostra)</span>
                                </div>
                            )}
                        </div>
                    ))}

                </div>
            )
            }

            {/* Detail Modal */}
            {
                selectedProvider && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setSelectedProvider(null)}>
                        <div className="bg-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-6 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedProvider.name}</h2>
                                    <p className="text-slate-400 font-mono text-sm">{selectedProvider.nif || 'Sense NIF'}</p>
                                </div>
                                <button onClick={() => setSelectedProvider(null)} className="text-slate-400 hover:text-white p-2 text-xl font-bold">✕</button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                {/* Left: Invoice Preview */}
                                <div className="w-full md:w-1/2 p-6 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                                    <h3 className="text-emerald-400 font-medium mb-4 flex items-center gap-2">
                                        <FileText size={18} /> Factura d'exemple
                                    </h3>
                                    <div className="flex-1 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 relative">
                                        {selectedProvider.sample_invoice_url ? (
                                            selectedProvider.sample_invoice_url.toLowerCase().includes('pdf') ? (
                                                <iframe src={selectedProvider.sample_invoice_url} className="w-full h-full" title="Invoice" />
                                            ) : (
                                                <img src={selectedProvider.sample_invoice_url} className="w-full h-full object-contain" alt="Invoice" />
                                            )
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-500">Cap mostra disponible</div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Extracted DNA */}
                                <div className="w-full md:w-1/2 p-6 overflow-y-auto">
                                    <h3 className="text-emerald-400 font-medium mb-4 flex items-center gap-2">
                                        <CheckCircle size={18} /> Dades 'ADN' Extretes
                                    </h3>

                                    {selectedProvider.extraction_config ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Data Factura</label>
                                                    <div className="text-white font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded text-sm">
                                                        {selectedProvider.extraction_config.data || '-'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Total Factura</label>
                                                    <div className="text-emerald-400 font-bold font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded text-sm text-right">
                                                        {selectedProvider.extraction_config.total_factura || '0.00'} €
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-slate-700 overflow-hidden">
                                                <table className="w-full text-xs text-slate-300">
                                                    <thead className="bg-slate-900/50">
                                                        <tr className="text-slate-500 border-b border-slate-700">
                                                            <th className="text-left py-2 px-3">Concepte</th>
                                                            <th className="text-right py-2 px-3">Base</th>
                                                            <th className="text-right py-2 px-3">Quota</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800 bg-slate-800/30">
                                                        {['21', '10', '5', '4', '2'].map(rate => {
                                                            const base = selectedProvider.extraction_config[`base_iva_${rate}`];
                                                            const quota = selectedProvider.extraction_config[`import_iva_${rate}`];
                                                            if (!base && !quota) return null;
                                                            return (
                                                                <tr key={rate}>
                                                                    <td className="py-2 px-3">IVA {rate}%</td>
                                                                    <td className="text-right py-2 px-3 font-mono text-slate-200">{base}</td>
                                                                    <td className="text-right py-2 px-3 font-mono text-slate-200">{quota}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {selectedProvider.extraction_config.base_exempte > 0 && (
                                                            <tr>
                                                                <td className="py-2 px-3 text-teal-400">Exempte</td>
                                                                <td className="text-right py-2 px-3 font-mono text-slate-200">{selectedProvider.extraction_config.base_exempte}</td>
                                                                <td className="text-right py-2 px-3">-</td>
                                                            </tr>
                                                        )}
                                                        {selectedProvider.extraction_config.import_irpf > 0 && (
                                                            <tr>
                                                                <td className="py-2 px-3 text-orange-400">IRPF ({selectedProvider.extraction_config.percentatge_irpf || 0}%)</td>
                                                                <td className="text-right py-2 px-3 font-mono text-slate-200">{selectedProvider.extraction_config.base_irpf}</td>
                                                                <td className="text-right py-2 px-3 font-mono text-red-400">-{selectedProvider.extraction_config.import_irpf}</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="p-3 bg-amber-900/10 border border-amber-500/20 rounded text-xs text-amber-500/80">
                                                Aquestes dades s'utilitzen com a referència "Golden Record" per a l'entrenament de la IA amb aquest proveïdor.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-800/50 rounded border border-dashed border-slate-700">
                                            <AlertTriangle className="mb-2 opacity-50" />
                                            <p>No hi ha dades d'extracció configurades.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
