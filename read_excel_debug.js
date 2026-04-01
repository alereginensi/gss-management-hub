
const ExcelJS = require('exceljs');
const path = require('path');

async function readExcel() {
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), 'personal_casmu.xlsx');
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    
    console.log('Reading first 10 rows:');
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > 10) return;
      console.log(`Row ${rowNumber}:`, row.values.slice(1));
    });
    
  } catch (error) {
    console.error('Error reading Excel:', error);
    process.exit(1);
  }
}

readExcel();
