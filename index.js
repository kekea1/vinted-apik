const fetch = require('node-fetch');
const UserAgent = require('user-agents');
const cookie = require('cookie');

/**
 * Fetches a new public cookie from Vinted.fr
 */
const fetchCookie = (domain = 'fr') => {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        fetch(`https://vinted.${domain}`, {
            signal: controller.signal
        }).then((res) => {
            const sessionCookie = res.headers.get('set-cookie');
            controller.abort();
            resolve(cookie.parse(sessionCookie)['secure, _vinted_fr_session']);
        }).catch(() => {
            controller.abort();
            reject();
        });
    });
}

/**
 * Parse a vinted URL to get the querystring usable in the search endpoint
 */
const parseVintedURL = (url, disableOrder, allowSwap, customParams = {}) => {
    const decodedURL = decodeURI(url);
    const matchedParams = decodedURL.match(/^https:\/\/www\.vinted\.([a-z]+)/);
    if (!matchedParams) return {
        validURL: false
    };

    const missingIDsParams = ['catalog', 'status'];
    const params = decodedURL.match(/(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/g);
    const mappedParams = new Map();
    for (let param of params) {
        let [ _, paramName, isArray, paramValue ] = param.match(/(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/);
        if (paramValue?.includes(' ')) paramValue = paramValue.replace(/ /g, '+');
        if (isArray) {
            if (missingIDsParams.includes(paramName)) paramName = `${paramName}_id`;
            if (mappedParams.has(`${paramName}s`)) {
                mappedParams.set(`${paramName}s`, [ ...mappedParams.get(`${paramName}s`), paramValue ]);
            } else {
                mappedParams.set(`${paramName}s`, [paramValue]);
            }
        } else {
            mappedParams.set(paramName, paramValue);
        }
    }
    for (let key of Object.keys(customParams)) {
        mappedParams.set(key, customParams[key]);
    }
    const finalParams = [];
    for (let [ key, value ] of mappedParams.entries()) {
        finalParams.push(typeof value === 'string' ? `${key}=${value}` : `${key}=${value.join(',')}`);
    }

    return {
        validURL: true,
        domain: matchedParams[1],
        querystring: finalParams.join('&')
    }
}

const cookies = new Map();

/**
 * Searches something on Vinted
 */
const search = (url, disableOrder = false, allowSwap = false, customParams = {}) => {
    return new Promise(async (resolve, reject) => {

        const { domain, querystring } = parseVintedURL(url, disableOrder ?? false, allowSwap ?? false, customParams);

        const cachedCookie = cookies.get(domain);
        const cookie = cachedCookie && cachedCookie.createdAt > Date.now() - 60_000 ? cachedCookie.cookie : await fetchCookie(domain).catch(() => {});
        if (!cookie) {
            return reject('Could not fetch cookie');
        }
        if (cachedCookie.cookie !== cookie) {
            cookies.set(domain, {
                cookie,
                createdAt: Date.now()
            });
        }

        const controller = new AbortController();
        fetch(`https://www.vinted.${domain}/api/v2/items?${querystring}`, {
            signal: controller.signal,
            headers: {
                cookie: '_vinted_fr_session=' + cookie,
                'user-agent': new UserAgent().toString(),
                accept: 'application/json, text/plain, */*'
            }
        }).then((res) => {
            res.text().then((text) => {
                controller.abort();
                try {
                    resolve(JSON.parse(text));
                } catch (e) {
                    reject(text);
                }
            });
        }).catch(() => {
            controller.abort();
            reject('Can not fetch search API');
        });
    
    });
}

module.exports = {
    fetchCookie,
    parseVintedURL,
    search
}
