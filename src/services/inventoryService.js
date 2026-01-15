import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN SUPABASE ---
// Asegúrate de que estas credenciales coincidan con las de tu proyecto en Supabase (Project Settings -> API)
const supabaseUrl = 'https://zhjwhllxznfzeudwryhy.supabase.co'; 
const supabaseKey = 'sb_publishable_W1EeD7BvFF6n-s58NcikOg_n-VVPcxm'; // Reemplaza esto con tu PUBLIC KEY real si es diferente

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_RATE = 'piero_rate';

export const InventoryService = {
  // --- TASA DE CAMBIO ---
  getExchangeRate: () => {
    const rate = localStorage.getItem(STORAGE_KEY_RATE);
    return rate ? parseFloat(rate) : 1.60;
  },

  setExchangeRate: (rate) => {
    localStorage.setItem(STORAGE_KEY_RATE, rate.toString());
  },

  // --- PRODUCTOS ---
  getProducts: async () => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                variants (*)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!data) return []; // VALIDACIÓN CRÍTICA: Supabase puede devolver null
        
        return data.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            variants: (p.variants || []).map(v => ({
                id: v.id,
                name: v.name,
                productId: v.product_id,
                purchaseUnit: v.purchase_unit,
                salesUnit: v.sales_unit,
                conversionFactor: parseFloat(v.conversion_factor),
                priceBuySoles: parseFloat(v.price_buy_soles),
                priceSellBRL: parseFloat(v.price_sell_brl),
                stock: parseFloat(v.stock_quantity),
                minStock: parseFloat(v.min_stock || 5),
                salePriceTotalBRL: parseFloat(v.price_sell_brl),
                quantity: parseFloat(v.stock_quantity)
            }))
        }));
    } catch (e) {
        console.error("Supabase Error (getProducts):", e.message);
        // Alertar al usuario si es un error de conexión/permisos
        if(e.message) console.warn("Error de conexión DB: " + e.message); // Cambiado a warn para no bloquear UI con alertas constantes
        return [];
    }
  },

  // --- CREAR PRODUCTO ---
  addProduct: async (productData) => {
    try {
        // 1. Insertar Producto
        const { data: productResult, error: prodError } = await supabase
            .from('products')
            .insert({
                name: productData.name,
                type: productData.type
            })
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Insertar Variantes
        const variantsPayload = productData.variants.map(v => ({
            product_id: productResult.id,
            name: v.name,
            purchase_unit: v.purchase_unit,
            sales_unit: v.sales_unit,
            conversion_factor: v.conversion_factor,
            price_buy_soles: v.price_buy_soles,
            price_sell_brl: v.price_sell_brl,
            stock_quantity: v.stock_quantity,
            min_stock: 5
        }));

        const { error: varError } = await supabase
            .from('variants')
            .insert(variantsPayload);

        if (varError) throw varError;
        return true;
    } catch (e) {
        console.error("Supabase Error:", e.message);
        throw e;
    }
  },

  // --- BORRAR ---
  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- ABASTECIMIENTO ---
  addSupply: async (productId, variantId, quantityInput, unitName, contentPerUnit, costPerInputUnitSoles) => {
    let targetVariantId = variantId;
    
    // Si no hay variante, buscar la primera del producto
    if (!targetVariantId) {
        const { data } = await supabase.from('variants').select('id').eq('product_id', productId).limit(1);
        if (data && data.length > 0) targetVariantId = data[0].id;
    }

    if (!targetVariantId) throw new Error("Variante no encontrada");

    // Leer estado actual
    const { data: currentVariant, error: fetchError } = await supabase
        .from('variants')
        .select('*')
        .eq('id', targetVariantId)
        .single();
    
    if (fetchError) throw fetchError;

    const qty = parseFloat(quantityInput) || 0;
    const factor = parseFloat(contentPerUnit) || parseFloat(currentVariant.conversion_factor) || 1;
    const stockToAdd = qty * factor;
    
    const newCostUnitSoles = costPerInputUnitSoles > 0 ? (costPerInputUnitSoles / factor) : currentVariant.price_buy_soles;

    // Actualizar
    const { error: updateError } = await supabase
        .from('variants')
        .update({
            stock_quantity: parseFloat(currentVariant.stock_quantity) + stockToAdd,
            price_buy_soles: newCostUnitSoles
        })
        .eq('id', targetVariantId);

    if (updateError) throw updateError;
    return stockToAdd;
  },

  // --- VENTAS ---
  processSale: async (productId, variantId, quantitySold, totalPriceBRL) => {
    const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
    
    // 1. Obtener Costo Actual
    let targetVariantId = variantId;
    let costSolesCurrent = 0;
    let currentStock = 0;

    if(!targetVariantId) {
         const { data } = await supabase.from('variants').select('*').eq('product_id', productId).limit(1);
         if(data && data[0]) {
             targetVariantId = data[0].id;
             costSolesCurrent = data[0].price_buy_soles;
             currentStock = data[0].stock_quantity;
         } else {
             throw new Error("Producto sin variantes");
         }
    } else {
        const { data } = await supabase.from('variants').select('*').eq('id', targetVariantId).single();
        if(!data) throw new Error("Variante no encontrada en BD");
        costSolesCurrent = data.price_buy_soles;
        currentStock = data.stock_quantity;
    }

    // Validación de Stock (opcional, se puede permitir negativo si se desea)
    // if (currentStock < quantitySold) throw new Error(`Stock Insuficiente (Actual: ${currentStock})`);

    // 2. Cálculos Congelados
    const unitPriceBRL = quantitySold > 0 ? (totalPriceBRL / quantitySold) : 0;
    const historicalCostUnitBRL = costSolesCurrent * rate;
    const historicalCostTotalBRL = historicalCostUnitBRL * quantitySold;

    // 3. Header Venta
    const { data: saleHeader, error: saleError } = await supabase
        .from('sales')
        .insert({
            total_brl: totalPriceBRL,
            discount_brl: 0
        })
        .select()
        .single();

    if (saleError) throw saleError;

    // 4. Item Venta
    const { error: itemError } = await supabase
        .from('sale_items')
        .insert({
            sale_id: saleHeader.id,
            variant_id: targetVariantId,
            quantity: quantitySold,
            price_unit_brl: unitPriceBRL,
            subtotal_brl: totalPriceBRL,
            historical_cost_unit_brl: historicalCostUnitBRL,
            historical_cost_total_brl: historicalCostTotalBRL
        });

    if (itemError) throw itemError;

    // 5. Restar Stock
    const { error: stockError } = await supabase
        .from('variants')
        .update({ stock_quantity: currentStock - quantitySold })
        .eq('id', targetVariantId);

    if (stockError) throw stockError;

    return true;
  },

  // --- REPORTES ---
  fetchSales: async () => {
    try {
        const { data, error } = await supabase
            .from('sale_items')
            .select(`
                *,
                sales ( created_at ),
                variants ( name, products ( name ) )
            `)
            .order('id', { ascending: false });

        if (error) throw error;
        if (!data) return [];

        return data.map(item => {
            const revenue = parseFloat(item.subtotal_brl);
            const cost = parseFloat(item.historical_cost_total_brl || 0);
            const profit = revenue - cost;

            return {
                id: item.id,
                timestamp: new Date(item.sales?.created_at).getTime(),
                productName: item.variants?.products?.name || '?',
                variantName: item.variants?.name || '-',
                quantity: parseFloat(item.quantity),
                salePriceTotalBRL: revenue,
                historicalCostTotalBRL: cost,
                grossProfitBRL: profit,
                marginPercent: revenue > 0 ? ((profit / revenue) * 100) : 0
            };
        });
    } catch (e) {
        console.error(e);
        return [];
    }
  },

  // --- DASHBOARD ---
  fetchDashboardStats: async () => {
    try {
        const { data: variants } = await supabase.from('variants').select('stock_quantity, price_buy_soles, min_stock');
        const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
        
        let totalInventoryValueBRL = 0;
        let lowStockCount = 0;

        if (variants) {
            variants.forEach(v => {
                totalInventoryValueBRL += (v.stock_quantity * v.price_buy_soles * rate);
                if(v.stock_quantity <= (v.min_stock || 5)) lowStockCount++;
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const { data: salesToday } = await supabase
            .from('sale_items')
            .select('subtotal_brl, historical_cost_total_brl, sales!inner(created_at)')
            .gte('sales.created_at', `${today}T00:00:00`);

        let totalSalesTodayBRL = 0;
        let totalProfitTodayBRL = 0;

        if (salesToday) {
            salesToday.forEach(s => {
                const venta = parseFloat(s.subtotal_brl);
                const costo = parseFloat(s.historical_cost_total_brl);
                totalSalesTodayBRL += venta;
                totalProfitTodayBRL += (venta - costo);
            });
        }

        return {
            totalInventoryValueBRL,
            totalSalesTodayBRL,
            totalProfitTodayBRL,
            lowStockCount
        };
    } catch (e) {
        return { totalInventoryValueBRL: 0, totalSalesTodayBRL: 0, totalProfitTodayBRL: 0, lowStockCount: 0 };
    }
  }
};