const fs = require('fs');
const csv = require('csv-parser');

// Start Generation Here
function removeRowsBasedOnSKU(file1, file2) {
    const file1Data = [];
    const file2Data = [];
    const rowsToRemove = [];
    const outputFileName = `extract_${file2}`;

    // Read the first CSV file and store SKUs
    fs.createReadStream(file1)
        .pipe(csv())
        .on('data', (row) => {
            file1Data.push(row['SKU']);
        })
        .on('end', () => {
            // Read the second CSV file and filter rows
            const file2Stream = fs.createReadStream(file2);
            const tempFile2Data = [];
            file2Stream
                .pipe(csv())
                .on('data', (row) => {
                    tempFile2Data.push(row);
                    if (file1Data.includes(row['Variant SKU'])) {
                        rowsToRemove.push(row);
                    } else {
                        file2Data.push(row);
                    }
                })
                .on('end', () => {
                    // Write the filtered data back to the second file
                    const file2WriteStream = fs.createWriteStream(file2);
                    const headers = Object.keys(tempFile2Data[0]);
                    file2WriteStream.write(headers.join(',') + '\n');
                    file2Data.forEach(row => {
                        const rowValues = headers.map(header => row[header] || '');
                        file2WriteStream.write(rowValues.join(',') + '\n');
                    });
                    file2WriteStream.end();

                    // Write the removed rows to a new file
                    const outputStream = fs.createWriteStream(outputFileName);
                    outputStream.write(headers.join(',') + '\n');
                    rowsToRemove.forEach(row => {
                        const rowValues = headers.map(header => row[header] || '');
                        outputStream.write(rowValues.join(',') + '\n');
                    });
                    outputStream.end();
                });
        });
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error('Please provide exactly two file names as arguments.');
    process.exit(1);
}

// Example usage with command line arguments
removeRowsBasedOnSKU(args[0], args[1]);
