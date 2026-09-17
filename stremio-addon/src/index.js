'use strict'

const { serveHTTP, publishToCentral } = require('stremio-addon-sdk')
const { createAddon } = require('./addon')
const config = require('./config')
const { formatServiceUrls } = require('../../scripts/lan.cjs')

async function main() {
    const addonInterface = await createAddon()

    serveHTTP(addonInterface, { port: config.port })
    console.log(`[addon] Stremio on this computer: http://127.0.0.1:${config.port}/manifest.json`)
    for (const url of formatServiceUrls({ port: config.port, path: '/manifest.json' })) {
        if (url.includes('127.0.0.1')) continue
        console.log(`[addon] LAN manifest (needs HTTPS for Stremio clients): ${url}`)
    }

    // Only meaningful once the manifest is reachable on a public https URL.
    if (config.publishUrl) {
        try {
            await publishToCentral(config.publishUrl)
            console.log(`[addon] published ${config.publishUrl} to the Stremio addon collection`)
        } catch (err) {
            console.error(`[addon] publishing failed: ${err.message}`)
        }
    }
}

main().catch((err) => {
    console.error(`[addon] failed to start: ${err.message}`)
    process.exit(1)
})
