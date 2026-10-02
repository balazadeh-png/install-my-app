/**
 * Utilitarios de Parsing y Sincronización de Cartolas Bancarias
 * EasyERP - Módulo de Conciliación Bancaria (Norma Chilena / CLP)
 */

export interface ParsedBankMovement {
  movement_date: string; // YYYY-MM-DD
  description: string;
  reference_number?: string;
  debit_amount: number;  // Cargos / Salidas
  credit_amount: number; // Abonos / Entradas
  balance?: number;
}

/**
 * Limpia y normaliza números en formato chileno ($ 1.250.000 o 1250000.50)
 */
export function parseChileanAmount(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let s = String(val).trim().replace(/[$]/g, "").replace(/\s/g, "");

  // Si tiene puntos y comas: ej. 1.250.000,50
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // Si solo tiene coma: ej. 1250,50 o 1250000,00
    s = s.replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1) {
    // Múltiples puntos como separador de miles: 1.250.000
    s = s.replace(/\./g, "");
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza fechas en formato DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const clean = dateStr.trim();

  // Caso DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Caso YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Fallback
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Parser de texto CSV / TSV / Delimitado de Cartola Bancaria
 */
export function parseBankStatementCsv(text: string): ParsedBankMovement[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  // Detectar delimitador (tab, punto y coma, o coma)
  const firstLine = lines[0];
  let delimiter = ";";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes(",")) delimiter = ",";

  const rows: ParsedBankMovement[] = [];
  let headerIndex = -1;

  let colDate = -1;
  let colDesc = -1;
  let colRef = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colAmount = -1;
  let colBalance = -1;

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().toLowerCase().replace(/"/g, ""));
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      if (col.includes("fecha") || col.includes("fec")) colDate = c;
      else if (col.includes("descrip") || col.includes("detalle") || col.includes("glosa") || col.includes("concepto")) colDesc = c;
      else if (col.includes("doc") || col.includes("cheque") || col.includes("ref") || col.includes("nro") || col.includes("operacion")) colRef = c;
      else if (col.includes("cargo") || col.includes("debe") || col.includes("egreso") || col.includes("debito")) colDebit = c;
      else if (col.includes("abono") || col.includes("haber") || col.includes("ingreso") || col.includes("credito")) colCredit = c;
      else if (col.includes("monto") || col.includes("importe")) colAmount = c;
      else if (col.includes("saldo")) colBalance = c;
    }

    if (colDate !== -1 && (colDesc !== -1 || colAmount !== -1 || (colDebit !== -1 && colCredit !== -1))) {
      headerIndex = i;
      break;
    }
  }

  // Si no se detectaron cabeceras estándar, asumir orden típico:
  // Fecha | Descripción | Referencia | Cargo | Abono | Saldo
  if (headerIndex === -1) {
    colDate = 0;
    colDesc = 1;
    colRef = 2;
    colDebit = 3;
    colCredit = 4;
    colBalance = 5;
    headerIndex = 0;
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (rawCols.length < 2) continue;

    const rawDate = rawCols[colDate] || "";
    const rawDesc = rawCols[colDesc] || (colDesc !== -1 ? rawCols[colDesc] : "Movimiento Bancario");
    const rawRef = colRef !== -1 ? rawCols[colRef] : "";

    let debit = 0;
    let credit = 0;

    if (colDebit !== -1 && colCredit !== -1) {
      debit = parseChileanAmount(rawCols[colDebit]);
      credit = parseChileanAmount(rawCols[colCredit]);
    } else if (colAmount !== -1) {
      const amt = parseChileanAmount(rawCols[colAmount]);
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
    }

    const balance = colBalance !== -1 ? parseChileanAmount(rawCols[colBalance]) : 0;

    if (debit > 0 || credit > 0) {
      rows.push({
        movement_date: normalizeDate(rawDate),
        description: rawDesc || "Movimiento sin descripción",
        reference_number: rawRef || undefined,
        debit_amount: debit,
        credit_amount: credit,
        balance: balance,
      });
    }
  }

  return rows;
}

/**
 * Parser de texto extraído de cartolas PDF (Banco de Chile, Santander, BCI, Estado)
 */
export function parseBankStatementPdfText(text: string): ParsedBankMovement[] {
  const rows: ParsedBankMovement[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Regex para detectar líneas con fecha (DD/MM/YYYY o DD-MM-YYYY)
  const lineRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (!match) continue;

    const dateStr = match[1];
    const rest = match[2].trim();

    // Intentar extraer números al final de la línea: montos y saldos
    // En las cartolas típicamente los últimos números son: [N° Doc] [Cargo o Abono] [Saldo]
    const tokens = rest.split(/\s+/);
    if (tokens.length < 2) continue;

    // Buscar los montos monetarios desde el final
    const numericTokens: { index: number; value: number }[] = [];
    for (let j = tokens.length - 1; j >= 0; j--) {
      const cleanToken = tokens[j].replace(/[$]/g, "");
      if (/^-?[\d\.,]+$/.test(cleanToken)) {
        const parsed = parseChileanAmount(cleanToken);
        numericTokens.unshift({ index: j, value: parsed });
      } else {
        // Al encontrar el primer token no numérico, el resto a la izquierda es la glosa
        break;
      }
    }

    if (numericTokens.length === 0) continue;

    const descTokens = tokens.slice(0, numericTokens[0].index);
    const description = descTokens.join(" ");

    let debit = 0;
    let credit = 0;
    let balance = 0;

    if (numericTokens.length === 1) {
      const val = numericTokens[0].value;
      if (val < 0) debit = Math.abs(val);
      else credit = val;
    } else if (numericTokens.length === 2) {
      const val = numericTokens[0].value;
      balance = numericTokens[1].value;
      // Deducir si es cargo o abono por el texto o saldo
      if (description.toUpperCase().includes("CARGO") || description.toUpperCase().includes("COMISION") || description.toUpperCase().includes("TRANSF. A") || description.toUpperCase().includes("PAGO")) {
        debit = Math.abs(val);
      } else {
        credit = Math.abs(val);
      }
    } else if (numericTokens.length >= 3) {
      // Formato: [Cargo] [Abono] [Saldo] o [Ref] [Monto] [Saldo]
      debit = Math.abs(numericTokens[0].value);
      credit = Math.abs(numericTokens[1].value);
      balance = numericTokens[numericTokens.length - 1].value;
    }

    if (debit > 0 || credit > 0) {
      rows.push({
        movement_date: normalizeDate(dateStr),
        description: description || "Movimiento Cartola PDF",
        debit_amount: debit,
        credit_amount: credit,
        balance: balance,
      });
    }
  }

  return rows;
}

/**
 * Generador de Movimientos de Simulación para API Bancaria (Sandbox / Demo)
 * Genera movimientos correlacionados con las facturas pendientes de la empresa
 */
export function generateBankApiMockMovements(
  pendingSales: any[],
  pendingPurchases: any[]
): ParsedBankMovement[] {
  const movements: ParsedBankMovement[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let runningBalance = 15420000;

  // 1. Pago de Cliente (Abono exacto a factura de venta)
  if (pendingSales && pendingSales.length > 0) {
    const sale = pendingSales[0];
    const amount = Number(sale.balance_due || sale.total_amount || 250000);
    runningBalance += amount;
    movements.push({
      movement_date: today,
      description: `TRANSF. ELECTRONICA RECIBIDA ${sale.party_tax_id || "76.123.456-7"} ${sale.party_name || "CLIENTE"} PAGO FAC ${sale.invoice_number}`,
      reference_number: `TEF-${Math.floor(100000 + Math.random() * 900000)}`,
      debit_amount: 0,
      credit_amount: amount,
      balance: runningBalance,
    });
  } else {
    runningBalance += 485000;
    movements.push({
      movement_date: today,
      description: "TRANSF. ELECTRONICA RECIBIDA 76.852.147-9 COMERCIAL LOS ANDES SPA PAGO FAC FVE-0001",
      reference_number: `TEF-${Math.floor(100000 + Math.random() * 900000)}`,
      debit_amount: 0,
      credit_amount: 485000,
      balance: runningBalance,
    });
  }

  // 2. Pago a Proveedor (Cargo exacto a factura de compra)
  if (pendingPurchases && pendingPurchases.length > 0) {
    const purchase = pendingPurchases[0];
    const amount = Number(purchase.balance_due || purchase.total_amount || 180000);
    runningBalance -= amount;
    movements.push({
      movement_date: today,
      description: `TRANSF. ELECTRONICA EMITIDA A ${purchase.party_tax_id || "77.654.321-0"} ${purchase.party_name || "PROVEEDOR"} FAC ${purchase.invoice_number}`,
      reference_number: `TEF-${Math.floor(100000 + Math.random() * 900000)}`,
      debit_amount: amount,
      credit_amount: 0,
      balance: runningBalance,
    });
  } else {
    runningBalance -= 230000;
    movements.push({
      movement_date: today,
      description: "TRANSF. ELECTRONICA EMITIDA A 77.345.678-K DISTRIBUIDORA CENTRAL LTDA FAC FCP-0001",
      reference_number: `TEF-${Math.floor(100000 + Math.random() * 900000)}`,
      debit_amount: 230000,
      credit_amount: 0,
      balance: runningBalance,
    });
  }

  // 3. Comisión bancaria / Mantenimiento de cuenta
  runningBalance -= 18500;
  movements.push({
    movement_date: today,
    description: "COMISION MANTENCION MENSUAL CUENTA CORRIENTE PLAN EMPRESA",
    reference_number: `CARGO-CTA-${Math.floor(1000 + Math.random() * 9000)}`,
    debit_amount: 18500,
    credit_amount: 0,
    balance: runningBalance,
  });

  // 4. Impuesto Ley de Timbres y Estampillas o Retención
  runningBalance -= 3200;
  movements.push({
    movement_date: today,
    description: "IMPUESTO LEY DE TIMBRES Y ESTAMPILLAS D.L. 3475",
    reference_number: `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
    debit_amount: 3200,
    credit_amount: 0,
    balance: runningBalance,
  });

  return movements;
}
