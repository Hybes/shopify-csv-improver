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
  group.forEach((row, index) => {
    const size = row['SKU code'].match(/-(\w+)$/)?.[1];
    const baseSKU = row['SKU code'].match(/(.+)-[A-Z0-9]+$/i)[1];
    const masterKey = `${baseSKU.split('-')[0]}`; // Use the baseSKU portion for lookup in secondDataMap
    const secondRow = secondDataMap[masterKey]; // Find matching row in secondDataMap
    // Add the primary row
    csvData.push(createCsvRow(row, size, index === 0, secondRow)); // This remains unchanged

    // If it's the first item in each color group, add 9 additional image rows
    if (index === 0) {
      const imageExtensions = ['_1.jpeg', '_1.jpg','_2.png', '_2.jpeg', '_2.jpg', '_3.png', '_3.jpeg', '_3.jpg', '_4.png', '_4.jpeg', '_4.jpg', '_5.png', '_5.jpeg', '_5.jpg', '_6.png', '_6.jpeg', '_6.jpg', '_7.png', '_7.jpeg', '_7.jpg', '_8.png', '_8.jpeg', '_8.jpg', '_9.png', '_9.jpeg', '_9.jpg', '_10.png', '_10.jpeg', '_10.jpg'];
      imageExtensions.forEach((ext, extIndex) => {
        const imageNumber = Math.floor(extIndex / 3) + 2;
        csvData.push({
          Handle: row['Material'] + '-' + row['Colorway'],
          Title: '',
          Body: '',
          Vendor: '',
          Type: '',
          Tags: '',
          Published: '',
          Option1_Name: '',
          Option1_Value: '',
          Variant_SKU: '',
          Variant_Inventory_Qty: '',
          Variant_Price: '',
          Variant_Compare_At_Price: '',
          Variant_Requires_Shipping: '',
          Variant_Taxable: '',
          Image_Position: imageNumber,
          Image_Src: `https://cdn.shopify.com/s/files/1/0281/4781/0339/files/${row['Material'].replace(/-/g, '_')}${ext}`,
          Image_Alt_Text: `${secondRow ? `${secondRow['Product Name']} ${row['Colorway']}` : row['Material Description']} Image ${Math.floor(extIndex / 3) + 2}`,
          Status: 'active'
        });
      });
    }
  });
});

  const csvWriterInstance = csvWriter({
    path: outputFilePath,
    header: [
      {id: 'Handle', title: 'Handle'},
      {id: 'Title', title: 'Title'},
      {id: 'Body', title: 'Body (HTML)'},
      { id: 'Vendor', title: 'Vendor' },
      {id: 'Product_Category', title: 'Product Category'},
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
      { id: 'Image_Src', title: 'Image Src' },
      { id: 'Image_Position', title: 'Image Position' },
      { id: 'Image_Alt_Text', title: 'Image Alt Text' },
      { id: 'Status', title: 'Status'}
    ]
  });

  await csvWriterInstance.writeRecords(csvData)
    .then(() => console.log('The CSV file was written successfully'));
}

// tags need to be blank
// published needs to be TRUE
// status needs to be active
// 'Product Type' needs to be based on Title of product, matching an array - Hoodie, Cap, Shorts, Socks, T-Shirt, etc.
// 'Product Category' needs to be based on tags, matching Navigation - array: Clothes = Apparel & Accessories > Clothing.

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

  const imageBaseSrc = `https://cdn.shopify.com/s/files/1/0281/4781/0339/files/${row['Material'].replace(/-/g, '_')}`;
  const imageExtensions = ['_1.png', '_1.jpeg', '_1.jpg'];

  if (isDefaultVariant) {
    return imageExtensions.map(ext => ({
      Handle: row['Material'] + '-' + row['Colorway'],
      Title: title,
      Body: body,
      Vendor: 'Fox',
      Product_Category: 'Apparel & Accessories > Clothing',
      Type: 'Casual',
      Tags: 'Casual wear',
      Published: 'TRUE',
      Option1_Name: 'Size',
      Option1_Value: sizeFullName,
      Variant_SKU: row['SKU code'],
      Variant_Inventory_Qty: 0,
      Variant_Price: row['Retail Price GBP'].trim().replace('£', ''),
      Variant_Compare_At_Price: '',
      Variant_Requires_Shipping: 'TRUE',
      Variant_Taxable: 'TRUE',
      Image_Src: imageBaseSrc + ext,
      Image_Position: 1,
      Image_Alt_Text: `${title} ${sizeFullName} Image`,
      Status: 'active'
    })).flat();
  } else {
    return {
      Handle: row['Material'] + '-' + row['Colorway'],
      Title: '',
      Body: '',
      Vendor: '',
      Product_Category: '',
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