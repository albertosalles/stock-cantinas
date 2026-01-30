import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '@/lib/supabaseClient';

// --- CONFIGURACIÓN DE RANGOS ---
// Aquí defines dónde empieza y termina cada hoja.
// Si mañana cambia la plantilla, solo tocas estos números.
const SHEET_CONFIG = {
    headerRow: 2,    // Dónde están las cabeceras (T.D, T.I...)
    productCol: 1,   // Columna A
    ranges: [
        { keyword: 'JUMPERS', minRow: 3, maxRow: 15 },
        { keyword: 'MATUTANO', minRow: 3, maxRow: 8 },
        { keyword: 'GREFUSA', minRow: 3, maxRow: 4 } // Puedes ajustar esto a maxRow: 5 si quieres
    ]
};

function normalizeName(name: string): string {
    if (!name) return '';
    return name
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, '')
        .trim();
}

export async function exportInventoryToExcel(eventId: string, eventName: string) {
    try {
        console.time("⏱️ Exportación"); // Cronómetro para medir rendimiento

        // 1. Cargar datos (Supabase + Plantilla) en paralelo para ganar velocidad
        const [templateBuffer, inventoryResponse] = await Promise.all([
            fetch('/plantilla_inventario.xlsx').then(res => {
                if (!res.ok) throw new Error('Error cargando plantilla');
                return res.arrayBuffer();
            }),
            supabase
                .from('v_cantina_inventory')
                .select(`current_qty, products (name), cantinas (name, location)`)
                .eq('event_id', eventId)
        ]);

        const { data: inventoryData, error } = inventoryResponse;
        if (error) throw error;
        if (!inventoryData?.length) {
            alert("No hay datos de inventario.");
            return;
        }

        // 2. Procesar Excel
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);

        // Creamos un mapa rápido de los datos de la BD para no recorrer el array mil veces
        // Clave: "PRODUCTO_UBICACION" -> Valor: Cantidad
        const dbMap = new Map<string, number>();
        inventoryData.forEach((item: any) => {
            const pKey = normalizeName(item.products?.name);
            const lKey = normalizeName(item.cantinas?.location);
            if (pKey && lKey) {
                dbMap.set(`${pKey}_${lKey}`, item.current_qty);
            }
        });

        // 3. Recorrer Hojas
        workbook.eachSheet((worksheet) => {
            const sheetName = worksheet.name.toUpperCase();

            // A. Buscar configuración para esta hoja
            const config = SHEET_CONFIG.ranges.find(c => sheetName.includes(c.keyword));

            // Si la hoja no es una de las 3 configuradas, la ignoramos y pasamos a la siguiente
            if (!config) return;

            console.log(`⚡️ Procesando "${sheetName}" (Filas ${config.minRow}-${config.maxRow})`);

            // B. Mapear Columnas (Cantinas) - Solo miramos la fila de cabecera
            const cantinaCols = new Map<string, number>();
            const headerRow = worksheet.getRow(SHEET_CONFIG.headerRow);
            headerRow.eachCell((cell, colNumber) => {
                if (cell.value) cantinaCols.set(normalizeName(String(cell.value)), colNumber);
            });

            // C. Recorrer SOLO las filas del rango (Optimización clave)
            // En lugar de "eachRow" (que lee todo), usamos un for loop acotado.
            for (let r = config.minRow; r <= config.maxRow; r++) {
                const row = worksheet.getRow(r);
                const cellProduct = row.getCell(SHEET_CONFIG.productCol).value;

                if (cellProduct) {
                    const productKey = normalizeName(String(cellProduct));

                    // D. Rellenar datos
                    // Ya estamos en la fila correcta y tenemos el producto.
                    // Miramos si tenemos datos para CADA cantina detectada en las columnas.
                    cantinaCols.forEach((colIndex, locationKey) => {
                        // Construimos la clave única que creamos antes
                        const uniqueKey = `${productKey}_${locationKey}`;

                        if (dbMap.has(uniqueKey)) {
                            const qty = dbMap.get(uniqueKey);
                            const cell = row.getCell(colIndex); // Usamos row.getCell es más rápido que worksheet.getCell
                            cell.value = qty;
                        }
                    });
                }
            }
        });

        // 4. Descargar
        const outBuffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const safeEventName = eventName.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
        saveAs(blob, `Cierre_${safeEventName}.xlsx`);

        console.timeEnd("⏱️ Exportación");
        return true;

    } catch (e) {
        console.error('❌ ERROR EXPORT:', e);
        throw e;
    }
}