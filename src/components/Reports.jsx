import React, { useEffect, useState, useMemo } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { BarChart3, Download, Loader2, ChevronDown, ChevronUp, User, Calendar, DollarSign, TrendingUp, Package, Pencil, X, Save, AlertTriangle, Calculator, Briefcase, Archive, AlertOctagon } from 'lucide-react';
import * as XLSX from 'xlsx';

// MODAL PARA EDITAR VENTA (MANTENIDO IGUAL)
const EditTransactionModal = ({ isOpen, onClose, transaction, onSave }) => {
    const [clientName, setClientName] = useState('');
    const [items, setItems] = useState([]);
    const [confirmationText, setConfirmationText] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && transaction) {
            setClientName(transaction.clientName);
            const preparedItems = transaction.items.map(i => {
                const qty = parseFloat(i.quantity) || 0;
                const sub = parseFloat(i.subtotal) || 0;
                const unitPrice = qty > 0 ? (sub / qty) : 0;
                return {
                    ...i,
                    quantity: qty,     
                    subtotal: sub,     
                    unitPrice: unitPrice 
                };
            });
            setItems(preparedItems);
            setConfirmationText('');
        }
    }, [isOpen, transaction]);

    const handleQuantityChange = (index, value) => {
        const newItems = [...items];
        const qty = parseFloat(value);
        newItems[index].quantity = value;
        if (!isNaN(qty)) {
            const newSubtotal = qty * newItems[index].unitPrice;
            newItems[index].subtotal = parseFloat(newSubtotal.toFixed(2));
        } else {
            newItems[index].subtotal = '';
        }
        setItems(newItems);
    };

    const handleSubtotalChange = (index, value) => {
        const newItems = [...items];
        const sub = parseFloat(value);
        newItems[index].subtotal = value;
        if (!isNaN(sub) && newItems[index].unitPrice > 0) {
            const newQty = sub / newItems[index].unitPrice;
            newItems[index].quantity = parseFloat(newQty.toFixed(3));
        } else {
            newItems[index].quantity = '';
        }
        setItems(newItems);
    };

    const handleSave = async () => {
        if (confirmationText !== 'EDITAR VENTA') return;
        setLoading(true);
        try {
            await onSave(transaction.id, clientName, items);
            onClose();
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2"><Pencil className="text-orange-400" size={20}/> Editar Transacción</h3>
                    <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={18}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Cliente</label>
                        <input type="text" value={clientName} onChange={e => setClientName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none uppercase focus:border-indigo-500" />
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Calculator size={14}/> Corrección de Montos</h4>
                        {items.map((item, idx) => (
                            <div key={item.id} className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                                <div className="sm:col-span-5">
                                    <p className="font-bold text-slate-800 text-sm uppercase">{item.productName}</p>
                                    <p className="text-[10px] font-black text-indigo-500 uppercase">{item.variantName}</p>
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Cantidad</label>
                                    <input type="number" value={item.quantity} onChange={e => handleQuantityChange(idx, e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 font-bold text-slate-700 text-sm outline-none focus:border-indigo-500" />
                                </div>
                                <div className="sm:col-span-4 relative">
                                    <label className="block text-[8px] font-black text-emerald-500 uppercase mb-1">Subtotal (R$)</label>
                                    <input type="number" step="0.01" value={item.subtotal} onChange={e => handleSubtotalChange(idx, e.target.value)} className="w-full bg-emerald-50 border border-emerald-100 rounded-lg pl-2 pr-2 py-2 font-black text-emerald-700 text-sm outline-none focus:border-emerald-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <div className="flex items-center gap-2 mb-2 text-orange-600"><AlertTriangle size={16}/><span className="text-xs font-black uppercase">Acción Irreversible</span></div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Escribe "EDITAR VENTA"</label>
                        <input type="text" placeholder="EDITAR VENTA" value={confirmationText} onChange={e => setConfirmationText(e.target.value)} className="w-full bg-white border-2 border-orange-200 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:border-orange-500 uppercase" />
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button onClick={handleSave} disabled={confirmationText !== 'EDITAR VENTA' || loading} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${confirmationText === 'EDITAR VENTA' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Confirmar Edición
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// SUB-COMPONENTES DE PESTAÑAS (REPORTES ESPECIFICOS)
// =========================================================

const FinancialTab = ({ transactions, onEdit }) => {
    const [monthFilter, setMonthFilter] = useState('ALL');
    const [dayFilter, setDayFilter] = useState(''); // NUEVO: Filtro por día
    const [expandedId, setExpandedId] = useState(null);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.timestamp);
            
            // 1. Filtro por Día Exacto (Prioridad)
            if (dayFilter) {
                const saleDate = d.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD local
                return saleDate === dayFilter;
            }

            // 2. Filtro por Mes
            if (monthFilter === 'ALL') return true;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return key === monthFilter;
        });
    }, [transactions, monthFilter, dayFilter]);

    // Calcular KPI
    const totalRev = filteredTransactions.reduce((a, t) => a + (t.totalRevenue || 0), 0);
    const totalProf = filteredTransactions.reduce((a, t) => a + (t.totalProfit || 0), 0);
    const totalCost = totalRev - totalProf;
    const margin = totalRev > 0 ? ((totalProf / totalRev) * 100) : 0;

    // Obtener meses disponibles
    const availableMonths = useMemo(() => {
        const s = new Set();
        transactions.forEach(t => {
            const d = new Date(t.timestamp);
            s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        });
        return Array.from(s).sort().reverse();
    }, [transactions]);

    const exportExcel = () => {
        const flatData = [];
        filteredTransactions.forEach(t => {
            t.items.forEach(item => {
                flatData.push({
                    'Fecha': new Date(t.timestamp).toLocaleDateString(),
                    'Cliente': t.clientName,
                    'Producto': item.productName,
                    'Cantidad': item.quantity,
                    'Total (R$)': item.subtotal,
                    'Utilidad (R$)': item.subtotal - (item.unitPrice * item.quantity) // Approx fix
                });
            });
        });
        const ws = XLSX.utils.json_to_sheet(flatData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Finanzas");
        XLSX.writeFile(wb, "Reporte_Financiero.xlsx");
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* FILTROS Y KPI */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Selector de Mes */}
                    <div className={`bg-white p-2 rounded-xl border flex items-center gap-2 shadow-sm transition-colors ${dayFilter ? 'border-slate-100 opacity-50' : 'border-slate-200'}`}>
                        <Calendar className="text-slate-400 ml-2" size={18}/>
                        <select 
                            value={monthFilter} 
                            onChange={e => { setMonthFilter(e.target.value); setDayFilter(''); }}
                            disabled={!!dayFilter}
                            className="bg-transparent font-bold text-slate-700 outline-none pr-4 py-1 disabled:cursor-not-allowed"
                        >
                            <option value="ALL">Todo el Historial</option>
                            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <span className="text-slate-300 font-black text-xs">O</span>

                    {/* Selector de Día (NUEVO) */}
                    <div className={`bg-white p-2 rounded-xl border flex items-center gap-2 shadow-sm transition-colors ${dayFilter ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                        <span className="text-[10px] font-black uppercase text-slate-400 pl-2">Día:</span>
                        <input 
                            type="date" 
                            value={dayFilter}
                            onChange={e => { setDayFilter(e.target.value); setMonthFilter('ALL'); }}
                            className="bg-transparent font-bold text-slate-700 outline-none py-1 text-sm"
                        />
                        {dayFilter && (
                            <button onClick={() => setDayFilter('')} className="text-slate-400 hover:text-rose-500">
                                <X size={16}/>
                            </button>
                        )}
                    </div>
                </div>
                <button onClick={exportExcel} className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg transition-colors border border-emerald-100 flex items-center gap-2">
                    <Download size={14}/> Excel
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg">
                    <p className="text-indigo-200 text-xs font-black uppercase tracking-widest">Ingresos Totales</p>
                    <p className="text-3xl font-black mt-2">R$ {totalRev.toFixed(2)}</p>
                </div>
                <div className="bg-white text-slate-800 border border-slate-100 p-6 rounded-2xl shadow-sm">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Costo de Mercadería</p>
                    <p className="text-3xl font-black mt-2">R$ {totalCost.toFixed(2)}</p>
                    <p className="text-xs text-slate-400 mt-1">Costo Hundido</p>
                </div>
                <div className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg">
                    <p className="text-emerald-100 text-xs font-black uppercase tracking-widest">Utilidad Neta</p>
                    <p className="text-3xl font-black mt-2">R$ {totalProf.toFixed(2)}</p>
                    <div className="inline-block bg-emerald-700/30 px-2 py-1 rounded text-xs font-bold mt-1">Margen: {margin.toFixed(1)}%</div>
                </div>
            </div>

            {/* LISTA */}
            <div className="space-y-3">
                {filteredTransactions.map(sale => {
                     const isExpanded = expandedId === sale.id;
                     return (
                        <div key={sale.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <div onClick={() => setExpandedId(isExpanded ? null : sale.id)} className="p-4 flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {sale.clientName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{sale.clientName} <span className="text-slate-300 font-normal">| {new Date(sale.timestamp).toLocaleDateString()}</span></p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-emerald-600">Ganancia: R$ {sale.totalProfit.toFixed(2)}</span>
                                            <button onClick={(e) => onEdit(e, sale)} className="text-slate-300 hover:text-orange-500 p-0.5"><Pencil size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-slate-800">R$ {sale.totalRevenue.toFixed(2)}</p>
                                    {isExpanded ? <ChevronUp size={16} className="ml-auto text-slate-300"/> : <ChevronDown size={16} className="ml-auto text-slate-300"/>}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="bg-slate-50 p-4 text-sm border-t border-slate-100">
                                    <table className="w-full">
                                        <thead className="text-[10px] font-black uppercase text-slate-400 text-left">
                                            <tr><th className="pb-2">Producto</th><th className="pb-2 text-right">Cant.</th><th className="pb-2 text-right">Total</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {(sale.items || []).map((it, i) => (
                                                <tr key={i}>
                                                    <td className="py-2 font-medium text-slate-600">{it.productName} <span className="text-slate-400 text-xs">({it.variantName})</span></td>
                                                    <td className="py-2 text-right font-bold">{it.quantity}</td>
                                                    <td className="py-2 text-right font-bold text-slate-800">R$ {(it.subtotal || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                     );
                })}
            </div>
        </div>
    );
};

const ValuationTab = ({ valuationData }) => {
    const totalInvest = valuationData.reduce((a, b) => a + b.totalInvestmentBRL, 0);
    const totalPotential = valuationData.reduce((a, b) => a + b.totalPotentialRevenueBRL, 0);
    const potentialProfit = totalPotential - totalInvest;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Patrimonio en Inventario</h3>
                    <p className="text-4xl font-black text-white">R$ {totalInvest.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Capital Congelado (Costo Real)</p>
                </div>
                <div className="h-12 w-px bg-slate-700 hidden md:block"></div>
                <div className="relative z-10 text-right">
                    <h3 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-1">Venta Potencial</h3>
                    <p className="text-3xl font-black text-emerald-300">R$ {totalPotential.toFixed(2)}</p>
                    <p className="text-xs text-emerald-600 mt-1">Ganancia Latente: +R$ {potentialProfit.toFixed(2)}</p>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600 rounded-full blur-3xl opacity-10 -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4 text-center">Stock</th>
                                <th className="px-6 py-4 text-right">Inversión (R$)</th>
                                <th className="px-6 py-4 text-right">Potencial (R$)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {valuationData.map(v => (
                                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 font-bold text-slate-700">
                                        {v.productName} <span className="text-slate-400 font-normal">| {v.variantName}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-bold bg-slate-50/50">
                                        {v.stock.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-slate-500">
                                        R$ {v.totalInvestmentBRL.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3 text-right font-black text-emerald-600">
                                        R$ {v.totalPotentialRevenueBRL.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SlowMovingTab = ({ slowItems }) => {
    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex items-start gap-4">
                <div className="bg-orange-100 p-3 rounded-full text-orange-600"><AlertOctagon size={24}/></div>
                <div>
                    <h3 className="font-black text-orange-800 uppercase tracking-wide">Zona de Riesgo (Hueso)</h3>
                    <p className="text-sm text-orange-700 mt-1 max-w-2xl">
                        Los siguientes productos no han tenido ventas en más de 30 días. 
                        Considera aplicar descuentos para recuperar el capital congelado.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slowItems.length === 0 ? (
                    <div className="col-span-2 text-center py-20 text-slate-300">
                        <Package size={48} className="mx-auto mb-4"/>
                        <p className="font-bold">¡Excelente! Tu inventario tiene buena rotación.</p>
                    </div>
                ) : (
                    slowItems.map(item => (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-shadow">
                            <div>
                                <h4 className="font-bold text-slate-700">{item.fullName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Stock: {item.stock}</span>
                                    <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-0.5 rounded">Sin ventas: {item.daysSinceSale} días</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Dinero Estancado</span>
                                <span className="font-black text-slate-800">R$ {item.frozenValue.toFixed(2)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

const Reports = () => {
    const [activeTab, setActiveTab] = useState('finance');
    const [loading, setLoading] = useState(true);
    
    // Data States
    const [transactions, setTransactions] = useState([]);
    const [valuationData, setValuationData] = useState([]);
    const [slowItems, setSlowItems] = useState([]);

    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const loadAllData = async () => {
        setLoading(true);
        const [trans, val, slow] = await Promise.all([
            InventoryService.fetchTransactions(),
            InventoryService.fetchValuationData(),
            InventoryService.fetchSlowMovingItems()
        ]);
        setTransactions(trans);
        setValuationData(val);
        setSlowItems(slow);
        setLoading(false);
    };

    useEffect(() => { loadAllData(); }, []);

    const handleEditClick = (e, t) => {
        e.stopPropagation();
        setEditingTransaction(t);
        setIsEditOpen(true);
    };

    const handleSaveEdit = async (id, clientName, items) => {
        await InventoryService.updateSaleTransaction(id, clientName, items);
        await loadAllData();
    };

    const tabs = [
        { id: 'finance', label: 'Finanzas', icon: Briefcase },
        { id: 'valuation', label: 'Valorización', icon: TrendingUp },
        { id: 'slow', label: 'Rotación', icon: Archive },
    ];

    if (loading) return <div className="h-96 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={40}/></div>;

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8">
            {/* Header Navigation */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Inteligencia de Negocio</h2>
                    <p className="text-slate-500">Reportes financieros y análisis de stock.</p>
                </div>
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                    {tabs.map(t => {
                        const Icon = t.icon;
                        const isActive = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                                    isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                <Icon size={16}/> {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'finance' && <FinancialTab transactions={transactions} onEdit={handleEditClick} />}
                {activeTab === 'valuation' && <ValuationTab valuationData={valuationData} />}
                {activeTab === 'slow' && <SlowMovingTab slowItems={slowItems} />}
            </div>

            {/* Global Edit Modal */}
            <EditTransactionModal 
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                transaction={editingTransaction}
                onSave={handleSaveEdit}
            />
        </div>
    );
};

export default Reports;