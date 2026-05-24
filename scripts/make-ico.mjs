import fs from 'fs'
import sharp from 'sharp'

async function makeIco(inputPng, outputPath) {
    const sizes = [16, 32, 48, 64, 128, 256]
    const pngBuffers = []

    for (const size of sizes) {
        const buf = await sharp(inputPng)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()
        pngBuffers.push({ size, buf })
    }

    // ICO header: 6 bytes
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // Reserved
    header.writeUInt16LE(1, 2) // Type (1 = ICO)
    header.writeUInt16LE(sizes.length, 4) // Number of images

    const directoryEntries = []
    let currentOffset = 6 + sizes.length * 16

    for (const { size, buf } of pngBuffers) {
        const entry = Buffer.alloc(16)
        entry.writeUInt8(size === 256 ? 0 : size, 0) // Width
        entry.writeUInt8(size === 256 ? 0 : size, 1) // Height
        entry.writeUInt8(0, 2) // Color palette (0 = no palette)
        entry.writeUInt8(0, 3) // Reserved
        entry.writeUInt16LE(1, 4) // Color planes
        entry.writeUInt16LE(32, 6) // Bits per pixel
        entry.writeUInt32LE(buf.length, 8) // Image size
        entry.writeUInt32LE(currentOffset, 12) // Image offset

        directoryEntries.push(entry)
        currentOffset += buf.length
    }

    const buffers = [header, ...directoryEntries, ...pngBuffers.map((p) => p.buf)]
    const icoBuffer = Buffer.concat(buffers)
    fs.writeFileSync(outputPath, icoBuffer)
    console.log(`Successfully created ICO file at ${outputPath}`)
}

const [, , input, output] = process.argv
if (!input || !output) {
    console.error('Usage: node make-ico.mjs <input.png> <output.ico>')
    process.exit(1)
}

makeIco(input, output).catch((err) => {
    console.error(err)
    process.exit(1)
})
