import { RawDataRow } from "../types";

declare const XLSX: any;

// Unified File Parser (CSV & Excel)
export const parseDataFile = (file: File): Promise<RawDataRow[]> => {
  return new Promise((resolve, reject) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
             reject("Empty file");
             return;
          }
          const workbook = XLSX.read(data, { type: 'binary' });
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
      reader.readAsBinaryString(file);
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

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      const val = row[fieldName] ? String(row[fieldName]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};