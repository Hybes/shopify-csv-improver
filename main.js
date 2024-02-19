const csv = require("csv-parser");
const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI(process.env.OPENAI_API_KEY);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let delayTime = 250;
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

async function generateOrImproveText(prompt, maxTokens = 2500) {
    try {
        // console.log(`Generating or improving text for prompt: ${prompt}`);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: 'system',
            content: 'You are a Shopify store owner and you need help with your product descriptions and SEO.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });
        delayTime = 250;
        // console.log("API call successful, processing response");
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
  if (row.Handle) {
    row.Handle = row.Handle.toLowerCase().replace(/[^a-z0-9]/g, "-");
  }

  if (!row["Body (HTML)"] && row.Title) {
    row["Body (HTML)"] = await generateOrImproveText(
      `Write a detailed description, optimised for SEO and using HTML specifically for a Shopify product for the product titled "${row.Title}", the content should start with a h1 title and you should only return the HTML code without the wrapping backticks and language identifier, and nothing else.`
    );
  }

  if (!row["SEO Title"] && row.Title) {
    row["SEO Title"] = await generateOrImproveText(
      `Generate an SEO-friendly title for a product titled "${row.Title}" to be used in shopift as my SEO title. Please only return the title as plain text and nothing else.`
    );
  } else {
    row["SEO Title"] = await generateOrImproveText(
      `Improve this SEO title: "${row["SEO Title"]}" and only return the improved title as plain text and nothing else.`
    );
  }

  if (!row["SEO Description"] && row.Title) {
    row["SEO Description"] = await generateOrImproveText(
      `Write a detailed description, optimised for SEO specifically for a Shopify product for the product titled "${row.Title}", you should only return the plain text description and nothing else.`
    );
  } else {
    row["SEO Description"] = await generateOrImproveText(
      `Improve this SEO description for a shopify product that already has the description: "${row["SEO Description"]}", please only return the new SEO description as plain text and nothing else.`
    );
  }

    if (!row["Image Alt Text"] && row.Title) {
    row["Image Alt Text"] = await generateOrImproveText(
      `Write an alt text for the product image of the product titled "${row.Title}", you should only return the alt text as plain text and nothing else.`
    );
    } else {
        row["Image Alt Text"] = await generateOrImproveText(
            `Improve this alt text for the product image: "${row["Image Alt Text"]}", please only return the improved alt text as plain text and nothing else.`
        );
    }

  if (
    row.Title &&
    row["Body (HTML)"] &&
    row["SEO Title"] &&
    row["SEO Description"]
  ) {
    const tagsPrompt = `Given the product title "${row.Title}", description "${row["Body (HTML)"]}", SEO title "${row["SEO Title"]}", and SEO description "${row["SEO Description"]}", generate at least 10 related tags to be used for shopify filtering, please only return the tags, comma seperated.`;
    row.Tags = await generateOrImproveText(tagsPrompt);
  }

  if (row.Title && row['Body (HTML)']) {
    const categoryPrompt = `Based on the product title "${row.Title}" and description "${row['Body (HTML)']}", choose the most appropriate category: Kit, Goggles, Helmets, Boots, Protection, Parts, Workshop & Tools, Stark Varg, Casual, Clearance. Please only return the category name and nothing else.`;
    row['Product Category'] = await generateOrImproveText(categoryPrompt);
  }

  if (row.Title && row['Body (HTML)']) {
    const typePrompt = `Given the product title "${row.Title}" and its description "${row['Body (HTML)']}", list all potential item collections and product types it could belong to. For example: gloves, goggles, helmets, boots, protection, parts, workshop & tools, stark varg, casual, clearance. Please only return the item collections and product types, comma separated, and with the first letter of each word capitalized, and NOTHING else.`;
    row['Type'] = await generateOrImproveText(typePrompt);
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

    // Clean 'Variant Price' column
  if (row['Variant Price']) {
    const cleanedPrice = row['Variant Price'].replace(/[^0-9.]/g, '');
    row['Variant Price'] = parseFloat(cleanedPrice);
  }

    await delay(250);

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
          await delay(250); // Ensure there's a delay between processing rows
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
