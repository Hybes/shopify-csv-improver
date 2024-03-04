const csv = require("csv-parser");
const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI(process.env.OPENAI_API_KEY);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let delayTime = 5;
const maxDelay = 60000;

function formatCsvField(field) {
    if (field === null || field === undefined) {
      return '';
    }

    let formattedField = String(field);
    const needsDoubleQuotes = /[",\n]/.test(formattedField);
    formattedField = formattedField.replace(/"/g, '""');
    if (needsDoubleQuotes) {
      formattedField = `"${formattedField}"`;
    }

    return formattedField;
  }

async function exponentialBackoff() {
  await delay(delayTime);
  delayTime = Math.min(delayTime * 2, maxDelay);
}

async function generateOrImproveText(prompt, maxTokens = 1000) {
    try {
        // console.log(`Generating or improving text for prompt: ${prompt}`);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: 'system',
            content: 'You are an English Shopify store owner and you need help with your product descriptions and SEO. You are working with columns in a product list, and should only provide the value for the column and no surrounding text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.8,
      });
        delayTime = 5;
      return response.choices[0].message.content.trim();
    } catch (error) {
      if (error.code === "rate_limit_exceeded") {
        console.error("Error with OpenAI API: Rate limit exceeded. Applying exponential backoff.");
        await exponentialBackoff();
        return generateOrImproveText(prompt, maxTokens); // Retry the request
      } else {
        console.error("Error with OpenAI API:", error);
        return null;
      }
    }
  }

async function processCsvRow(row, rowIndex) {
  console.log(`Processing row ${rowIndex + 1}`);
  const firstKey = Object.keys(row)[0];
  row[firstKey] = row[firstKey].toLowerCase().replace(/[^a-z0-9]/g, "-");

  if (row.Type) {
    row.Type = await generateOrImproveText(`I am selling ${row.Title} and I need can only use one word as a type, the list I have so far is: "${row.Type}". Please select the most suitable type for my product based on this list and only return me the value for the column. YOU MUST USE THE GIVEN LIST OF TYPES AND CANNOT ADD ANY NEW TYPES. IT MUST BE ONE OF THE TYPES IN THE LIST.`);
    row.Type = row.Type.replace(/[^a-z0-9]/g, "-").replace(/^"|"$/g, '');;
  }

  if (row.Tags) {
    row.Tags = await generateOrImproveText(`I am selling ${row.Title} and I need to add some tags to my product, the list I have so far is: ${row.Tags}. Please return me only the items in this list, that are related to Motocross, and do not include tags related to ATV, Snowboarding, Skiing, etc. IT MUST BE Motocross related. You must only return me the list, and it must be comma separated.`);
  }

  if (row["Body (HTML)"]) {
    row["Body (HTML)"] = row["Body (HTML)"].replace(/[^\x00-\x7F]/g, '');
  }

  if (row["SEO Title"] && row["SEO Description"]) {
    row["SEO Title"] = row["SEO Title"].replace(/[^\x00-\x7F]/g, '').replace(/^"|"$/g, '');
    row["SEO Description"] = row["SEO Description"].replace(/[^\x00-\x7F]/g, '').replace(/^"|"$/g, '');
  }

  const capitalizeFirstLetter = (string) => {
      return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const columnsToCapitalize = ['Title', 'Vendor', 'Product Category', 'Type', 'Tags'];
  columnsToCapitalize.forEach(column => {
    if (row[column] && typeof row[column] === 'string') {
      if (column === 'Tags' || column === 'Type') {
        row[column] = row[column].split(',').map(tag => capitalizeFirstLetter(tag.trim())).join(', ');
      } else {
        row[column] = capitalizeFirstLetter(row[column]);
      }
    }
  });

    await delay(5);

  return row;
}

async function readAndProcessCsv(filePath) {
  console.log(`Starting to process CSV file: ${filePath}`);
  const processedRows = [];
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on("error", (error) => {
        console.error("Error reading CSV file:", error);
        reject(error);
      });

    let rowIndex = 0;
    (async () => {
      try {
        for await (const row of stream) {
          const processedRow = await processCsvRow(row, rowIndex++);
          processedRows.push(processedRow);
          await delay(5); // Ensure there's a delay between processing rows
        }
        console.log("CSV file successfully processed");
        resolve(processedRows); // Resolve after all rows have been processed
      } catch (error) {
        reject(error); // Properly handle and reject on error
      }
    })();
  });
}

async function main() {
  const filePath = process.argv[2];
  const processedProducts = await readAndProcessCsv(filePath);
  console.log(`Processed ${processedProducts.length} products.`);
  const newFilePath = filePath.replace(".csv", `-processed-${Math.floor(Date.now() / 1000)}.csv`);
  const csvWriter = fs.createWriteStream(newFilePath, { flags: "w" });
  if (processedProducts.length > 0) {
    const headers = Object.keys(processedProducts[0]).map(formatCsvField).join(",");
    csvWriter.write(headers + "\n");
    processedProducts.forEach((product) => {
      const row = Object.values(product).map(formatCsvField).join(",");
      csvWriter.write(row + "\n");
    });
  csvWriter.on('finish', () => {
    console.log(`Processed products written to ${newFilePath}`);
  });

  csvWriter.end();
  } else {
    console.log("No products to process.");
  }
}

main();
