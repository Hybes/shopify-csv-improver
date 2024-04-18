const XLSX = require('xlsx');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;

async function processXlsxFile(inputFilePath, outputFilePath, secondFilePath) {
  const workbook = XLSX.readFile(inputFilePath);
  const secondWorkbook = XLSX.readFile(secondFilePath); // Read the second file

  const sheetName = workbook.SheetNames[0];
  const secondSheetName = secondWorkbook.SheetNames[0]; // Assume first sheet for simplicity

  const sheet = workbook.Sheets[sheetName];
  const secondSheet = secondWorkbook.Sheets[secondSheetName]; // Get sheet from second file

  const data = XLSX.utils.sheet_to_json(sheet);
  const secondData = XLSX.utils.sheet_to_json(secondSheet); // Convert second sheet to JSON

  const secondDataMap = secondData.reduce((acc, row) => {
    acc[row.Master] = row; // Use 'Master' as key
    return acc;
  }, {});

  // Group data by base SKU
  const groupedData = data.reduce((acc, row) => {
    const match = row['SKU code'].match(/(.+)-[A-Z0-9]+$/i);
    if (match) {
      const baseSKU = match[1];
      const colorway = row['Colorway']; // Extract colorway
      const masterKey = `${baseSKU.split('-')[0]}-${colorway}`; // Combine baseSKU and colorway for unique grouping
      if (!acc[masterKey]) {
        acc[masterKey] = [];
      }
      acc[masterKey].push(row);
    }
    return acc;
  }, {});

  // Process each group to handle variants
  const csvData = [];
Object.values(groupedData).forEach(group => {
  // Your existing sorting logic here (if needed)

  group.forEach((row, index) => {
    const size = row['SKU code'].match(/-(\w+)$/)?.[1];
    const baseSKU = row['SKU code'].match(/(.+)-[A-Z0-9]+$/i)[1];
    const colorway = row['Colorway']; // Extract colorway
    const masterKey = `${baseSKU.split('-')[0]}`; // Use the baseSKU portion for lookup in secondDataMap
    const secondRow = secondDataMap[masterKey]; // Find matching row in secondDataMap
    if (index === 0) { // First item in each color group, add full details
      csvData.push(createCsvRow(row, size, true, secondRow)); // Pass secondRow for title and description
    } else { // Variant, add minimal details
      csvData.push(createCsvRow(row, size, false, secondRow)); // Still pass secondRow for potential title and description reuse
    };
  });
});

  const csvWriterInstance = csvWriter({
    path: outputFilePath,
    header: [
      {id: 'Handle', title: 'Handle'},
      {id: 'Title', title: 'Title'},
      {id: 'Body', title: 'Body (HTML)'},
      {id: 'Vendor', title: 'Vendor'},
      {id: 'Type', title: 'Type'},
      {id: 'Tags', title: 'Tags'},
      {id: 'Published', title: 'Published'},
      {id: 'Option1_Name', title: 'Option1 Name'},
      {id: 'Option1_Value', title: 'Option1 Value'},
      {id: 'Variant_SKU', title: 'Variant SKU'},
      {id: 'Variant_Inventory_Qty', title: 'Variant Inventory Qty'},
      {id: 'Variant_Price', title: 'Variant Price'},
      {id: 'Variant_Compare_At_Price', title: 'Variant Compare At Price'},
      {id: 'Variant_Requires_Shipping', title: 'Variant Requires Shipping'},
      {id: 'Variant_Taxable', title: 'Variant Taxable'},
      {id: 'Image_Src', title: 'Image Src'},
      { id: 'Image_Alt_Text', title: 'Image Alt Text' },
      { id: 'Status', title: 'Status'}
    ]
  });

  await csvWriterInstance.writeRecords(csvData)
    .then(() => console.log('The CSV file was written successfully'));
  }

function createCsvRow(row, sizeCode, isDefaultVariant, secondRow) {
  const sizeMapping = {
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    XL: 'XLarge',
    XS: 'XSmall',
    '2X': '2XLarge',
    XXL: '2XLarge',
    '3XL': '3XLarge',
    YXS: 'Youth XSmall',
    YS: 'Youth Small',
    YM: 'Youth Medium',
    YL: 'Youth Large',
    YXL: 'Youth XLarge',
    OS: 'One Size'
  };
  const sizeFullName = sizeMapping[sizeCode] || sizeCode;
  const title = secondRow ? `${secondRow['Product Name']} ${row['Colorway']}` : row['Material Description'];
  const body = secondRow ? `${secondRow['Description']} ${secondRow['Specifications']}` : `<h1>${row['Material Description No Color']}</h1><p>${row['Main Materials']}</p>`;

  if (isDefaultVariant) {
    return {
      Handle: row['Material'] + '-' + row['Colorway'],
      Title: title,
      Body: body,
      Vendor: 'Fox',
      Type: row['Product Hierarchy Desc 2'],
      Tags: [row['Collection'], row['Franchise'], row['Product Hierarchy Desc 3'], row['Product Hierarchy Desc 4'], row['Product Hierarchy Desc 5'], row['Product Hierarchy Desc 6']].filter(Boolean).join(', '),
      Published: 'TRUE',
      Option1_Name: 'Size',
      Option1_Value: sizeFullName,
      Variant_SKU: row['SKU code'],
      Variant_Inventory_Qty: 0,
      Variant_Price: row['Retail Price GBP'].trim().replace('£', ''),
      Variant_Compare_At_Price: '',
      Variant_Requires_Shipping: 'TRUE',
      Variant_Taxable: 'TRUE',
      Image_Src: `https://moto101.r2.cnnct.co.uk/${row['Material'].replace(/-/g, '_')}_1.png`,
      Image_Alt_Text: `${title} ${sizeFullName} Image`,
      Status: 'active'
    };
  } else {
    return {
      Handle: row['Material'] + '-' + row['Colorway'],
      Title: '',
      Body: '',
      Vendor: '',
      Type: '',
      Tags: '',
      Published: '',
      Option1_Name: '',
      Option1_Value: sizeFullName,
      Variant_SKU: row['SKU code'],
      Variant_Inventory_Qty: 0,
      Variant_Price: row['Retail Price GBP'].trim().replace('£', ''),
      Variant_Compare_At_Price: '',
      Variant_Requires_Shipping: 'TRUE',
      Variant_Taxable: 'TRUE',
      Image_Src: '',
      Image_Alt_Text: '',
      Status: ''
    };
  }
}

const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];
const secondFilePath = process.argv[4];

if (!inputFilePath || !outputFilePath || !secondFilePath) {
  console.error('Please provide the input, output, and second file paths');
  process.exit(1);
}

processXlsxFile(inputFilePath, outputFilePath, secondFilePath);