const { parse } = require('url');
const { parseTarget, endWithCache, endWithError } = require('../util');
const chromium = require('../chromium');

const render = async (targetURL) => {
    const { browser, page, err } = await chromium.visit(targetURL)
    if (err) {
        return { err }
    }

    // serialize HTML of page DOM
    let html = await page.content();
    await browser.close();

    const { protocol, hostname } = parse(targetURL)

    html = html.replace('<head>', `<head><base href="${protocol}//${hostname}"/>`)
    return { html };
}

module.exports = async function (req, res) {
    const { target, err } = parseTarget(req)
    if (err) {
        return endWithError(res, err)
    }
    
    try {
        const { html, err } = await render(target);
        if (err) {
            return endWithError(res, err)
        }

        console.log("[INFO] render completed:", target);

        return endWithCache(res, 200, 'text/html', html);
    } catch (e) {
        console.log(`[ERROR] handler/render.js (${target}):`, e);
        return endWithError(res, {
            message: `screenshot failed for target '${target}'.`,
        })
    }
};
