const XLSX = require('xlsx');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;

async function processXlsxFile(inputFilePath, outputFilePath) {
  const workbook = XLSX.readFile(inputFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  // Group data by Commodity Code
  const groupedData = data.reduce((acc, row) => {
    const commodityCode = row['Commodity Code'];
    if (!acc[commodityCode]) {
      acc[commodityCode] = [];
    }
    acc[commodityCode].push(row);
    return acc;
  }, {});

  // Process each group to handle variants
  const csvData = [];
  Object.values(groupedData).forEach(group => {
    const primaryItem = group[0];
    const handle = primaryItem['Product Code'].toLowerCase();
    const title = primaryItem['Description (80 Chars)'];
    const body = primaryItem['Long Web Text'];
    const vendor = primaryItem['Brand'];

    group.forEach((row, index) => {
      const size = row['Size'];
      const color = row['Basic Colour'];
      const variantSKU = row['Product Code'];
      const variantPrice = row['RRP'];
      const imageBaseSrc = `https://store.brth.uk/moto101/${row['Image Name']}`;
      const imageExtensions = ['.jpeg', '.jpg', '.png'];

      // Add the primary row
      csvData.push({
        Handle: handle,
        Title: title,
        Body: body,
        Vendor: vendor,
        'Product Category': '',
        Type: '',
        Tags: '',
        Published: 'TRUE',
        'Option1 Name': 'Size',
        'Option1 Value': size,
        'Option2 Name': 'Color',
        'Option2 Value': color,
        'Option3 Name': '',
        'Option3 Value': '',
        'Variant SKU': variantSKU,
        'Variant Grams': '',
        'Variant Inventory Tracker': '',
        'Variant Inventory Qty': '',
        'Variant Inventory Policy': '',
        'Variant Fulfillment Service': '',
        'Variant Price': variantPrice,
        'Variant Compare At Price': '',
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Barcode': row['Barcode'],
        'Image Src': imageBaseSrc + imageExtensions[0],
        'Image Position': 1,
        'Image Alt Text': `${title} ${size} Image`,
        'Gift Card': '',
        'SEO Title': '',
        'SEO Description': '',
        'Google Shopping / Google Product Category': '',
        'Google Shopping / Gender': '',
        'Google Shopping / Age Group': '',
        'Google Shopping / MPN': '',
        'Google Shopping / AdWords Grouping': '',
        'Google Shopping / AdWords Labels': '',
        'Google Shopping / Condition': '',
        'Google Shopping / Custom Product': '',
        'Google Shopping / Custom Label 0': '',
        'Google Shopping / Custom Label 1': '',
        'Google Shopping / Custom Label 2': '',
        'Google Shopping / Custom Label 3': '',
        'Google Shopping / Custom Label 4': '',
        'Variant Image': '',
        'Variant Weight Unit': '',
        'Variant Tax Code': '',
        'Cost per item': '',
        'Price / International': '',
        'Compare At Price / International': '',
        Status: 'active'
      });

      // Add additional image rows
      imageExtensions.forEach((ext, extIndex) => {
        const imageNumber = Math.floor(extIndex / 3) + 2;
        csvData.push({
          Handle: handle,
          Title: '',
          Body: '',
          Vendor: '',
          'Product Category': '',
          Type: '',
          Tags: '',
          Published: '',
          'Option1 Name': '',
          'Option1 Value': '',
          'Option2 Name': '',
          'Option2 Value': '',
          'Option3 Name': '',
          'Option3 Value': '',
          'Variant SKU': '',
          'Variant Grams': '',
          'Variant Inventory Tracker': '',
          'Variant Inventory Qty': '',
          'Variant Inventory Policy': '',
          'Variant Fulfillment Service': '',
          'Variant Price': '',
          'Variant Compare At Price': '',
          'Variant Requires Shipping': '',
          'Variant Taxable': '',
          'Variant Barcode': '',
          'Image Src': imageBaseSrc + ext,
          'Image Position': imageNumber,
          'Image Alt Text': `${title} ${size} Image ${imageNumber}`,
          'Gift Card': '',
          'SEO Title': '',
          'SEO Description': '',
          'Google Shopping / Google Product Category': '',
          'Google Shopping / Gender': '',
          'Google Shopping / Age Group': '',
          'Google Shopping / MPN': '',
          'Google Shopping / AdWords Grouping': '',
          'Google Shopping / AdWords Labels': '',
          'Google Shopping / Condition': '',
          'Google Shopping / Custom Product': '',
          'Google Shopping / Custom Label 0': '',
          'Google Shopping / Custom Label 1': '',
          'Google Shopping / Custom Label 2': '',
          'Google Shopping / Custom Label 3': '',
          'Google Shopping / Custom Label 4': '',
          'Variant Image': '',
          'Variant Weight Unit': '',
          'Variant Tax Code': '',
          'Cost per item': '',
          'Price / International': '',
          'Compare At Price / International': '',
          Status: ''
        });
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
      {id: 'Product Category', title: 'Product Category'},
      {id: 'Type', title: 'Type'},
      {id: 'Tags', title: 'Tags'},
      {id: 'Published', title: 'Published'},
      {id: 'Option1 Name', title: 'Option1 Name'},
      {id: 'Option1 Value', title: 'Option1 Value'},
      {id: 'Option2 Name', title: 'Option2 Name'},
      {id: 'Option2 Value', title: 'Option2 Value'},
      {id: 'Option3 Name', title: 'Option3 Name'},
      {id: 'Option3 Value', title: 'Option3 Value'},
      {id: 'Variant SKU', title: 'Variant SKU'},
      {id: 'Variant Grams', title: 'Variant Grams'},
      {id: 'Variant Inventory Tracker', title: 'Variant Inventory Tracker'},
      {id: 'Variant Inventory Qty', title: 'Variant Inventory Qty'},
      {id: 'Variant Inventory Policy', title: 'Variant Inventory Policy'},
      {id: 'Variant Fulfillment Service', title: 'Variant Fulfillment Service'},
      {id: 'Variant Price', title: 'Variant Price'},
      {id: 'Variant Compare At Price', title: 'Variant Compare At Price'},
      {id: 'Variant Requires Shipping', title: 'Variant Requires Shipping'},
      {id: 'Variant Taxable', title: 'Variant Taxable'},
      {id: 'Variant Barcode', title: 'Variant Barcode'},
      {id: 'Image Src', title: 'Image Src'},
      {id: 'Image Position', title: 'Image Position'},
      {id: 'Image Alt Text', title: 'Image Alt Text'},
      {id: 'Gift Card', title: 'Gift Card'},
      {id: 'SEO Title', title: 'SEO Title'},
      {id: 'SEO Description', title: 'SEO Description'},
      {id: 'Google Shopping / Google Product Category', title: 'Google Shopping / Google Product Category'},
      {id: 'Google Shopping / Gender', title: 'Google Shopping / Gender'},
      {id: 'Google Shopping / Age Group', title: 'Google Shopping / Age Group'},
      {id: 'Google Shopping / MPN', title: 'Google Shopping / MPN'},
      {id: 'Google Shopping / AdWords Grouping', title: 'Google Shopping / AdWords Grouping'},
      {id: 'Google Shopping / AdWords Labels', title: 'Google Shopping / AdWords Labels'},
      {id: 'Google Shopping / Condition', title: 'Google Shopping / Condition'},
      {id: 'Google Shopping / Custom Product', title: 'Google Shopping / Custom Product'},
      {id: 'Google Shopping / Custom Label 0', title: 'Google Shopping / Custom Label 0'},
      {id: 'Google Shopping / Custom Label 1', title: 'Google Shopping / Custom Label 1'},
      {id: 'Google Shopping / Custom Label 2', title: 'Google Shopping / Custom Label 2'},
      {id: 'Google Shopping / Custom Label 3', title: 'Google Shopping / Custom Label 3'},
      {id: 'Google Shopping / Custom Label 4', title: 'Google Shopping / Custom Label 4'},
      {id: 'Variant Image', title: 'Variant Image'},
      {id: 'Variant Weight Unit', title: 'Variant Weight Unit'},
      {id: 'Variant Tax Code', title: 'Variant Tax Code'},
      {id: 'Cost per item', title: 'Cost per item'},
      {id: 'Price / International', title: 'Price / International'},
      {id: 'Compare At Price / International', title: 'Compare At Price / International'},
      {id: 'Status', title: 'Status'}
    ]
  });

  await csvWriterInstance.writeRecords(csvData)
    .then(() => console.log('The CSV file was written successfully'));
}

const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];

if (!inputFilePath || !outputFilePath) {
  console.error('Please provide the input and output file paths');
  process.exit(1);
}

processXlsxFile(inputFilePath, outputFilePath);
