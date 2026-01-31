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