'use strict'

const { serveHTTP, publishToCentral } = require('stremio-addon-sdk')
const { createAddon } = require('./addon')
const config = require('./config')

async function main() {
    const addonInterface = await createAddon()

    serveHTTP(addonInterface, { port: config.port })
    console.log(`[addon] manifest on http://127.0.0.1:${config.port}/manifest.json`)

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
