const XLSX = require('xlsx');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;

async function processXlsxFile(inputFilePath, outputFilePath) {
  const workbook = XLSX.readFile(inputFilePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet);

  // Group data by base SKU
  const groupedData = data.reduce((acc, row) => {
    const baseSKU = row['Product Code'];
    const colorway = row['Basic Colour']; // Extract colorway
    const masterKey = `${baseSKU}-${colorway}`; // Combine baseSKU and colorway for unique grouping
    if (!acc[masterKey]) {
      acc[masterKey] = [];
    }
    acc[masterKey].push(row);
    return acc;
  }, {});

  // Process each group to handle variants
  const csvData = [];
  Object.values(groupedData).forEach(group => {
    // Ensure the primary item of each cluster is at the start
    const primaryItem = group[0];
    const size = primaryItem['Size'];
    csvData.push(...createCsvRow(primaryItem, size, true));

    group.forEach((row, index) => {
      if (index !== 0) {
        const size = row['Size'];
        csvData.push(createCsvRow(row, size, false));
      }
    });

    // Add additional image rows for the primary item
    const imageExtensions = ['-1.jpeg', '-1.jpg', '-2.png', '-2.jpeg', '-2.jpg', '-3.png', '-3.jpeg', '-3.jpg', '-4.png', '-4.jpeg', '-4.jpg', '-5.png', '-5.jpeg', '-5.jpg', '-6.png', '-6.jpeg', '-6.jpg', '-7.png', '-7.jpeg', '-7.jpg', '-8.png', '-8.jpeg', '-8.jpg', '-9.png', '-9.jpeg', '-9.jpg'];
    imageExtensions.forEach((ext, extIndex) => {
      const imageNumber = Math.floor(extIndex / 3) + 2;
      csvData.push({
        Handle: primaryItem['Product Code'] + '-' + primaryItem['Basic Colour'],
        Title: '',
        Body: '',
        Vendor: '',
        Product_Category: '',
        Tags: '',
        Published: 'TRUE',
        Option1_Name: '',
        Option1_Value: '',
        Variant_SKU: '',
        Variant_Inventory_Qty: '',
        Variant_Price: '',
        Variant_Compare_At_Price: '',
        Variant_Requires_Shipping: '',
        Variant_Taxable: '',
        Image_Position: imageNumber,
        Image_Src: `https://store.brth.uk/moto101/${primaryItem['Image Name']}${ext}`,
        Image_Alt_Text: `${primaryItem['Description (80 Chars)']} Image ${imageNumber}`,
        Status: 'draft'
      });
    });
  });

  const csvWriterInstance = csvWriter({
    path: outputFilePath,
    header: [
      {id: 'Handle', title: 'Handle'},
      {id: 'Title', title: 'Title'},
      {id: 'Body', title: 'Body (HTML)'},
      {id: 'Vendor', title: 'Vendor'},
      {id: 'Product_Category', title: 'Product Category'},
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
      {id: 'Image_Position', title: 'Image Position'},
      {id: 'Image_Alt_Text', title: 'Image Alt Text'},
      {id: 'Status', title: 'Status'}
    ]
  });

  await csvWriterInstance.writeRecords(csvData)
    .then(() => console.log('The CSV file was written successfully'));
}

function createCsvRow(row, sizeCode, isDefaultVariant) {
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
  const title = row['Description (80 Chars)'];
  const body = row['Long Web Text'];

  const imageBaseSrc = `https://store.brth.uk/moto101/${row['Image Name']}`;
  const imageExtensions = ['.jpeg', '.jpg', '.png'];

  if (isDefaultVariant) {
    return imageExtensions.map(ext => ({
      Handle: row['Product Code'] + '-' + row['Basic Colour'],
      Title: title,
      Body: body,
      Vendor: row['Brand'],
      Product_Category: row['Category'],
      Tags: row['Keywords'],
      Published: 'TRUE',
      Option1_Name: 'Size',
      Option1_Value: sizeFullName,
      Variant_SKU: row['Product Code'],
      Variant_Inventory_Qty: row['Stock Level'],
      Variant_Price: row['RRP'],
      Variant_Compare_At_Price: row['RRP'],
      Variant_Requires_Shipping: 'TRUE',
      Variant_Taxable: 'TRUE',
      Image_Src: imageBaseSrc + ext,
      Image_Position: 1,
      Image_Alt_Text: `${title} ${sizeFullName} Image`,
      Status: 'draft'
    })).flat();
  } else {
    return {
      Handle: row['Product Code'] + '-' + row['Basic Colour'],
      Title: '',
      Body: '',
      Vendor: '',
      Product_Category: '',
      Tags: '',
      Published: '',
      Option1_Name: '',
      Option1_Value: sizeFullName,
      Variant_SKU: row['Product Code'],
      Variant_Inventory_Qty: row['Stock Level'],
      Variant_Price: row['Your Price'],
      Variant_Compare_At_Price: row['RRP'],
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

if (!inputFilePath || !outputFilePath) {
  console.error('Please provide the input and output file paths');
  process.exit(1);
}

processXlsxFile(inputFilePath, outputFilePath);
