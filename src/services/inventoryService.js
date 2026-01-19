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

  // --- NUEVO: ACTUALIZAR PRECIO VARIANTE INDIVIDUAL ---
  updateVariantPrice: async (variantId, newPriceBRL) => {
      try {
          const { error } = await supabase
            .from('variants')
            .update({ price_sell_brl: newPriceBRL })
            .eq('id', variantId);
          
          if (error) throw error;
          return true;
      } catch (e) {
          console.error("Error updating price:", e);
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

    // 1. FASE DE AGRUPAMIENTO
    const groupedSales = {};

    for (const row of salesRows) {
        try {
            const prodName = normalize(row['Producto'] || row['name']);
            const measureName = normalize(row['Medida'] || row['Variante']);
            
            // Identificación de Variante
            let variantId = variantsMap[`${prodName}|${measureName}`];
            if (!variantId) variantId = variantsMap[prodName];
            if (!variantId) {
                const mapKeys = Object.keys(variantsMap);
                const partialKey = mapKeys.find(k => k.includes(prodName) || prodName.includes(k.split('|')[0]));
                if (partialKey) variantId = variantsMap[partialKey];
            }

            if (!variantId) {
                failed++;
                if (failed <= 10) errors.push(`No existe en BD: "${row['Producto']}"`);
                continue; 
            }

            // Datos de Fila
            const qty = Math.abs(parseFloat(row['Cantidad'] || row['qty'] || 0));
            const totalSale = Math.abs(parseFloat(row['Total Venta (R$)'] || row['Total'] || 0));
            const costUnit = Math.abs(parseFloat(row['Costo Unit. (R$)'] || row['Costo'] || 0)); 
            const saleDate = parseLatinDate(row['Fecha']);
            const clientName = (row['Cliente'] || 'CLIENTE').toUpperCase().trim();

            // Clave Única de Agrupación: YYYY-MM-DD + CLIENTE
            const dateKey = saleDate.toISOString().split('T')[0];
            const groupKey = `${dateKey}_${clientName}`;

            if (!groupedSales[groupKey]) {
                groupedSales[groupKey] = {
                    clientName: clientName,
                    date: saleDate, // Guardamos objeto Date para timestamp
                    totalBRL: 0,
                    items: []
                };
            }

            // Cálculo financiero del ítem
            const historicalCostTotal = costUnit * qty;
            const priceUnit = qty > 0 ? (totalSale / qty) : 0;

            groupedSales[groupKey].items.push({
                variant_id: variantId,
                quantity: qty,
                price_unit_brl: priceUnit,
                subtotal_brl: totalSale,
                historical_cost_unit_brl: costUnit,
                historical_cost_total_brl: historicalCostTotal
            });

            // Acumular Total del Ticket
            groupedSales[groupKey].totalBRL += totalSale;

        } catch (e) {
            console.error("Error parseando fila:", e);
            failed++;
        }
    }

    // 2. FASE DE INSERCIÓN (Por Grupos)
    const groups = Object.values(groupedSales);
    
    for (const group of groups) {
        try {
            // A. Crear Header Único
            const { data: saleHeader, error: headError } = await supabase
                .from('sales')
                .insert({
                    created_at: group.date.toISOString(), 
                    // REMOVIDO: client_name (Evitar crash si no existe columna)
                    // client_name: group.clientName,
                    total_brl: group.totalBRL,
                    discount_brl: 0
                })
                .select()
                .single();

            if (headError) throw headError;

            // B. Insertar todos los ítems de ese grupo
            const itemsPayload = group.items.map(item => ({
                sale_id: saleHeader.id,
                ...item
            }));

            const { error: itemError } = await supabase
                .from('sale_items')
                .insert(itemsPayload);

            if (itemError) throw itemError;
            success++; // Contamos 1 éxito por TICKET, no por ítem

        } catch (e) {
            console.error("Error insertando grupo:", e);
            failed++; // Fallo del ticket completo
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

  // --- ABASTECIMIENTO ---
  addSupply: async (variantId, addedQty, newCostSoles, newPriceSellBRL) => {
    if (!variantId) throw new Error("ID de Variante es requerido");

    const { data: currentVariant, error: fetchError } = await supabase
        .from('variants')
        .select('stock_quantity, price_buy_soles')
        .eq('id', variantId)
        .single();
    
    if (fetchError) throw fetchError;

    const currentStock = parseFloat(currentVariant.stock_quantity) || 0;
    const finalStock = currentStock + parseFloat(addedQty);

    const updatePayload = {
        stock_quantity: finalStock,
        price_buy_soles: newCostSoles > 0 ? newCostSoles : currentVariant.price_buy_soles
    };

    if (newPriceSellBRL > 0) {
        updatePayload.price_sell_brl = newPriceSellBRL;
    }

    const { error: updateError } = await supabase
        .from('variants')
        .update(updatePayload)
        .eq('id', variantId);

    if (updateError) throw updateError;
    return true;
  },

  // --- NUEVA LÓGICA DE VENTA TRANSACCIONAL (AGRUPADA) ---
  recordSaleTransaction: async (clientName, cartItems, globalDiscountBRL) => {
    const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
    
    // FIX: El campo client_name no existe en la base de datos de Supabase.
    // Se elimina del insert para evitar el error "Could not find the 'client_name' column".
    
    const subtotal = cartItems.reduce((acc, item) => acc + item.subtotalBRL, 0);
    const totalBRL = subtotal - globalDiscountBRL;

    const { data: saleHeader, error: headerError } = await supabase
        .from('sales')
        .insert({
            // client_name: (clientName || 'CLIENTE').toUpperCase(),  // REMOVIDO POR ERROR DE ESQUEMA
            total_brl: totalBRL,
            discount_brl: globalDiscountBRL
        })
        .select()
        .single();

    if (headerError) throw headerError;
    
    const saleId = saleHeader.id;

    for (const item of cartItems) {
        const { data: variant } = await supabase.from('variants').select('*').eq('id', item.id).single();
        
        if (!variant) continue;

        const weight = item.subtotalBRL / subtotal; 
        const itemDiscount = globalDiscountBRL * weight;
        const finalRevenue = item.subtotalBRL - itemDiscount;
        const unitPriceReal = finalRevenue / item.quantity;
        
        const historicalCostUnitBRL = variant.price_buy_soles * rate;
        const historicalCostTotalBRL = historicalCostUnitBRL * item.quantity;

        await supabase.from('sale_items').insert({
            sale_id: saleId,
            variant_id: item.id,
            quantity: item.quantity,
            price_unit_brl: unitPriceReal,
            subtotal_brl: finalRevenue,
            historical_cost_unit_brl: historicalCostUnitBRL,
            historical_cost_total_brl: historicalCostTotalBRL
        });

        const newStock = variant.stock_quantity - item.quantity;
        await supabase.from('variants').update({ stock_quantity: newStock }).eq('id', item.id);
    }
    
    return true;
  },

  // --- ACTUALIZAR VENTA EXISTENTE ---
  updateSaleTransaction: async (saleId, clientName, items) => {
      try {
          // REMOVIDO: Update de client_name para evitar error de esquema
          // await supabase.from('sales').update({ client_name: safeClient }).eq('id', saleId);

          let newTotalSaleBRL = 0;

          for (const item of items) {
              const qty = parseFloat(item.quantity) || 0;
              const subtotal = parseFloat(item.subtotal) || 0;
              
              const { data: oldItem } = await supabase
                .from('sale_items')
                .select('quantity, variant_id, historical_cost_unit_brl')
                .eq('id', item.id)
                .single();
              
              if (oldItem) {
                  const qtyDifference = oldItem.quantity - qty; 

                  if (qtyDifference !== 0) {
                      const { data: variant } = await supabase.from('variants').select('stock_quantity').eq('id', oldItem.variant_id).single();
                      if (variant) {
                          const newStock = variant.stock_quantity + qtyDifference;
                          await supabase.from('variants').update({ stock_quantity: newStock }).eq('id', oldItem.variant_id);
                      }
                  }

                  const priceUnit = qty > 0 ? (subtotal / qty) : 0;
                  const newHistoricalCostTotal = (oldItem.historical_cost_unit_brl || 0) * qty;

                  await supabase.from('sale_items').update({
                      quantity: qty,
                      subtotal_brl: subtotal,
                      price_unit_brl: priceUnit,
                      historical_cost_total_brl: newHistoricalCostTotal 
                  }).eq('id', item.id);
                  
                  newTotalSaleBRL += subtotal;
              }
          }

          await supabase.from('sales').update({ total_brl: newTotalSaleBRL }).eq('id', saleId);
          return true;

      } catch (e) {
          console.error("Error updating transaction:", e);
          throw e;
      }
  },

  // --- REPORTES Y ESTADÍSTICAS ---

  fetchTransactions: async () => {
    try {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (
                    *,
                    variants ( name, products ( name ) )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data.map(sale => {
            let totalCost = 0;
            // FIX: Ensure sale_items is array and properties are numbers to avoid white screen
            const items = (sale.sale_items || []).map(item => {
                const cost = parseFloat(item.historical_cost_total_brl || 0);
                totalCost += cost;
                return {
                    id: item.id,
                    productName: (item.variants?.products?.name || '?').toUpperCase(),
                    variantName: (item.variants?.name || '-').toUpperCase(),
                    quantity: parseFloat(item.quantity) || 0,
                    subtotal: parseFloat(item.subtotal_brl) || 0,
                    unitPrice: parseFloat(item.price_unit_brl) || 0 
                };
            });

            const revenue = parseFloat(sale.total_brl);
            const profit = revenue - totalCost;

            return {
                id: sale.id,
                // fallback if column missing
                clientName: sale.client_name || 'CLIENTE', 
                timestamp: new Date(sale.created_at).getTime(),
                totalRevenue: revenue,
                totalProfit: profit,
                items: items
            };
        });

    } catch (e) {
        console.error("Error fetching transactions:", e);
        return [];
    }
  },

  // --- BI: VALORIZACIÓN DE INVENTARIO ---
  fetchValuationData: async () => {
    try {
        const { data: variants, error } = await supabase
            .from('variants')
            .select(`
                id,
                name,
                stock_quantity,
                price_buy_soles,
                price_sell_brl,
                products ( name )
            `)
            .gt('stock_quantity', 0) // Solo lo que existe
            .order('stock_quantity', { ascending: false });

        if(error) throw error;

        const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
        
        return variants.map(v => {
            const stock = parseFloat(v.stock_quantity);
            const costBRL = (parseFloat(v.price_buy_soles) * rate);
            const saleBRL = parseFloat(v.price_sell_brl);

            return {
                id: v.id,
                productName: v.products?.name,
                variantName: v.name,
                stock: stock,
                unitCostBRL: costBRL,
                totalInvestmentBRL: stock * costBRL, // DINERO CONGELADO
                totalPotentialRevenueBRL: stock * saleBRL
            };
        });

    } catch (e) {
        console.error("Valuation Error:", e);
        return [];
    }
  },

  // --- BI: PRODUCTOS DE BAJA ROTACIÓN (HUESO) ---
  fetchSlowMovingItems: async () => {
      try {
          // 1. Obtener todos los items con su stock
          const { data: variants } = await supabase
            .from('variants')
            .select(`id, name, stock_quantity, price_buy_soles, products(name)`)
            .gt('stock_quantity', 0); // Solo importa lo que tenemos estancado

          // 2. Obtener la última venta de cada variante
          // (Como Supabase no tiene MAX() directo fácil en JS client sin RPC, hacemos query manual)
          // Optimizacion: Traemos solo sale_items con fecha
          const { data: sales } = await supabase
            .from('sale_items')
            .select('variant_id, sales(created_at)')
            .order('sales(created_at)', { ascending: false }); // Ordenado por fecha reciente
            
          const lastSalesMap = {};
          sales.forEach(s => {
              if (!lastSalesMap[s.variant_id]) {
                  lastSalesMap[s.variant_id] = new Date(s.sales.created_at);
              }
          });

          const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
          const today = new Date();
          const slowItems = [];

          variants.forEach(v => {
              const lastSaleDate = lastSalesMap[v.id];
              let daysSince = 999; // Si nunca se vendió

              if (lastSaleDate) {
                  const diffTime = Math.abs(today - lastSaleDate);
                  daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              }

              if (daysSince > 30) { // CRITERIO: Más de 30 días sin venta
                  slowItems.push({
                      id: v.id,
                      fullName: `${v.products?.name} ${v.name}`,
                      stock: v.stock_quantity,
                      frozenValue: v.stock_quantity * v.price_buy_soles * rate,
                      daysSinceSale: daysSince === 999 ? 'Nunca' : daysSince
                  });
              }
          });

          return slowItems.sort((a,b) => (b.daysSinceSale === 'Nunca' ? 1 : b.daysSinceSale) - (a.daysSinceSale === 'Nunca' ? 1 : a.daysSinceSale));

      } catch (e) {
          console.error("Slow Moving Error", e);
          return [];
      }
  },

  // --- DASHBOARD UPDATED ---
  fetchDashboardStats: async () => {
    try {
        const { data: variants } = await supabase.from('variants').select('stock_quantity, price_buy_soles, min_stock');
        const rate = parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || 1.6);
        
        let totalInventoryValueBRL = 0;
        let lowStockCount = 0;
        let restockCostBRL = 0; // NUEVO KPI: Capital necesario para reponer

        if (variants) {
            variants.forEach(v => {
                const stock = parseFloat(v.stock_quantity);
                const min = parseFloat(v.min_stock || 5);
                const costBRL = parseFloat(v.price_buy_soles) * rate;

                totalInventoryValueBRL += (stock * costBRL);
                
                if(stock <= min) {
                    lowStockCount++;
                    // Calcular costo para reponer hasta (min_stock + 5 buffer)
                    const targetStock = min + 5;
                    const needed = Math.max(0, targetStock - stock);
                    restockCostBRL += (needed * costBRL);
                }
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
            lowStockCount,
            restockCostBRL // Return new Metric
        };
    } catch (e) {
        return { totalInventoryValueBRL: 0, totalSalesTodayBRL: 0, totalProfitTodayBRL: 0, lowStockCount: 0, restockCostBRL: 0 };
    }
  },

  fetchSales: async () => {
      // Legacy support for Chart
      const rows = await InventoryService.fetchTransactions();
      return rows.map(r => ({
          timestamp: r.timestamp,
          salePriceTotalBRL: r.totalRevenue
      }));
  }
};