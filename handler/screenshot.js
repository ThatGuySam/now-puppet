const { parse } = require('url');
const { parseTarget, endWithCache, endWithError, getInt } = require('../lib/util')('screenshot');
const chromium = require('../lib/chromium');

const getScreenshot = async (targetURL, type, quality, fullPage, selector = null) => {
    const { browser, page, err } = await chromium.visit(targetURL)
    if (err) {
        return { err }
    }

    if (fullPage === undefined) {
        fullPage = true
    }

    let clip
    if (selector) { 
        await page.waitForSelector(selector, { visible: true })
        const rect = await page.evaluate(selector => {
            const element = document.querySelector(selector);
            if (!element)
            return null;
            const {x, y, width, height} = element.getBoundingClientRect();
            return {left: x, top: y, width, height, id: element.id};
        }, selector);


        clip = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        }
    }

    let screenshotOptions = {
        type, 
        quality
    }

    if (clip) {
        screenshotOptions.clip = clip
    } else {
        screenshotOptions.fullPage = fullPage
    }

    const file = await page.screenshot(screenshotOptions);
    await browser.close();
    return { file };
}

module.exports = async function (req, res) {
    let { target, puppetQuery = {}, err: targetErr} = parseTarget(req)
    if (targetErr) {
        return endWithError(res, targetErr)
    }

    try {
        let { type = 'png', quality, fullPage, selector = null } = puppetQuery;

        quality = getInt(quality)
        if (quality) {
            if (quality < 0 || 100 < quality) {
                return endWithError(res, {
                    code: 400,
                    type: '400 bad request',
                    message: `quality must be between 0 and 100 (inclusive). got ${quality} instead.`,
                })
            }

            // image type must be jpeg when quality is specified
            type = 'jpeg'
        }

        const { file, err: handlerErr } = await getScreenshot(target, type, quality, fullPage, selector);
        if (handlerErr) {
            return endWithError(res, handlerErr)
        }

        return endWithCache(res, 200, `image/${type}`, file)
    } catch (e) {
        return endWithError(res, {
            message: `screenshot failed for target '${target}'.`,
            errorObject: e,
        })
    }
};
