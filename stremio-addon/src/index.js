'use strict'

const http = require('http')
const { getRouter, publishToCentral } = require('stremio-addon-sdk')
const { createAddon } = require('./addon')
const config = require('./config')
const { formatServiceUrls } = require('../../scripts/lan.cjs')

// serveHTTP() always binds every interface, so serve the addon router ourselves
// to listen on config.host.
function listen(addonInterface) {
    const router = getRouter(addonInterface)
    const server = http.createServer((req, res) => {
        router(req, res, () => {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ err: 'not found' }))
        })
    })
    return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(config.port, config.host, () => resolve(server))
    })
}

async function main() {
    const addonInterface = await createAddon()

    await listen(addonInterface)
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
