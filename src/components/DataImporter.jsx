import React, { useState } from 'react';
import { read, utils } from 'xlsx';
import { InventoryService } from '../services/inventoryService.js';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, Database, ArrowRight, XCircle, History, Package, SearchCheck, Layers, ChevronDown } from 'lucide-react';

const DataImporter = () => {
  const [mode, setMode] = useState('inventory'); 
  const [file, setFile] = useState(null);
  
  // States para manejo de Hojas (Tabs)
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');

  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState(null);
  
  // Diagnóstico
  const [matchStats, setMatchStats] = useState({ total: 0, found: 0, missing: [] });

  // 1. CARGA DEL ARCHIVO Y LECTURA DE ESTRUCTURA
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    
    // Reset states
    setValidationError(null);
    setLogs([]);
    setMatchStats({ total: 0, found: 0, missing: [] });
    setPreviewData([]);
    setSheetNames([]);
    setSelectedSheet('');

    const wb = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = read(event.target.result, { type: 'binary' });
        resolve(data);
      };
      reader.readAsBinaryString(uploadedFile);
    });

    setWorkbook(wb);
    setSheetNames(wb.SheetNames);

    // INTELIGENCIA: Intentar adivinar la hoja correcta según el modo
    let targetSheet = wb.SheetNames[0]; // Por defecto la primera
    const lowerMode = mode.toLowerCase();
    
    // Buscar si alguna hoja coincide con el modo actual
    const smartSheet = wb.SheetNames.find(name => {
        const n = name.toLowerCase();
        if (lowerMode === 'inventory' && (n.includes('inventario') || n.includes('stock') || n.includes('actual') || n.includes('producto'))) return true;
        if (lowerMode === 'sales' && (n.includes('venta') || n.includes('historial') || n.includes('salida'))) return true;
        return false;
    });

    if (smartSheet) targetSheet = smartSheet;

    // Procesar esa hoja
    handleSheetChange(targetSheet, wb);
  };

  // 2. CAMBIO DE HOJA (TAB)
  const handleSheetChange = (sheetName, wbInstance = workbook) => {
      setSelectedSheet(sheetName);
      
      if (!wbInstance || !wbInstance.Sheets[sheetName]) return;

      const rows = utils.sheet_to_json(wbInstance.Sheets[sheetName]);
      setPreviewData(rows);
      setValidationError(null);
      setMatchStats({ total: 0, found: 0, missing: [] });

      // Validaciones Básicas de Columnas
      if (rows.length > 0) {
        const firstRow = rows[0];
        const keys = Object.keys(firstRow).map(k => k.toLowerCase());
        const values = Object.values(firstRow).map(v => String(v).toLowerCase());
        
        const isSalesFile = values.includes('venta') || keys.includes('total venta (r$)') || keys.includes('ganancia real (r$)');
        
        if (mode === 'inventory' && isSalesFile) {
            setValidationError(`⚠️ La hoja "${sheetName}" parece tener VENTAS, pero estás en modo INVENTARIO.`);
        } else if (mode === 'sales' && !isSalesFile) {
             // Advertencia suave
             setLogs([{type: 'info', msg: `Aviso: La hoja "${sheetName}" no tiene columnas típicas de ventas, verifica antes de importar.`}]);
        }
      } else {
          setValidationError(`⚠️ La hoja "${sheetName}" está vacía.`);
      }

      // Si estamos en ventas y hay datos, correr diagnóstico
      if (mode === 'sales' && rows.length > 0) {
          runDiagnosis(rows);
      }
  };

  const runDiagnosis = async (data) => {
      setLogs([{ type: 'info', msg: 'Analizando coincidencias con base de datos...' }]);
      const variantsMap = await InventoryService.getVariantsMap();
      const normalize = (str) => String(str || '').toLowerCase().trim();
      
      let found = 0;
      let missingList = [];

      data.forEach(row => {
          const prodName = normalize(row['Producto'] || row['name']);
          const measureName = normalize(row['Medida'] || row['Variante']);
          
          let hit = variantsMap[`${prodName}|${measureName}`] || variantsMap[prodName];
          
          if (!hit) {
              const mapKeys = Object.keys(variantsMap);
              const partial = mapKeys.some(k => k.includes(prodName));
              if(partial) hit = true;
          }

          if (hit) found++;
          else {
              if (missingList.length < 5) missingList.push(row['Producto'] || 'Sin Nombre');
          }
      });

      setMatchStats({
          total: data.length,
          found: found,
          missing: missingList
      });
      
      if (found === 0) {
          setValidationError("❌ Error Crítico: Ningún producto coincide. Revisa si elegiste la hoja correcta.");
      } else if (found < data.length) {
          setLogs(prev => [...prev, { type: 'info', msg: `⚠️ Alerta: ${data.length - found} filas no coinciden.` }]);
      } else {
          setLogs(prev => [...prev, { type: 'success', msg: `✅ Hoja válida: ${found} coincidencias encontradas.` }]);
      }
  };

  const processImport = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    setLogs([]);
    setProgress(0);
    
    if (mode === 'inventory') {
        await processInventoryImport();
    } else {
        await processSalesImport();
    }
    
    setLoading(false);
  };

  const processInventoryImport = async () => {
    let successCount = 0;
    let errorCount = 0;
    const grouped = {};
    
    previewData.forEach((row) => {
        const name = row['name'] || row['Nombre'] || row['Producto'];
        const type = row['category'] || row['Categoria'] || row['Tipo'] || 'unidad';
        const measure = row['Medida'] || row['Variante'] || 'Estándar';
        const stock = parseFloat(row['stock'] || row['Stock'] || row['Cantidad'] || 0);
        const priceBuy = parseFloat(row['price'] || row['Costo'] || row['Precio Compra'] || 0);
        const priceSell = parseFloat(row['Venta (R$)'] || row['Venta'] || row['Precio Venta'] || 0);

        if (!name) return;

        if (!grouped[name]) {
            grouped[name] = {
                name: name.toUpperCase().trim(),
                type: 'producto',
                variants: []
            };
        }

        grouped[name].variants.push({
            name: String(measure),
            stock_quantity: stock,
            price_buy_soles: priceBuy,
            price_sell_brl: priceSell,
            sales_unit: type.toLowerCase().includes('kilo') ? 'KG' : (type.toLowerCase().includes('metro') ? 'MT' : 'UND'),
            conversion_factor: 1, 
            purchase_unit: 'UNIDAD'
        });
    });

    const productNames = Object.keys(grouped);
    const totalProducts = productNames.length;

    for (let i = 0; i < totalProducts; i++) {
        const pName = productNames[i];
        const productData = grouped[pName];
        
        try {
            await InventoryService.importProductBatch(productData);
            setLogs(prev => [...prev, { type: 'success', msg: `Inventario: ${pName} actualizado.` }]);
            successCount++;
        } catch (error) {
            console.error(error);
            setLogs(prev => [...prev, { type: 'error', msg: `Error en ${pName}: ${error.message}` }]);
            errorCount++;
        }
        
        setProgress(Math.round(((i + 1) / totalProducts) * 100));
    }
    alert(`Inventario Actualizado desde hoja: ${selectedSheet}.\nProductos procesados: ${successCount}`);
  };

  const processSalesImport = async () => {
      setLogs(prev => [...prev, { type: 'info', msg: 'Iniciando importación histórica...' }]);
      const variantsMap = await InventoryService.getVariantsMap();
      const mapSize = Object.keys(variantsMap).length;
      
      if (mapSize === 0) {
          setLogs(prev => [...prev, { type: 'error', msg: 'NO HAY DATOS: Crea productos primero.' }]);
          return;
      }

      const { success, failed, errors } = await InventoryService.importHistoricalSales(previewData, variantsMap);

      errors.forEach(err => {
          setLogs(prev => [...prev, { type: 'error', msg: err }]);
      });
      
      setLogs(prev => [...prev, { type: 'success', msg: `RESUMEN: ${success} insertadas, ${failed} fallidas.` }]);
      setProgress(100);
      alert(`Historial Importado desde hoja: ${selectedSheet}.\nÉxito: ${success}\nFallos: ${failed}`);
  };

  const resetAll = () => {
    setFile(null); 
    setPreviewData([]); 
    setValidationError(null); 
    setMatchStats({total:0, found:0, missing:[]});
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="bg-slate-900 p-4 rounded-2xl shadow-lg text-emerald-400">
            <Database size={32} />
        </div>
        <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Migración Inteligente</h2>
            <p className="text-slate-500 font-medium">Actualiza stock o importa historial de ventas.</p>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex">
          <button 
            onClick={() => { setMode('inventory'); resetAll(); }}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mode === 'inventory' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <Package size={20}/> Actualizar Stock (Inventario)
          </button>
          <button 
            onClick={() => { setMode('sales'); resetAll(); }}
            className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mode === 'sales' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <History size={20}/> Importar Historial Ventas
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="space-y-6">
            <div className={`bg-white rounded-3xl shadow-xl p-8 border-2 transition-colors ${mode === 'inventory' ? 'border-indigo-100' : 'border-emerald-100'}`}>
                <h3 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${mode === 'inventory' ? 'text-indigo-400' : 'text-emerald-500'}`}>
                    <FileSpreadsheet size={16}/> 1. Subir Excel ({mode === 'inventory' ? 'STOCK' : 'VENTAS'})
                </h3>
                
                <div className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors relative ${validationError ? 'border-rose-300 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {validationError ? (
                        <XCircle size={48} className="text-rose-500 mb-4"/>
                    ) : (
                        <UploadCloud size={48} className={mode === 'inventory' ? 'text-indigo-400 mb-4' : 'text-emerald-400 mb-4'}/>
                    )}
                    
                    {validationError ? (
                        <p className="font-bold text-rose-600 px-4">{validationError}</p>
                    ) : (
                        <>
                            <p className="font-bold text-slate-700">
                                {file ? file.name : "Arrastra tu Excel aquí"}
                            </p>
                            {mode === 'inventory' && <p className="text-xs text-indigo-400 mt-2 font-bold">Esto SOBREESCRIBIRÁ el stock actual</p>}
                        </>
                    )}
                </div>

                {/* SELECTOR DE HOJA (NUEVO) */}
                {sheetNames.length > 0 && (
                    <div className="mt-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Layers size={12} /> Selecciona la Hoja (Pestaña)
                        </label>
                        <div className="relative">
                            <select 
                                value={selectedSheet}
                                onChange={(e) => handleSheetChange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-indigo-500"
                            >
                                {sheetNames.map(sheet => (
                                    <option key={sheet} value={sheet}>{sheet}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16}/>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">
                            Mostrando <span className="font-bold text-slate-700">{previewData.length}</span> filas de la hoja <span className="font-bold text-slate-700">"{selectedSheet}"</span>
                        </p>
                    </div>
                )}

            </div>

            {/* DIAGNÓSTICO */}
            {matchStats.total > 0 && mode === 'sales' && !validationError && (
                 <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <SearchCheck size={16}/> Pre-Análisis de Nombres
                     </h3>
                     <div className="flex items-center gap-4 mb-4">
                         <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
                             <span className="block text-2xl font-black text-emerald-600">{matchStats.found}</span>
                             <span className="text-[10px] uppercase font-bold text-emerald-400">Encontrados</span>
                         </div>
                         <div className="flex-1 bg-rose-50 rounded-lg p-3 text-center border border-rose-100">
                             <span className="block text-2xl font-black text-rose-600">{matchStats.total - matchStats.found}</span>
                             <span className="text-[10px] uppercase font-bold text-rose-400">No Encontrados</span>
                         </div>
                     </div>
                     {matchStats.missing.length > 0 && (
                         <div className="bg-slate-50 p-3 rounded-lg text-xs">
                             <p className="font-bold text-slate-500 mb-1">Ejemplos no encontrados:</p>
                             <ul className="list-disc pl-4 text-rose-500 font-mono">
                                 {matchStats.missing.map((m, i) => <li key={i}>{m}</li>)}
                             </ul>
                         </div>
                     )}
                 </div>
            )}

            {file && !validationError && (
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 animate-fade-in">
                    <button 
                        onClick={processImport}
                        disabled={loading || (mode === 'sales' && matchStats.found === 0)}
                        className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                            loading 
                            ? 'bg-slate-100 text-slate-400' 
                            : (mode === 'inventory' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg')
                        }`}
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <ArrowRight/>}
                        {loading ? `Procesando... ${progress}%` : (mode === 'inventory' ? 'ACTUALIZAR STOCK' : 'IMPORTAR VENTAS')}
                    </button>
                </div>
            )}
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 text-slate-300 font-mono text-xs overflow-hidden flex flex-col h-[500px]">
             <h3 className="text-emerald-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-700 pb-4">
                &gt; Terminal de Sistema
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {logs.length === 0 && <span className="opacity-50">Esperando comandos...</span>}
                {logs.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-rose-400' : (log.type === 'success' ? 'text-emerald-400' : 'text-slate-300')}`}>
                        <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                        <span>{log.msg}</span>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default DataImporter;