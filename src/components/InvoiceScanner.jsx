import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Save,
  X,
  Mail,
  ChevronRight,
  ChevronLeft,
  Scan,
  Send,
  Calendar,
  DollarSign,
  Tag,
  Clock
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// --- SISTEMA DE CACHÉ GLOBAL ---
// Guardem les miniatures aquí per evitar carregar-les cada vegada que s'obre el modal
const thumbnailCache = {};

// --- COMPONENTS AUXILIARS PER GMAIL ---

const ImageThumbnail = React.memo(({ attachment }) => {
  const [imgData, setImgData] = useState(thumbnailCache[attachment.id] || null);
  const [loadingImg, setLoadingImg] = useState(!thumbnailCache[attachment.id]);

  useEffect(() => {
    if (thumbnailCache[attachment.id]) return;

    const loadThumbnail = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-attachment', {
          body: { messageId: attachment.messageId, attachmentId: attachment.id }
        });

        if (error || !data?.data) throw new Error("No data");

        let finalData = "";
        if (attachment.mimeType === 'application/pdf') {
          if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
          }
          const pdfjsLib = window.pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          const loadingTask = pdfjsLib.getDocument({ data: atob(data.data) });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          finalData = canvas.toDataURL();
        } else {
          finalData = `data:${attachment.mimeType};base64,${data.data}`;
        }

        thumbnailCache[attachment.id] = finalData;
        setImgData(finalData);
      } catch (e) {
        console.error("Error miniatura:", e);
      } finally {
        setLoadingImg(false);
      }
    };

    loadThumbnail();
  }, [attachment.id]);

  return (
    <div className="h-72 bg-slate-950 flex items-center justify-center border-b border-slate-700 overflow-hidden relative group">
      {loadingImg ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : imgData ? (
        <img src={imgData} className="w-full h-full object-contain bg-white group-hover:scale-110 transition-transform duration-700" />
      ) : (
        <div className="flex flex-col items-center opacity-20 text-slate-400">
          <FileText size={40} />
          <span className="text-[10px] mt-2 font-bold uppercase">{attachment.mimeType.split('/')[1]}</span>
        </div>
      )}
      <div className="absolute top-2 right-2 bg-emerald-600 px-2 py-0.5 rounded text-[9px] font-black text-white uppercase shadow-lg z-10">
        {attachment.mimeType.split('/')[1]}
      </div>
    </div>
  );
});

const EmailAttachmentCard = React.memo(({ att, email, isImported, onImport }) => {
  return (
    <div className="flex flex-col bg-slate-900 rounded-xl border border-slate-700 overflow-hidden group shadow-lg hover:border-emerald-500/50 transition-all duration-300">
      <ImageThumbnail attachment={att} />
      <div className="p-3 bg-slate-900">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={14} className="text-emerald-400 shrink-0" />
          <p className="text-[10px] text-slate-100 truncate font-bold flex-1" title={att.filename}>{att.filename}</p>
        </div>
        <div className="flex justify-between items-center gap-2">
          <p className="text-[9px] text-slate-500 font-mono">
            {att.size ? `${(Number(att.size) / 1024).toFixed(0)} KB` : '...'}
          </p>
          <button
            onClick={() => !isImported && onImport(att, email)}
            disabled={isImported}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${isImported
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed uppercase border border-slate-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg uppercase active:scale-95'
              }`}
          >
            {isImported ? 'FET' : 'IMPORTAR'}
          </button>
        </div>
      </div>
    </div>
  );
});

const InvoiceScanner = ({ isMock = false }) => {
  const STORAGE_KEY = 'invoices-data-v1';

  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);

  // Estats de selecció
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Helper per formatar números a l'estil català (amb coma i 2 decimals)
  const formatNum = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0,00";
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper per netejar l'entrada de text i convertir-la a número
  const parseInput = (val) => {
    const clean = val.replace(',', '.');
    return parseFloat(clean) || 0;
  };

  // Guardar dades quan canviïn
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  }, [invoices]);

  const updateInvoice = (updated) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
    if (selectedInvoice?.id === updated.id) setSelectedInvoice(updated);
  };

  const deleteInvoice = (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Esborrar aquesta factura?')) {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const sendToConciliation = async (invoice) => {
    if (!supabase) return alert('Supabase no configurat');
    try {
      const [day, month, year] = invoice.data.split(/[/-]/).map(Number);
      const ejercicio = year < 100 ? 2000 + year : (year || new Date().getFullYear());
      const trimestre = month ? Math.ceil(month / 3) : 1;
      const hash = `AI_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      const contingut = {
        "DATA": invoice.data,
        "ULTIMA 4 DIGITS NUMERO FACTURA": String(invoice.id).slice(-4),
        "PROVEEDOR": invoice.proveidor,
        "NIF PROVEEDOR": invoice.nifProveidor,
        "TOTAL FACTURA": invoice.totalFactura,
        "URL FACTURA": invoice.imageUrl || ""
      };

      const { error } = await supabase.from('registres_comptables').insert({
        tipus: 'factura',
        contingut: contingut,
        ejercicio: ejercicio,
        trimestre: trimestre,
        unique_hash: hash
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error enviant:', err);
      return false;
    }
  };

  const handleBulkSend = async () => {
    const toSend = invoices.filter(inv => selectedIds.has(inv.id));
    if (toSend.length === 0) return;

    setProcessingBulk(true);
    setSaveStatus(`Enviant ${toSend.length} factures...`);

    let successCount = 0;
    for (const inv of toSend) {
      const ok = await sendToConciliation(inv);
      if (ok) {
        successCount++;
        // Eliminem de la llista local
        setInvoices(prev => prev.filter(item => item.id !== inv.id));
      }
    }

    setSelectedIds(new Set());
    setSelectedInvoice(null);
    setProcessingBulk(false);
    setSaveStatus(`✓ ${successCount} enviades i netejades`);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const [processingBulk, setProcessingBulk] = useState(false);

  // Gmail States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setQueue(prev => [...prev, ...files]);
    if (totalFiles === 0) setTotalFiles(files.length);
    else setTotalFiles(prev => prev + prev.length);
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setSaveStatus(`Processant ${file.name}...`);

    try {
      // 1. Convert File to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      // 2. Call Supabase Edge Function (Gemini)
      const { data, error: funcError } = await supabase.functions.invoke('process-document', {
        body: {
          file: base64,
          fileType: file.type
        }
      });

      if (funcError) throw funcError;
      if (data.error) throw new Error(data.error);

      // Gemini retorna un array "factures"
      const facturesArray = data.factures || [];
      if (facturesArray.length === 0) throw new Error('No s\'han trobat dades');

      const newInvoices = facturesArray.map((inv, index) => {
        // Preparem l'array d'IVAs detectats
        const ivas = [];
        if (inv.import_iva_21 > 0 || inv.base_iva_21 > 0) ivas.push({ taxa: 21, quota: inv.import_iva_21 || 0 });
        if (inv.import_iva_10 > 0 || inv.base_iva_10 > 0) ivas.push({ taxa: 10, quota: inv.import_iva_10 || 0 });
        if (inv.import_iva_4 > 0 || inv.base_iva_4 > 0) ivas.push({ taxa: 4, quota: inv.import_iva_4 || 0 });
        if (inv.import_iva_5 > 0 || inv.base_iva_5 > 0) ivas.push({ taxa: 5, quota: inv.import_iva_5 || 0 });
        if (inv.import_iva_2 > 0 || inv.base_iva_2 > 0) ivas.push({ taxa: 2, quota: inv.import_iva_2 || 0 });

        // Si no s'ha detectat cap (però hi ha total), en posem un per defecte
        if (ivas.length === 0) ivas.push({ taxa: 21, quota: 0 });

        const quotaTotal = ivas.reduce((acc, curr) => acc + curr.quota, 0);

        return {
          id: Date.now() + Math.random() + index,
          proveidor: inv.proveedor || 'Desconegut',
          nifProveidor: inv.nif_proveedor || '',
          data: inv.data || '',
          numFactura: inv.numero_factura || '',
          totalFactura: Number(inv.total_factura) || 0,
          baseImposable: Number(inv.total_factura) - quotaTotal,
          ivas: ivas,
          imageUrl: URL.createObjectURL(file),
          fileType: file.type,
          fileName: file.name,
          dateAdded: new Date().toISOString(),
          revisat: false,
          categoria: 'Material'
        };
      });

      setInvoices(prev => [...newInvoices, ...prev]);
      setSaveStatus(`${newInvoices.length} factura/es processada/es`);
      if (newInvoices.length > 0) setSelectedInvoice(newInvoices[0]);

    } catch (err) {
      console.error('Error processant fitxer:', err);
      alert('Error en el processament: ' + err.message);
      setSaveStatus('Error en l\'última factura');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  useEffect(() => {
    if (queue.length > 0 && !isProcessing) {
      const nextFile = queue[0];
      processFile(nextFile).then(() => {
        setQueue(prev => prev.slice(1));
      });
    } else if (queue.length === 0 && totalFiles > 0) {
      setTotalFiles(0);
    }
  }, [queue, isProcessing]);

  // Gmail Logic
  const fetchEmails = async () => {
    setLoadingEmails(true);
    setShowEmailModal(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-emails', {
        body: { labelName: 'factures pendents' }
      });
      if (error) throw error;
      setEmails(data.emails || []);
    } catch (err) {
      console.error('Error fetching emails:', err);
      alert('Error connectant amb Gmail: ' + err.message);
    } finally {
      setLoadingEmails(false);
    }
  };

  const importFromEmail = async (attachment, email) => {
    setSaveStatus(`Descarregant ${attachment.filename}...`);
    try {
      const { data, error } = await supabase.functions.invoke('get-attachment', {
        body: {
          messageId: attachment.messageId,
          attachmentId: attachment.id
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Convertim el base64 que ens arriba a un objecte File
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fileBlob = new Blob([byteArray], { type: attachment.mimeType });
      const file = new File([fileBlob], attachment.filename, { type: attachment.mimeType });

      // Afegim a la cua per analitzar amb Gemini
      setQueue(prev => [...prev, file]);
      setTotalFiles(prev => prev + 1);
      setSaveStatus(`✓ ${attachment.filename} a la cua`);

    } catch (err) {
      console.error('Error descarregant adjunt:', err);
      alert('Error en descarregar el fitxer: ' + err.message);
    } finally {
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };


  const toggleRevisat = (inv) => {
    const updated = { ...inv, revisat: !inv.revisat };
    updateInvoice(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header with quick actions */}
      <div className="p-6 border-b border-slate-700 bg-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Escàner Intel·ligent de Factures
            </h1>
            <p className="text-slate-400 text-sm">Puja fitxers o importa directament des del teu Gmail</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchEmails}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-red-900/20 font-bold"
            >
              <Mail size={18} />
              Gmail Import
            </button>
            <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-all shadow-lg shadow-emerald-900/20 font-bold">
              <Plus size={18} />
              Puja Fitxer
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
            </label>
          </div>
        </div>

        {/* Status Bar */}
        {(isProcessing || queue.length > 0 || saveStatus) && (
          <div className="mt-4 flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
            {isProcessing ? (
              <Loader2 className="animate-spin text-emerald-400" size={20} />
            ) : (
              <CheckCircle className="text-emerald-400" size={20} />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{saveStatus || (isProcessing ? 'Analitzant factura amb Gemini...' : 'Cua de processament')}</p>
              {totalFiles > 0 && (
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${((totalFiles - queue.length) / totalFiles) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
            {queue.length > 0 && <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-400">{queue.length} pendents</span>}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Invoice List - Narrower (w-80) */}
        <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-900/50 shrink-0">
          <div className="p-4 bg-slate-800/30 border-b border-slate-700 flex justify-between items-center bg-slate-900">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/20"
                checked={invoices.length > 0 && selectedIds.size === invoices.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(invoices.map(i => i.id)));
                  else setSelectedIds(new Set());
                }}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Totes</span>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkSend}
                disabled={processingBulk}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all animate-in fade-in zoom-in-95"
              >
                {processingBulk ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Pujar {selectedIds.size}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8 text-center">
                <Scan size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Bústia d'entrada buida.</p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${selectedInvoice?.id === inv.id
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      onClick={(e) => e.stopPropagation()}
                      checked={selectedIds.has(inv.id)}
                      onChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(inv.id)) next.delete(inv.id);
                          else next.add(inv.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 z-10"
                    />

                    <div className={`p-2 rounded-lg ${inv.revisat ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                      {inv.fileType === 'application/pdf' ? (
                        <FileText size={16} className={inv.revisat ? 'text-emerald-400' : 'text-slate-400'} />
                      ) : (
                        <Scan size={16} className={inv.revisat ? 'text-emerald-400' : 'text-slate-400'} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[11px] truncate text-slate-200">{inv.proveidor || 'Desconegut'}</h3>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-slate-500 font-mono">{inv.data || '--/--/--'}</span>
                        <span className="text-[11px] font-black text-emerald-400">{inv.totalFactura?.toFixed(2)}€</span>
                      </div>
                    </div>

                    {/* Botó esborrar individual al fer hover */}
                    <button
                      onClick={(e) => deleteInvoice(inv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Details & Viewer */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
          {selectedInvoice ? (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              {/* Toolbar Viewer */}
              <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-10">
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400"><ZoomOut size={16} /></button>
                    <span className="text-[10px] font-bold w-10 text-center text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400"><ZoomIn size={16} /></button>
                  </div>
                  <button className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 transition-colors border border-transparent hover:border-slate-700"><RotateCw size={18} /></button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRevisat(selectedInvoice)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${selectedInvoice.revisat
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    <CheckCircle size={16} />
                    {selectedInvoice.revisat ? 'Revisat' : 'Marcar Revisat'}
                  </button>
                  <button
                    onClick={() => deleteInvoice(selectedInvoice.id)}
                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Viewer & Data split */}
              <div className="flex flex-1 overflow-hidden p-4 gap-4">
                <div className="w-[400px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                  {/* Data Card */}
                  <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-700/50 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl">
                          <Tag className="text-indigo-400" size={24} />
                        </div>
                        <div>
                          <input
                            value={selectedInvoice.proveidor}
                            onChange={(e) => updateInvoice({ ...selectedInvoice, proveidor: e.target.value })}
                            className="bg-transparent border-none text-xl font-black text-white p-0 focus:ring-0 w-full"
                          />
                          <p className="text-xs text-slate-500 font-mono">ID: {String(selectedInvoice.id).slice(-6)}</p>
                        </div>
                      </div>

                      {/* Validador de sumes */}
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${Math.abs((Number(selectedInvoice.baseImposable) || 0) + (selectedInvoice.ivas?.reduce((acc, i) => acc + (Number(i.quota) || 0), 0) || 0) - (Number(selectedInvoice.totalFactura) || 0)) < 0.01
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/50 text-rose-400'
                        }`}>
                        {Math.abs((Number(selectedInvoice.baseImposable) || 0) + (selectedInvoice.ivas?.reduce((acc, i) => acc + (Number(i.quota) || 0), 0) || 0) - (Number(selectedInvoice.totalFactura) || 0)) < 0.01 ? (
                          <> <CheckCircle size={12} /> Sumes OK </>
                        ) : (
                          <> <AlertCircle size={12} /> Error Suma </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={12} /> Data
                        </label>
                        <input
                          value={selectedInvoice.data}
                          onChange={(e) => updateInvoice({ ...selectedInvoice, data: e.target.value })}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <FileText size={12} /> Nº Factura
                        </label>
                        <input
                          value={selectedInvoice.numFactura}
                          placeholder="...1234"
                          onChange={(e) => updateInvoice({ ...selectedInvoice, numFactura: e.target.value })}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Tag size={12} /> NIF
                        </label>
                        <input
                          value={selectedInvoice.nifProveidor}
                          onChange={(e) => updateInvoice({ ...selectedInvoice, nifProveidor: e.target.value })}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Plus size={12} /> Categoria
                        </label>
                        <select
                          value={selectedInvoice.categoria}
                          onChange={(e) => updateInvoice({ ...selectedInvoice, categoria: e.target.value })}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        >
                          <option value="Material">Material</option>
                          <option value="Serveis">Serveis</option>
                          <option value="Subministraments">Subministraments</option>
                          <option value="Altres">Altres</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Imposable</span>
                            <div className="flex items-center gap-1 border-b border-white/10">
                              <input
                                type="text"
                                value={selectedInvoice.baseImposable?.toString().replace('.', ',')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (val === '' || val === '.' || !isNaN(val)) {
                                    updateInvoice({ ...selectedInvoice, baseImposable: val });
                                  }
                                }}
                                onBlur={() => {
                                  const num = parseFloat(selectedInvoice.baseImposable) || 0;
                                  updateInvoice({ ...selectedInvoice, baseImposable: num });
                                }}
                                className="bg-transparent border-none text-right font-mono text-slate-100 p-0 focus:ring-0 w-24"
                              />
                              <span className="text-slate-400">€</span>
                            </div>
                          </div>

                          {/* Llista d'IVAs Editables */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desglossament IVA</span>
                              <button
                                onClick={() => {
                                  const currentIvas = selectedInvoice.ivas || [];
                                  updateInvoice({ ...selectedInvoice, ivas: [...currentIvas, { taxa: 21, quota: 0 }] });
                                }}
                                className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            {(selectedInvoice.ivas || []).map((iva, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-xl border border-slate-700/30 group/iva">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Taxa:</span>
                                  <input
                                    type="text"
                                    value={iva.taxa?.toString().replace('.', ',')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(',', '.');
                                      if (val === '' || val === '.' || !isNaN(val)) {
                                        const newIvas = [...selectedInvoice.ivas];
                                        newIvas[idx].taxa = val;
                                        updateInvoice({ ...selectedInvoice, ivas: newIvas });
                                      }
                                    }}
                                    onBlur={() => {
                                      const newIvas = [...selectedInvoice.ivas];
                                      newIvas[idx].taxa = parseFloat(iva.taxa) || 0;
                                      updateInvoice({ ...selectedInvoice, ivas: newIvas });
                                    }}
                                    className="bg-slate-900/50 border border-indigo-500/30 rounded text-center font-bold text-[10px] text-indigo-400 p-0.5 focus:ring-1 focus:ring-indigo-500 w-10 outline-none"
                                  />
                                  <span className="text-[10px] text-indigo-400 font-black">%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 border-b border-white/10">
                                    <input
                                      type="text"
                                      value={iva.quota?.toString().replace('.', ',')}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || val === '.' || !isNaN(val)) {
                                          const newIvas = [...selectedInvoice.ivas];
                                          newIvas[idx].quota = val;
                                          updateInvoice({ ...selectedInvoice, ivas: newIvas });
                                        }
                                      }}
                                      onBlur={() => {
                                        const newIvas = [...selectedInvoice.ivas];
                                        newIvas[idx].quota = parseFloat(iva.quota) || 0;
                                        updateInvoice({ ...selectedInvoice, ivas: newIvas });
                                      }}
                                      className="bg-transparent border-none text-right font-mono text-slate-100 p-0 focus:ring-0 w-20"
                                    />
                                    <span className="text-slate-400">€</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newIvas = selectedInvoice.ivas.filter((_, i) => i !== idx);
                                      updateInvoice({ ...selectedInvoice, ivas: newIvas });
                                    }}
                                    className="opacity-0 group-hover/iva:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-700 mt-2">
                            <span className="text-sm font-black text-white uppercase tracking-widest">Total Factura</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={selectedInvoice.totalFactura?.toString().replace('.', ',')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (val === '' || val === '.' || !isNaN(val)) {
                                    updateInvoice({ ...selectedInvoice, totalFactura: val });
                                  }
                                }}
                                onBlur={() => {
                                  const num = parseFloat(selectedInvoice.totalFactura) || 0;
                                  updateInvoice({ ...selectedInvoice, totalFactura: num });
                                }}
                                className="bg-transparent border-none text-right font-black text-2xl text-emerald-400 p-0 focus:ring-0 w-32"
                              />
                              <span className="text-emerald-400 font-black text-2xl">€</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 border border-slate-700 rounded-2xl overflow-hidden bg-slate-950 flex items-start justify-center shadow-2xl relative">
                  <div
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}
                    className="w-full h-full flex justify-center"
                  >
                    {selectedInvoice.fileType === 'application/pdf' || selectedInvoice.imageUrl?.startsWith('data:application/pdf') ? (
                      <iframe
                        src={selectedInvoice.imageUrl}
                        className="w-full h-full bg-slate-800"
                        style={{ minHeight: '100%' }}
                        title="PDF Preview"
                      />
                    ) : (
                      <img src={selectedInvoice.imageUrl} alt="Factura" className="max-w-full h-auto object-contain bg-white shadow-2xl" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <div className="p-8 bg-slate-800/20 rounded-full border border-slate-800 mb-6">
                <Eye size={64} className="opacity-20 text-emerald-500" />
              </div>
              <h2 className="text-lg font-black text-slate-400">Visor de Factures Intel·ligent</h2>
              <p className="text-sm mt-2 max-w-xs text-center opacity-50">Selecciona un document de la llista per veure la previsualització i les dades extretes per l'IA.</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/90 flex items-start justify-center z-50 p-4 md:p-8 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
          <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl border border-white/10 max-h-[90vh] flex flex-col relative animate-in slide-in-from-bottom-4 duration-500">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-3xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <Mail className="text-red-500" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Importar de Gmail</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Factures pendents a la teva bústia</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 bg-slate-700/50 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-full transition-all border border-transparent hover:border-red-500/20"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-900/20">
              {loadingEmails ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
                    <Scan className="absolute inset-0 m-auto text-emerald-500/50 animate-pulse" size={24} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-black text-white">Escanejant la teva bústia...</p>
                    <p className="text-sm text-slate-500 font-medium">Estem buscant factures amb l'etiqueta "factures pendents"</p>
                  </div>
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-8 bg-slate-800/30 rounded-full border border-slate-700 mb-6">
                    <Mail size={64} className="text-slate-600 opacity-20" />
                  </div>
                  <h4 className="text-lg font-black text-slate-300">No s'han trobat factures pendents</h4>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto font-medium leading-relaxed">
                    Revisa que el nom de l'etiqueta a Gmail sigui exactament <span className="text-emerald-500 font-mono font-bold italic">"factures pendents"</span> i que els correus tinguin adjunts.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {emails.map(email => (
                    <div key={email.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 shadow-xl">
                      <div className="flex justify-between items-start mb-6 border-l-4 border-emerald-500 pl-4">
                        <div>
                          <h4 className="font-black text-white text-lg group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{email.subject || '(Sense assumpte)'}</h4>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Plus size={10} /> {email.from}</span>
                            <span className="text-slate-700">•</span>
                            <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(email.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {email.attachments.map(att => {
                          const isImported = queue.some(q => q.name === att.filename) || invoices.some(inv => inv.fileName?.includes(att.filename));
                          return (
                            <EmailAttachmentCard
                              key={att.id}
                              att={att}
                              email={email}
                              isImported={isImported}
                              onImport={importFromEmail}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-700 bg-slate-900/50 rounded-b-3xl">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><Clock size={14} /> Sincronitzat fa un moment</span>
                  <span className="text-slate-700">|</span>
                  <span className="text-emerald-500/70">{emails.length} correus trobats</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                  <AlertCircle size={14} className="text-amber-500" />
                  <span>Es mostren PDFs i Imatges</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceScanner;