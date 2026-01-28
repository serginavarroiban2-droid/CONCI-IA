import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, Loader2, Eye, AlertCircle, Edit2, Save, X, Printer, ExternalLink, FileDown, FileUp, Scan } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail gracefully if config is missing (for local dev without env vars)
const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default function InvoiceScannerMulti() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [previewSize, setPreviewSize] = useState(40);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const STORAGE_KEY = 'invoices-data-fusion-v1';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInvoices(parsed);
        setSaveStatus(`✓ ${parsed.length} factures carregades`);
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (err) {
      console.error('Error carregant:', err);
    }
  }, []);

  const saveToStorage = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('✓ Guardat:', data.length, 'factures');
      return true;
    } catch (err) {
      console.error('Error guardant:', err);
      alert('Error guardant les dades. Exporta un backup!');
      return false;
    }
  };

  const exportJSON = () => {
    const data = {
      version: '2.0', // Updated version for Fusion
      exported: new Date().toISOString(),
      count: invoices.length,
      invoices: invoices
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factures_fusion_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSaveStatus('✓ Backup JSON descarregat');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.invoices && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
          saveToStorage(data.invoices);
          setSaveStatus(`✓ ${data.invoices.length} factures importades`);
          setTimeout(() => setSaveStatus(''), 3000);
        } else {
          alert('Format JSON invalid');
        }
      } catch (err) {
        alert('Error llegint el fitxer: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleRevisat = (inv) => {
    const updated = { ...inv, revisat: !inv.revisat };
    const newList = invoices.map(i => i.id === inv.id ? updated : i);
    setInvoices(newList);
    if (selectedInvoice?.id === inv.id) setSelectedInvoice(updated);
    saveToStorage(newList);
  };

  const startEdit = (inv) => {
    setEditingId(inv.id);
    setEditData({ ...inv });
  };

  const saveEdit = () => {
    const newList = invoices.map(i => i.id === editingId ? editData : i);
    setInvoices(newList);
    if (selectedInvoice?.id === editingId) setSelectedInvoice(editData);
    setEditingId(null);
    saveToStorage(newList);
  };

  const updateField = (f, v) => setEditData(p => ({ ...p, [f]: v }));

  const downloadPDF = (inv) => {
    try {
      const base64 = inv.imageUrl.split(',')[1];
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = inv.fileName || `factura_${inv.ultima_4_digits_numero_factura || Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error descarregant el PDF');
    }
  };

  const openInWindow = (inv) => {
    if (inv.fileType === 'application/pdf') {
      downloadPDF(inv);
    } else {
      const newWin = window.open('', '_blank', 'width=900,height=800');
      if (!newWin) {
        alert('Permet finestres emergents');
        return;
      }
      newWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura</title><style>body{margin:0;background:#1e293b;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}.hdr{width:100%;background:#334155;color:#fff;padding:15px 20px;box-sizing:border-box;position:fixed;top:0;left:0;z-index:10}.hdr h2{font-size:18px;margin:0 0 5px 0}.hdr p{font-size:12px;margin:0;opacity:0.8}img{max-width:90%;max-height:calc(100vh - 100px);margin-top:80px;box-shadow:0 4px 20px rgba(0,0,0,0.5)}</style></head><body><div class="hdr"><h2>Factura ...${inv.ultima_4_digits_numero_factura || ''} - ${inv.proveedor || ''}</h2><p>Data: ${inv.data || ''} | Total: ${inv.total_factura || '0'}€</p></div><img src="${inv.imageUrl}" alt="Factura"/></body></html>`);
      newWin.document.close();
    }
  };

  const printAll = () => {
    const w = window.open('', '_blank');
    const h = invoices.map(i => `<div style="page-break-after:always;padding:20px"><h3>...${i.ultima_4_digits_numero_factura || ''} - ${i.proveedor || ''}</h3><p>Data: ${i.data || ''} | Total: ${i.total_factura || '0'}€</p>${i.fileType === 'application/pdf' ? '<p>PDF</p>' : `<img src="${i.imageUrl}" style="max-width:100%">`}</div>`).join('');
    w.document.write(`<html><head><title>Factures</title></head><body>${h}</body></html>`);
    w.document.close();
    w.print();
  };

  const analyzeMultiPageInvoice = async (file) => {
    if (!supabase) {
      alert('Error: Supabase client not initialized. Check Env Vars.');
      return;
    }

    console.log('Iniciant analisi amb Gemini...', file.name, file.size, 'bytes');
    setLoading(true);
    setError(null);
    setSaveStatus('Processant...');

    const maxSize = 5 * 1024 * 1024; // 5MB max
    if (file.size > maxSize) {
      setError('Fitxer massa gran. Maxim 5MB. Prova amb un PDF mes petit o una imatge comprimida.');
      setLoading(false);
      return;
    }

    try {
      console.log('Llegint fitxer...');
      setSaveStatus('Llegint fitxer...');

      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result.split(',')[1];
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Error llegint fitxer'));
        reader.readAsDataURL(file);
      });

      const fileDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Error llegint preview'));
        reader.readAsDataURL(file);
      });

      console.log('Enviant a Supabase Edge Function (Gemini)...');
      setSaveStatus('Analitzant amb Gemini...');

      const { data, error: funcError } = await supabase.functions.invoke('process-document', {
        body: { file: base64Data, fileType: file.type }
      });

      if (funcError) throw funcError;
      if (data.error) throw new Error(data.error);

      console.log('Resposta Gemini:', data);

      const facturesArray = data.factures || [];
      if (facturesArray.length === 0) {
        throw new Error('No s\'han trobat factures');
      }

      const baseId = Date.now();
      const newInvoices = [];
      for (let i = 0; i < facturesArray.length; i++) {
        const invoiceData = facturesArray[i];
        invoiceData.id = baseId + (i * 1000);
        invoiceData.imageUrl = fileDataUrl;
        invoiceData.fileName = `${file.name} (Pagina ${i + 1}/${facturesArray.length})`;
        invoiceData.fileType = file.type;
        // Initialize numeric fields to 0 if missing/null to avoid issues in calculations
        ['base_iva_2', 'import_iva_2', 'base_iva_4', 'import_iva_4', 'base_iva_5', 'import_iva_5',
          'base_iva_10', 'import_iva_10', 'base_iva_21', 'import_iva_21', 'base_exempte',
          'base_irpf', 'percentatge_irpf', 'import_irpf'].forEach(k => {
            if (!invoiceData[k]) invoiceData[k] = 0;
          });

        newInvoices.push(invoiceData);
      }

      const reversedInvoices = [...newInvoices].reverse();
      const finalList = [...reversedInvoices, ...invoices];
      setInvoices(finalList);
      setSelectedInvoice(newInvoices[0] || null);

      saveToStorage(finalList);

      setSaveStatus(`✓ ${facturesArray.length} factures afegides`);
      setTimeout(() => setSaveStatus(''), 3000);

    } catch (err) {
      console.error('Error analitzant:', err);
      setError(err.message || 'Error desconegut');
      setSaveStatus('❌ Error');
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setTimeout(() => {
      analyzeMultiPageInvoice(file);
    }, 10);

    e.target.value = '';
  };

  const exportToCSV = () => {
    if (invoices.length === 0) return;
    const headers = [
      'DATA', 'NUM FACTURA', 'PROVEEDOR', 'NIF',
      'BASE 2%', 'IVA 2%', 'BASE 4%', 'IVA 4%', 'BASE 5%', 'IVA 5%',
      'BASE 10%', 'IVA 10%', 'BASE 21%', 'IVA 21%',
      'BASE EXEMPTE', 'BASE IRPF', '% IRPF', 'IMPORT IRPF',
      'TOTAL'
    ];
    const rows = invoices.map(inv => [
      inv.data || '',
      inv.ultima_4_digits_numero_factura || '',
      inv.proveedor || '',
      inv.nif_proveedor || '',
      (inv.base_iva_2 || 0).toString().replace('.', ','),
      (inv.import_iva_2 || 0).toString().replace('.', ','),
      (inv.base_iva_4 || 0).toString().replace('.', ','),
      (inv.import_iva_4 || 0).toString().replace('.', ','),
      (inv.base_iva_5 || 0).toString().replace('.', ','),
      (inv.import_iva_5 || 0).toString().replace('.', ','),
      (inv.base_iva_10 || 0).toString().replace('.', ','),
      (inv.import_iva_10 || 0).toString().replace('.', ','),
      (inv.base_iva_21 || 0).toString().replace('.', ','),
      (inv.import_iva_21 || 0).toString().replace('.', ','),
      (inv.base_exempte || 0).toString().replace('.', ','),
      (inv.base_irpf || 0).toString().replace('.', ','),
      (inv.percentatge_irpf || 0).toString().replace('.', ','),
      (inv.import_irpf || 0).toString().replace('.', ','),
      (inv.total_factura || '').toString().replace('.', ',')
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factures_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deleteInvoice = (id) => {
    const newList = invoices.filter(inv => inv.id !== id);
    setInvoices(newList);
    if (selectedInvoice?.id === id) setSelectedInvoice(null);
    saveToStorage(newList);
  };

  const clearAll = () => {
    if (!window.confirm('Esborrar tot?')) return;
    setInvoices([]);
    setSelectedInvoice(null);
    saveToStorage([]);
  };

  // Helper to render edit input
  const renderEditInput = (field, align = 'left') => (
    <input
      type="text"
      value={editData[field] || 0}
      onChange={e => updateField(field, e.target.value)}
      className={`w-full px-1 py-1 bg-slate-600 border border-slate-500 rounded text-xs text-slate-100 ${align === 'right' ? 'text-right' : ''}`}
      onClick={e => e.stopPropagation()}
    />
  );

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-[95%] mx-auto">
        <div className="bg-slate-800 rounded-lg shadow-xl p-6 mb-4 sticky top-0 z-20 border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scan className="w-8 h-8 text-emerald-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Projecte Fusió: Scanner + Conciliació</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-emerald-400">Powered by Gemini 1.5 Flash</span>
                  {saveStatus && <span className="text-xs text-slate-300">{saveStatus}</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {/* Scan Button Integrated in Sticky Header */}
              <input type="file" id="f_sticky" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" disabled={loading} />
              <label htmlFor="f_sticky" className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 text-sm font-bold shadow-lg transition-all ${loading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                {loading ? 'Analitzant...' : 'Escanejar amb Gemini'}
              </label>

              <div className="h-6 w-px bg-slate-600 mx-2"></div>

              <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm cursor-pointer">
                <FileUp className="w-4 h-4" />Import
                <input type="file" accept=".json" onChange={importJSON} className="hidden" />
              </label>
              <button onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm">
                <FileDown className="w-4 h-4" />Export JSON
              </button>
              {invoices.length > 0 && (
                <>
                  <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm">
                    <Download className="w-4 h-4" />CSV
                  </button>
                  <button onClick={clearAll} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {error && <div className="mt-3 p-2 bg-red-900/50 border border-red-500 rounded text-center"><p className="text-red-300 text-sm">{error}</p></div>}
        </div>

        {invoices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: `${100 - previewSize}`, minWidth: '600px' }} className="bg-slate-800 rounded-lg shadow-xl p-4">
              <h2 className="text-xl font-bold mb-4 text-slate-100">Registres Fiscals ({invoices.length})</h2>
              <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-[10px] sm:text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 z-10 shadow-md">
                    <tr className="border-b border-emerald-500/50 text-emerald-400">
                      <th className="p-2 text-left min-w-[80px]">DATA</th>
                      <th className="p-2 text-left">Nº FAC</th>
                      <th className="p-2 text-left min-w-[100px]">PROVEEDOR</th>
                      <th className="p-2 text-left">NIF</th>

                      <th className="p-2 text-right bg-slate-800/50">2%</th>
                      <th className="p-2 text-right bg-slate-800/50">4%</th>
                      <th className="p-2 text-right bg-slate-800/50">5%</th>
                      <th className="p-2 text-right bg-slate-800/50">10%</th>
                      <th className="p-2 text-right bg-slate-800/50">21%</th>

                      <th className="p-2 text-right text-teal-400">EXE</th>
                      <th className="p-2 text-right text-orange-400">IRPF</th>
                      <th className="p-2 text-right font-bold text-white">TOTAL</th>
                      <th className="p-2 text-center">ACC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {invoices.map(inv => (
                      <tr key={inv.id} className={`hover:bg-slate-700 group cursor-pointer transition-colors ${selectedInvoice?.id === inv.id ? 'bg-blue-900/20' : ''} ${inv.revisat ? 'bg-emerald-900/10' : ''}`} onClick={() => setSelectedInvoice(inv)}>
                        {editingId === inv.id ? (
                          <>
                            <td className="p-1">{renderEditInput('data')}</td>
                            <td className="p-1">{renderEditInput('ultima_4_digits_numero_factura')}</td>
                            <td className="p-1">{renderEditInput('proveedor')}</td>
                            <td className="p-1">{renderEditInput('nif_proveedor')}</td>

                            <td className="p-1 flex flex-col gap-1">
                              {renderEditInput('base_iva_2', 'right')}
                              {renderEditInput('import_iva_2', 'right')}
                            </td>
                            <td className="p-1">
                              {renderEditInput('base_iva_4', 'right')}
                              {renderEditInput('import_iva_4', 'right')}
                            </td>
                            <td className="p-1">
                              {renderEditInput('base_iva_5', 'right')}
                              {renderEditInput('import_iva_5', 'right')}
                            </td>
                            <td className="p-1">
                              {renderEditInput('base_iva_10', 'right')}
                              {renderEditInput('import_iva_10', 'right')}
                            </td>
                            <td className="p-1">
                              {renderEditInput('base_iva_21', 'right')}
                              {renderEditInput('import_iva_21', 'right')}
                            </td>

                            <td className="p-1">{renderEditInput('base_exempte', 'right')}</td>
                            <td className="p-1">
                              <div className="text-[9px] text-slate-400 text-right">%</div>
                              {renderEditInput('percentatge_irpf', 'right')}
                              <div className="text-[9px] text-slate-400 text-right">Imp</div>
                              {renderEditInput('import_irpf', 'right')}
                            </td>
                            <td className="p-1">{renderEditInput('total_factura', 'right')}</td>

                            <td className="p-1" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-1">
                                <button onClick={saveEdit} className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-500"><Save className="w-3 h-3" /></button>
                                <button onClick={() => setEditingId(null)} className="p-1 bg-red-600 rounded text-white hover:bg-red-500"><X className="w-3 h-3" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2 text-slate-300">{inv.data}</td>
                            <td className="p-2 text-slate-400">...{inv.ultima_4_digits_numero_factura}</td>
                            <td className="p-2 text-slate-200 font-medium">{inv.proveedor}</td>
                            <td className="p-2 text-slate-400">{inv.nif_proveedor}</td>

                            {/* Compact IVA Columns: Shows Base / Import */}
                            <td className="p-2 text-right text-slate-400">
                              {Number(inv.base_iva_2) > 0 ? (<div><div className="text-slate-200">{inv.base_iva_2}</div><div className="text-slate-500">{inv.import_iva_2}</div></div>) : '-'}
                            </td>
                            <td className="p-2 text-right text-slate-400">
                              {Number(inv.base_iva_4) > 0 ? (<div><div className="text-slate-200">{inv.base_iva_4}</div><div className="text-slate-500">{inv.import_iva_4}</div></div>) : '-'}
                            </td>
                            <td className="p-2 text-right text-slate-400">
                              {Number(inv.base_iva_5) > 0 ? (<div><div className="text-slate-200">{inv.base_iva_5}</div><div className="text-slate-500">{inv.import_iva_5}</div></div>) : '-'}
                            </td>
                            <td className="p-2 text-right text-slate-400">
                              {Number(inv.base_iva_10) > 0 ? (<div><div className="text-slate-200">{inv.base_iva_10}</div><div className="text-slate-500">{inv.import_iva_10}</div></div>) : '-'}
                            </td>
                            <td className="p-2 text-right text-slate-400">
                              {Number(inv.base_iva_21) > 0 ? (<div><div className="text-slate-200">{inv.base_iva_21}</div><div className="text-slate-500">{inv.import_iva_21}</div></div>) : '-'}
                            </td>

                            <td className="p-2 text-right text-teal-300">{Number(inv.base_exempte) > 0 ? inv.base_exempte : '-'}</td>
                            <td className="p-2 text-right text-orange-300">
                              {Number(inv.import_irpf) > 0 ? (<div>-{inv.import_irpf}<div className="text-[9px] text-orange-500">({inv.percentatge_irpf}%)</div></div>) : '-'}
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-400 text-sm">{inv.total_factura} €</td>

                            <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => toggleRevisat(inv)} className={`p-1 rounded ${inv.revisat ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-300'}`} title="Validar">
                                  {inv.revisat ? '✓' : ''}
                                </button>
                                <button onClick={() => startEdit(inv)} className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={() => deleteInvoice(inv.id)} className="p-1 bg-red-600 text-white rounded hover:bg-red-500"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ flex: `${previewSize}`, minWidth: '300px' }} className="bg-slate-800 rounded-lg shadow-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100"><Eye className="w-5 h-5 text-emerald-400" />Previsualització</h2>
                <input
                  type="range"
                  min="20"
                  max="60"
                  value={previewSize}
                  onChange={(e) => setPreviewSize(Number(e.target.value))}
                  className="w-24 accent-emerald-500"
                />
              </div>
              {selectedInvoice ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="bg-slate-700 p-3 rounded-lg mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-100 mb-1">{selectedInvoice.proveedor}</h3>
                        <p className="text-xs text-slate-400">Fitxer: {selectedInvoice.fileName}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-400">{selectedInvoice.total_factura}€</div>
                        <div className="text-xs text-slate-300">{selectedInvoice.data}</div>
                      </div>
                    </div>
                  </div>
                  <div className="border border-slate-600 rounded-lg overflow-auto flex-1 bg-slate-900 flex items-center justify-center">
                    {selectedInvoice.fileType === 'application/pdf' ? (
                      <div className="text-center p-8">
                        <FileText className="w-16 h-16 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-400">Vista prèvia no disponible per PDF multipàgina</p>
                        <button onClick={() => openInWindow(selectedInvoice)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Obrir en finestra</button>
                      </div>
                    ) : (
                      <img src={selectedInvoice.imageUrl} alt="Factura" className="max-w-full h-auto object-contain" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <p>Selecciona una factura</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}