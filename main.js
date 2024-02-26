const csv = require("csv-parser");
const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI(process.env.OPENAI_API_KEY);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let delayTime = 50;
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

async function generateOrImproveText(prompt, maxTokens = 4000) {
    try {
        // console.log(`Generating or improving text for prompt: ${prompt}`);
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
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
        temperature: 0.9,
      });
        delayTime = 50;
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
      `Generate an SEO-friendly title for a product titled "${row.Title}" to be used in shopify as my SEO title. Please only return the title as plain text and nothing else.`
    );
  } else {
    row["SEO Title"] = await generateOrImproveText(
      `Improve this SEO title: "${row["SEO Title"]}" and only return the improved title as plain text and nothing else.`
    );
  }

  if (!row["SEO Description"] && row.Title) {
    row["SEO Description"] = await generateOrImproveText(
      `Using your knowledge of UK Motocross, write a detailed description, optimised for SEO specifically for a Shopify product for the product titled "${row.Title}", you should only return the plain text description and nothing else. The response should be more than 60 characters, but less than 140.`
    );
  } else {
    row["SEO Description"] = await generateOrImproveText(
      `Using your knowledge of UK Motocross, Improve this SEO description for a shopify product that already has the description: "${row["SEO Description"]}", please only return the new SEO description as plain text and nothing else. The response should be more than 60 characters, but less than 140.`
    ).replace(/[\n\r]/g, " ").replace(/^"|"$/g, '');
  }

    if (!row["Image Alt Text"] && row.Title) {
    row["Image Alt Text"] = await generateOrImproveText(
      `Write an alt text for the product image of the product titled "${row.Title}", you should only return the alt text as plain text and nothing else.`
    );
    }

  if (
    row.Title &&
    row["Body (HTML)"] &&
    row["SEO Title"] &&
    row["SEO Description"]
  ) {
    const tagsPrompt = `Given the product title "${row.Title}", SEO title "${row["SEO Title"]}", and SEO description "${row["SEO Description"]}", generate at least 10 related tags to be used for shopify filtering, please only return the tags, comma seperated.`;
    row.Tags = await generateOrImproveText(tagsPrompt);
  }

  if (row.Title && row['Body (HTML)']) {
    const categoryPrompt = `Based on the product title and description, choose the most appropriate category, You MUST use one of the categories in my lists and CAN NOT use something that is not in the following list: Kit Combos, Jerseys, Pants, Gloves, Socks, Knee Brace Socks, Body Warmers, Waterproof Gear, Youth Kit, Kit Bags, Boot Bags, Air Break, Frontline, O frame 2.0, O frame, L frame, Vue, Airspace, Main, Youth, Powerbomb, Powercore, Lenses, Tear Offs, Roll Off Systems, Roll Off Film, Face Foam, Goggle Bags, Moto-10 Spherical, Moto-9S Flex, MX-9 MIPS, V1, V3, V3 RS, Peaks, Instinct, Motion, Comp, Body Protection, Knee Braces, Knee & Elbow Guards, Brake Pads, Brake Rotors, Brake Lines, Brake Parts & Accessories, Plastics, Hand Guards, Seat Covers, Seat Foams, Air Filters, Oil Filters, Fuel Filters, Airbox Accessories, 2-Stroke Exhausts, 4-Stroke Exhausts, Exhaust Accessories, Chains, Sprockets, Chain Guides, Sliders & Rollers, Chain Master Links, Axle Blocks, Sprocket Accessories, Grips, Throttle Tubes, Handlebars, Barpads, Bar Mounts, Brake & Clutch Levers, Foot Pegs, Kick Stands, Brake Pedals, Gear Levers, Cables & Wires, Control Accessories, Pistons, Gaskets, Clutch Parts, Radiators, Engine Covers, Oil Filter Covers, Engine Bearings, Rebuild Kits, Engine Accessories, Bolt Kits, Bling Kits, Engine Drain Bolts, Seals & Bushings, Suspension Bearings, Springs, Triple Clamps, Holeshot Device, Fork Bleeders, Linkage Kits, Suspension Accessories, Tyres, Wheel Sets, Innertubes, Mousses, Rim Locks & Tapes, Hour Meters, Spark Plugs, Kill & MAP Switches, Other Electrics, Tyre Levers, Spoke Wrench, T-handles, Tool Box, Engine Oil, Gear Oil, 2-Stroke Oil, Radiator Coolant, Lubricants & Sprays, Cleaning Products, Airbox Covers, Cleaning Accessories, Bike Stands, Fuel Cans, Chairs, Ramps, Pit Boards, Pumps, Straps. If the prduct is related to Stark/Stark Varg, please place it in one of the following: "Bikes, Parts, Tools & workshop". Please only return the category name and nothing else. YOU MUST NOT STRAY OUTSIDE OF MY PROVIDED LIST. You should dynamically work out the category only based on this list. Here is the title "${row.Title}" and description "${row['Body (HTML)']}"`;
    row['Product Category'] = await generateOrImproveText(categoryPrompt);
    console.log(`Category for ${row.Title}: ${row['Product Category']}`);
  }

  if (row.Title && row['Body (HTML)']) {
    const typePrompt = `Given the product title "${row.Title}" and its description, list all potential item collections and product types it could belong to. You should dynamically fetch the type from the title, for example: 180 Atlas Jersey - Black/Green would be in the type/collection '180' and V1 Flora Helmet - Dark Indigo Blue would be 'V1' Please only return the item collections and product types, comma separated, and with the first letter of each word capitalized, and NOTHING else. Here is the description: "${row['Body (HTML)']}"`;
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

    await delay(50);

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
          await delay(50); // Ensure there's a delay between processing rows
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
