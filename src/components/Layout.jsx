import React, { useState } from 'react';
import { LayoutDashboard, PackagePlus, Truck, ShoppingCart, BarChart3, Settings, Boxes, Database } from 'lucide-react';

const Layout = ({ children, activeTab, setActiveTab, currentRate, onRateChange }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: LayoutDashboard },
    { id: 'sales', label: 'Vender', mobileLabel: 'Venta', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', mobileLabel: 'Stock', icon: Boxes },
    { id: 'supply', label: 'Abastecimiento', mobileLabel: 'Compra', icon: Truck },
    { id: 'products', label: 'Nuevo Prod.', mobileLabel: 'Nuevo', icon: PackagePlus },
    { id: 'reports', label: 'Reportes', mobileLabel: 'Reporte', icon: BarChart3 },
  ];

  const activeItem = menuItems.find(i => i.id === activeTab) || (activeTab === 'settings' ? {label: 'Configuración'} : menuItems[0]);

  return (
    // Usamos dvh (Dynamic Viewport Height) para móviles (Safari iOS fix) para evitar que la barra de direcciones tape la app
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* =======================================================
          1. SIDEBAR (SOLO DESKTOP)
         ======================================================= */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-full shadow-2xl z-50 shrink-0 transition-all">
        {/* Logo Area */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-black tracking-widest text-emerald-400">PIERO<span className="text-white">SYS</span></h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Gestión Comercial v2.0</p>
        </div>

        {/* Menu Items Desktop */}
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-4 transition-all duration-200 border-l-4 group ${
                  isActive 
                    ? 'bg-slate-800 border-emerald-500 text-emerald-400' 
                    : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={`mr-3 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-400' : ''}`} />
                <span className="font-bold text-sm uppercase tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Settings */}
        <div className="p-6 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between mb-2">
            <button 
                onClick={() => setActiveTab('settings')}
                className={`text-[10px] font-bold uppercase flex items-center gap-2 hover:text-white transition-colors ${activeTab === 'settings' ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              <Settings size={12} /> Configuración / Datos
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
            <span className="text-emerald-500 font-bold text-xs">S/1 =</span>
            <input 
              type="number" 
              step="0.01"
              value={currentRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="w-full bg-transparent text-white font-bold outline-none text-right text-sm"
            />
            <span className="text-slate-500 text-[10px] uppercase font-bold">R$</span>
          </div>
        </div>
      </aside>


      {/* =======================================================
          2. MAIN CONTENT WRAPPER
         ======================================================= */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* MOBILE HEADER (Fixed Top) */}
        <header className="md:hidden flex-none bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center z-40 border-b border-slate-800">
            <div>
                <h1 className="font-black tracking-widest text-emerald-400 text-lg leading-tight">PIERO<span className="text-white">SYS</span></h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    {activeItem.label || 'Sistema'}
                </p>
            </div>
            
            {/* Mobile Settings Shortcut */}
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`p-2 rounded-lg border transition-colors ${activeTab === 'settings' ? 'bg-slate-800 text-emerald-400 border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
                <Database size={18}/>
            </button>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        {/* IMPORTANTE: pb-24 en móvil asegura que el contenido final no quede tapado por la barra de navegación fija */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-10 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Fixed Bottom) */}
        {/* Reemplaza al menú toggle. Siempre visible para acceso rápido tipo App Nativa */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50 h-[70px]">
            <div className="grid grid-cols-6 h-full px-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center h-full active:bg-slate-50 transition-colors ${
                                isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                        >
                            <div className={`p-1 rounded-xl mb-0.5 transition-transform duration-200 ${
                                isActive ? '-translate-y-1' : ''
                            }`}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tight text-center leading-none ${
                                isActive ? 'opacity-100' : 'opacity-60'
                            }`}>
                                {item.mobileLabel}
                            </span>
                        </button>
                    )
                })}
            </div>
        </nav>

      </div>
    </div>
  );
};

export default Layout;