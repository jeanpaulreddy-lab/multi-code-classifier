import { RawDataRow, ProcessedRow } from "../types";

declare const XLSX: any;

// Unified File Parser (CSV & Excel & ODS)
export const parseDataFile = (file: File): Promise<RawDataRow[]> => {
  return new Promise((resolve, reject) => {
    // Check for Excel or OpenDocument Spreadsheet extensions
    const isSpreadsheet = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.ods');

    const reader = new FileReader();

    if (isSpreadsheet) {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
             reject("Empty file");
             return;
          }

          // Suppress noisy ODS warnings from SheetJS
          const originalConsoleLog = console.log;
          const originalConsoleError = console.error;
          
          const suppressMsg = (args: any[]) => 
            args.some(a => typeof a === 'string' && a.includes('ODS number format'));

          console.log = (...args) => {
            if (!suppressMsg(args)) originalConsoleLog.apply(console, args);
          };
          console.error = (...args) => {
             if (!suppressMsg(args)) originalConsoleError.apply(console, args);
          };

          let workbook;
          try {
            // Use type: 'array' for ArrayBuffer which is more robust for binary formats like ODS
            workbook = XLSX.read(data, { type: 'array' });
          } finally {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
          }

          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

          if (!jsonData || jsonData.length === 0) {
             resolve([]);
             return;
          }

          const headers = (jsonData[0] as string[]).map((h: string) => h?.trim() || '');
          const rows: RawDataRow[] = [];

          for (let i = 1; i < jsonData.length; i++) {
             const rowVals = jsonData[i] as any[];
             if (!rowVals || rowVals.length === 0) continue;

             const row: RawDataRow = { id: crypto.randomUUID() };
             headers.forEach((header, index) => {
                if (header) {
                   row[header] = rowVals[index] !== undefined ? String(rowVals[index]).trim() : '';
                }
             });
             rows.push(row);
          }
          resolve(rows);

        } catch (err) {
          reject(err);
        }
      };
      // Read as ArrayBuffer for better binary support (XLSX/ODS)
      reader.readAsArrayBuffer(file);
    } else {
      // CSV handling
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
           resolve([]); 
           return;
        }
        const lines = text.split(/\r\n|\n/);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        const data: RawDataRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const row: RawDataRow = { id: crypto.randomUUID() };
          const values: string[] = [];
          let inQuote = false;
          let currentValue = '';
          
          for (const char of lines[i]) {
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
              values.push(currentValue);
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue);

          headers.forEach((header, index) => {
            row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
          });
          
          data.push(row);
        }
        resolve(data);
      };
      reader.readAsText(file);
    }

    reader.onerror = (err) => reject(err);
  });
};

export const exportData = (rows: ProcessedRow[], baseFilename: string, format: 'csv' | 'xlsx' | 'ods') => {
  if (rows.length === 0) return;

  // Flatten and structure the data for export
  const exportData = rows.map(row => {
    // Extract internal fields to keep specific order or exclude them
    const { id, result, codingStatus, errorMessage, manuallyEdited, primaryText, secondaryText, ...rest } = row;
    
    // Combine original data with results
    return {
      ID: id,
      Input_Text: primaryText,
      Context: secondaryText,
      ...rest, // Other original columns
      Code: result?.code || '',
      Label: result?.label || '',
      Confidence: result?.confidence || '',
      Status: codingStatus,
      Reasoning: result?.reasoning || '',
      Manual_Edit: manuallyEdited ? 'Yes' : 'No',
      Error: errorMessage || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Coded Data");

  // Generate file
  XLSX.writeFile(workbook, `${baseFilename}.${format}`);
};