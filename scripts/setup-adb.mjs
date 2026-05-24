import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const binDir = path.join(projectRoot, 'bin')
const adbPath = path.join(binDir, 'adb.exe')

async function main() {
    // If adb.exe already exists, we are good
    if (fs.existsSync(adbPath)) {
        console.log('ADB is already prebundled.')
        return
    }

    console.log('Downloading ADB (Android Platform Tools) for Windows...')
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true })
    }

    const zipPath = path.join(projectRoot, 'platform-tools.zip')
    const tempExtractDir = path.join(projectRoot, 'platform-tools-temp')

    try {
        await downloadFile(
            'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
            zipPath,
        )
        console.log('Extracting ADB files...')

        // Ensure clean temp dir
        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true })
        }

        // Use PowerShell to extract
        execSync(
            `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`,
            { stdio: 'inherit' },
        )

        // Move needed files
        const extractedDir = path.join(tempExtractDir, 'platform-tools')
        const filesToCopy = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll']
        for (const file of filesToCopy) {
            const src = path.join(extractedDir, file)
            const dest = path.join(binDir, file)
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest)
                console.log(`Copied ${file} to bin/`)
            }
        }
        console.log('ADB prebundled successfully!')
    } catch (err) {
        console.error('Error prebundling ADB:', err)
        process.exit(1)
    } finally {
        // Cleanup
        if (fs.existsSync(zipPath)) {
            try {
                fs.unlinkSync(zipPath)
            } catch {}
        }
        if (fs.existsSync(tempExtractDir)) {
            try {
                fs.rmSync(tempExtractDir, { recursive: true, force: true })
            } catch {}
        }
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest)
        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: Status Code ${response.statusCode}`))
                    return
                }
                response.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve(null)
                })
            })
            .on('error', (err) => {
                fs.unlink(dest, () => {})
                reject(err)
            })
    })
}

void main()
