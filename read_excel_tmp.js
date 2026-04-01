
const ExcelJS = require('exceljs');
const path = require('path');

async function readExcel() {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), 'personal_casmu.xlsx');
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const data = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      data.push({
        nombre: row.getCell(1).value,
        cedula: row.getCell(2).value
      });
    });
    
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error reading Excel:', error);
    process.exit(1);
  }
}

readExcel();
