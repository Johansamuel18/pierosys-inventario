import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://zhjwhllxznfzeudwryhy.supabase.co'; 
const supabaseKey = 'sb_publishable_W1EeD7BvFF6n-s58NcikOg_n-VVPcxm';

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY_RATE = 'piero_rate';

// Helper para normalizar strings (quitar espacios extra, minusculas)
const normalize = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().trim();
};

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
        if (!data) return [];
        
        return data.map(p => ({
            id: p.id,
            name: p.name.toUpperCase(), // FORZAR VISUALIZACIÓN MAYUSCULA
            type: p.type,
            variants: (p.variants || []).map(v => ({
                id: v.id,
                name: v.name.toUpperCase(), // FORZAR VISUALIZACIÓN MAYUSCULA
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
        console.warn("Error conexión DB:", e.message);
        return [];
    }
  },

  // --- HELPER: MAPA DE VARIANTES (Para Importación Ventas) ---
  getVariantsMap: async () => {
    try {
        const { data, error } = await supabase
            .from('variants')
            .select('id, name, products (name)');

        if (error) throw error;

        // Creamos un Map normalizado para búsqueda flexible
        const map = {};
        
        data.forEach(v => {
            const prodName = normalize(v.products?.name);
            const varName = normalize(v.name);
            
            // 1. Coincidencia exacta Prod + Var
            map[`${prodName}|${varName}`] = v.id;
            
            // 2. Coincidencia solo producto (fallback)
            if (!map[prodName]) {
                map[prodName] = v.id;
            }
        });
        
        return map;
    } catch (e) {
        console.error("Error building variants map", e);
        return {};
    }
  },

  // --- CREAR PRODUCTO ---
  addProduct: async (productData) => {
    try {
        const { data: productResult, error: prodError } = await supabase
            .from('products')
            .insert({
                name: productData.name.toUpperCase().trim(), // SIEMPRE MAYUSCULA
                type: productData.type
            })
            .select()
            .single();

        if (prodError) throw prodError;

        const variantsPayload = productData.variants.map(v => ({
            product_id: productResult.id,
            name: v.name.toUpperCase().trim(), // SIEMPRE MAYUSCULA
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

  // --- ACTUALIZAR NOMBRE PRODUCTO (RENOMBRAR) ---
  updateProductName: async (productId, newName) => {
      try {
          const finalName = newName.toUpperCase().trim();
          const { error } = await supabase
            .from('products')
            .update({ name: finalName })
            .eq('id', productId);
          
          if (error) throw error;
          return true;
      } catch (e) {
          console.error("Error updating product name:", e);
          throw e;
      }
  },

  // --- AGREGAR VARIANTE A PRODUCTO EXISTENTE ---
  addVariant: async (productId, variantData) => {
      try {
          const { error } = await supabase
            .from('variants')
            .insert({
                product_id: productId,
                name: variantData.name.toUpperCase().trim(),
                price_buy_soles: variantData.price_buy_soles,
                price_sell_brl: variantData.price_sell_brl,
                stock_quantity: variantData.stock_quantity,
                purchase_unit: variantData.purchase_unit || 'UNIDAD', 
                sales_unit: 'UND',
                conversion_factor: variantData.conversion_factor || 1,
                min_stock: 5
            });
          
          if (error) throw error;
          return true;
      } catch (e) {
          console.error("Error adding variant:", e);
          throw e;
      }
  },

  // --- IMPORTACIÓN MASIVA INVENTARIO ---
  importProductBatch: async (groupedProduct) => {
    const productNameUpper = groupedProduct.name.toUpperCase().trim();

    // 1. Verificar si el producto ya existe
    let productId = null;
    
    const { data: existing } = await supabase
        .from('products')
        .select('id')
        .ilike('name', productNameUpper) // Comparación insensible a mayusculas pero el nombre ya va en mayus
        .maybeSingle();

    if (existing) {
        productId = existing.id;
        
        // Si ya existe, ACTUALIZAMOS STOCK
        const { data: existingVars } = await supabase
            .from('variants')
            .select('id, name')
            .eq('product_id', productId);
            
        for (const vNew of groupedProduct.variants) {
             const targetVar = existingVars?.find(ev => normalize(ev.name) === normalize(vNew.name)) || existingVars?.[0];
             
             if (targetVar) {
                 await supabase.from('variants')
                    .update({ 
                        stock_quantity: vNew.stock_quantity,
                        price_buy_soles: vNew.price_buy_soles,
                        price_sell_brl: vNew.price_sell_brl
                    })
                    .eq('id', targetVar.id);
             } else {
                 await supabase.from('variants').insert({
                    product_id: productId,
                    name: vNew.name.toUpperCase().trim(),
                    purchase_unit: vNew.purchase_unit,
                    sales_unit: vNew.sales_unit,
                    conversion_factor: vNew.conversion_factor,
                    price_buy_soles: vNew.price_buy_soles,
                    price_sell_brl: vNew.price_sell_brl,
                    stock_quantity: vNew.stock_quantity,
                 });
             }
        }
        return true;

    } else {
        // Crear Padre Nuevo
        const { data: newProd, error } = await supabase
            .from('products')
            .insert({ 
                name: productNameUpper, 
                type: groupedProduct.type 
            })
            .select()
            .single();
        if (error) throw error;
        productId = newProd.id;

        const variantsPayload = groupedProduct.variants.map(v => ({
            product_id: productId,
            name: v.name.toUpperCase().trim(),
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
    }
  },

  // --- IMPORTACIÓN HISTORIAL VENTAS ---
  importHistoricalSales: async (salesRows, variantsMap) => {
    let success = 0;
    let failed = 0;
    const errors = [];

    const parseLatinDate = (dateStr) => {
        if (!dateStr) return new Date(); 
        if (dateStr instanceof Date) return dateStr;
        if (typeof dateStr === 'number') {
             return new Date(Math.round((dateStr - 25569)*86400*1000));
        }
        try {
            const parts = String(dateStr).split(/[\/\-]/); 
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            return new Date(dateStr); 
        } catch (e) { return new Date(); }
    };

    for (const row of salesRows) {
        try {
            const prodName = normalize(row['Producto'] || row['name']);
            const measureName = normalize(row['Medida'] || row['Variante']);
            
            let variantId = variantsMap[`${prodName}|${measureName}`];
            if (!variantId) variantId = variantsMap[prodName];

            if (!variantId) {
                // Intento fuzzy
                const mapKeys = Object.keys(variantsMap);
                const partialKey = mapKeys.find(k => k.includes(prodName) || prodName.includes(k.split('|')[0]));
                if (partialKey) variantId = variantsMap[partialKey];
            }

            if (!variantId) {
                failed++;
                if (failed <= 10) errors.push(`No existe en BD: "${row['Producto']}"`);
                continue; 
            }

            const qty = Math.abs(parseFloat(row['Cantidad'] || row['qty'] || 0));
            const totalSale = Math.abs(parseFloat(row['Total Venta (R$)'] || row['Total'] || 0));
            const costUnit = Math.abs(parseFloat(row['Costo Unit. (R$)'] || row['Costo'] || 0)); 
            const saleDate = parseLatinDate(row['Fecha']);

            const { data: saleHeader, error: headError } = await supabase
                .from('sales')
                .insert({
                    created_at: saleDate.toISOString(), 
                    total_brl: totalSale,
                    discount_brl: 0
                })
                .select()
                .single();

            if (headError) throw headError;

            const historicalCostTotal = costUnit * qty;
            const priceUnit = qty > 0 ? (totalSale / qty) : 0;

            const { error: itemError } = await supabase
                .from('sale_items')
                .insert({
                    sale_id: saleHeader.id,
                    variant_id: variantId,
                    quantity: qty,
                    price_unit_brl: priceUnit,
                    subtotal_brl: totalSale,
                    historical_cost_unit_brl: costUnit,
                    historical_cost_total_brl: historicalCostTotal
                });

            if (itemError) throw itemError;
            success++;
        } catch (e) {
            console.error("Row Error:", e);
            failed++;
        }
    }
    return { success, failed, errors };
  },

  // --- BORRAR PRODUCTO COMPLETO ---
  deleteProduct: async (id) => {
    try {
        const { data: variants } = await supabase.from('variants').select('id').eq('product_id', id);
        
        if (variants && variants.length > 0) {
            const variantIds = variants.map(v => v.id);
            const { error: salesError } = await supabase.from('sale_items').delete().in('variant_id', variantIds);
            if (salesError) console.warn("Error borrando historial ventas:", salesError);

            const { error: varError } = await supabase.from('variants').delete().in('id', variantIds);
            if (varError) throw varError;
        }

        const { error: prodError } = await supabase.from('products').delete().eq('id', id);
        if (prodError) throw prodError;

        return true;
    } catch (e) {
        console.error("Error eliminando producto:", e.message);
        throw e;
    }
  },

  // --- BORRAR VARIANTE INDIVIDUAL ---
  deleteVariant: async (variantId) => {
      try {
        const { error: salesError } = await supabase.from('sale_items').delete().eq('variant_id', variantId);
        if (salesError) console.warn("Error limpiando ventas de la variante:", salesError.message);

        const { error } = await supabase.from('variants').delete().eq('id', variantId);
        if (error) throw error;
        
        return true;
      } catch (e) {
          console.error("Error eliminando variante:", e);
          throw e;
      }
  },

  deleteAllData: async () => {
      try {
          await supabase.from('sale_items').delete().neq('id', 0); 
          await supabase.from('sales').delete().neq('id', 0);
          await supabase.from('variants').delete().neq('id', 0);
          await supabase.from('products').delete().neq('id', 0);
          return true;
      } catch (e) {
          console.error("Error reseteando DB:", e);
          throw e;
      }
  },

  // --- ABASTECIMIENTO (CRÍTICO: STOCK + COSTO + PRECIO) ---
  addSupply: async (variantId, addedQty, newCostSoles, newPriceSellBRL) => {
    if (!variantId) throw new Error("ID de Variante es requerido");

    // 1. Obtener datos actuales (para sumar stock)
    const { data: currentVariant, error: fetchError } = await supabase
        .from('variants')
        .select('stock_quantity, price_buy_soles')
        .eq('id', variantId)
        .single();
    
    if (fetchError) throw fetchError;

    // 2. Calcular nuevo stock
    const currentStock = parseFloat(currentVariant.stock_quantity) || 0;
    const finalStock = currentStock + parseFloat(addedQty);

    // 3. Objeto de actualización
    const updatePayload = {
        stock_quantity: finalStock,
        price_buy_soles: newCostSoles > 0 ? newCostSoles : currentVariant.price_buy_soles
    };

    // 4. Si viene nuevo precio de venta, lo agregamos al update
    if (newPriceSellBRL > 0) {
        updatePayload.price_sell_brl = newPriceSellBRL;
    }

    // 5. Ejecutar Update Atómico
    const { error: updateError } = await supabase
        .from('variants')
        .update(updatePayload)
        .eq('id', variantId);

    if (updateError) throw updateError;
    return true;
  },

  // --- VENTA ---
  processSale: async (productId, variantId, quantitySold, totalPriceBRL) => {
    const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
    
    // Obtener datos frescos de la variante
    const { data: variant } = await supabase
        .from('variants')
        .select('*')
        .eq('id', variantId)
        .single();
        
    if(!variant) throw new Error("Variante no encontrada");

    const costSolesCurrent = variant.price_buy_soles;
    const currentStock = variant.stock_quantity;

    const unitPriceBRL = quantitySold > 0 ? (totalPriceBRL / quantitySold) : 0;
    const historicalCostUnitBRL = costSolesCurrent * rate;
    const historicalCostTotalBRL = historicalCostUnitBRL * quantitySold;

    // Header Venta
    const { data: saleHeader, error: saleError } = await supabase
        .from('sales')
        .insert({
            total_brl: totalPriceBRL,
            discount_brl: 0
        })
        .select()
        .single();

    if (saleError) throw saleError;

    // Item Venta
    const { error: itemError } = await supabase
        .from('sale_items')
        .insert({
            sale_id: saleHeader.id,
            variant_id: variantId,
            quantity: quantitySold,
            price_unit_brl: unitPriceBRL,
            subtotal_brl: totalPriceBRL,
            historical_cost_unit_brl: historicalCostUnitBRL,
            historical_cost_total_brl: historicalCostTotalBRL
        });

    if (itemError) throw itemError;

    // Descontar Stock
    const { error: stockError } = await supabase
        .from('variants')
        .update({ stock_quantity: currentStock - quantitySold })
        .eq('id', variantId);

    if (stockError) throw stockError;

    return true;
  },

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
                productName: (item.variants?.products?.name || '?').toUpperCase(), // Forzar Mayuscula
                variantName: (item.variants?.name || '-').toUpperCase(), // Forzar Mayuscula
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