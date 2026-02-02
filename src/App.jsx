import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProductForm from './components/ProductForm.jsx';
import SupplyForm from './components/SupplyForm.jsx';
import SalesForm from './components/SalesForm.jsx';
import InventoryList from './components/InventoryList.jsx';
import Reports from './components/Reports.jsx';
import DataImporter from './components/DataImporter.jsx'; // Nuevo Componente
import PieroAI from './components/PieroAI.jsx'; // Componente IA
import { InventoryService } from './services/inventoryService.js';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [exchangeRate, setExchangeRate] = useState(1.60);

  useEffect(() => {
    // Load initial rate
    setExchangeRate(InventoryService.getExchangeRate());
  }, []);

  const handleRateChange = (newRate) => {
    setExchangeRate(newRate);
    InventoryService.setExchangeRate(newRate);
  };

  // --- NOTIFICACIONES EN TIEMPO REAL ---
  useEffect(() => {
    // Suscribirse a nuevas ventas
    const unsubscribe = InventoryService.subscribeToSales((newSale) => {
      
      // 1. Reproducir sonido de caja registradora
      const audio = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=cash-register-purchase-87313.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log("Audio play blocked", e));

      // Verificar si tenemos permiso para notificar
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("💰 ¡Nueva Venta Registrada!", {
          body: `Se registró una venta por R$ ${parseFloat(newSale.total_brl).toFixed(2)}`,
          icon: '/vite.svg', // O el icono de tu app
          requireInteraction: false // Se oculta sola después de unos segundos
        });
      }
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'products': return <ProductForm />;
      case 'supply': return <SupplyForm />;
      case 'sales': return <SalesForm />;
      case 'inventory': return <InventoryList />;
      case 'reports': return <Reports />;
      case 'settings': return <DataImporter />; // Nueva Pestaña
      case 'ai-assistant': return <PieroAI />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      currentRate={exchangeRate}
      onRateChange={handleRateChange}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;