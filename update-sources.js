const fs = require("fs");

const $http = HTTP();
const Base64 = new Base64Code();

const GITHUB_ACCESS_TOKEN = Base64.decode('Z2hwX3R4OE5aYTdBNkFPOFppZE9Temc1VHFERFBTVU8xODJUNUVNYw==');

const PLUGIN_DATA_PATH = "./data/plugins.json";
const SOURCE_REPO_DATA_PATH = "./data/repos.json";
const SOURCE_PATH = "plugin-sources.json";

const sources = readJSON(SOURCE_PATH);
const allPlugins = {};
const allRepos = {};

; (async () => {
    const tasks = sources.map(async ({ user, repo, branch, paths }) => {
        const id = `${user}-${repo}-${branch}`;
        
        const repoInfo = {
            user, repo, branch,
            ...await fetchRepoInfo(user, repo),
        };
        allRepos[id] = repoInfo;

        const plugins = await fetchPlugins(user, repo, branch, paths);
        allPlugins[id] = plugins;
    });

    await Promise.all(tasks);

    writeJSON(allPlugins, PLUGIN_DATA_PATH);
    writeJSON(allRepos, SOURCE_REPO_DATA_PATH);
})();

function writeJSON(data, fpath) {
    fs.writeFileSync(
        fpath,
        JSON.stringify(data, null, 2),
        { encoding: "utf8", flag: "w" },
        (err) => console.log(err)
    );
}

function readJSON(fpath) {
    if (!fs.existsSync(fpath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(fpath, "utf8"));
}

/**
 * Fetch the information of a GitHub repository
 * @param {String} user Username
 * @param {String} repo Repository Name
 */
async function fetchRepoInfo(user, repo) {
    const BASE_URL = "https://api.github.com";
    try {
        const response = await $http.get({
            url: `${BASE_URL}/repos/${user}/${repo}`,
            headers: {
                Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36",
            }
        }).then(resp => JSON.parse(resp.body));
        const { description: repo_description, owner, html_url: repo_url, updated_at, stargazers_count, forks_count } = response;
        const { avatar_url: avatar_url, html_url: owner_url } = owner;
        return {
            avatar_url, owner_url,
            repo_description, repo_url, updated_at, stargazers_count, forks_count
        }
    } catch (err) {
        throw new Error(`Error fetching repository info for ${user}/${repo}`);
    }
}

/**
 * Fetch Loon plugins from a GitHub repository
 * @param {String} user Username
 * @param {String} repo Repository Name
 * @param {String} branch Branch
 */
async function fetchPlugins(user, repo, branch, paths = [""]) {
    const BASE_URL = "https://api.github.com";
    console.log(`Fetching plugins from GitHub repo: ${user}/${repo}/${branch}...`);

    const plugins = [];
    async function fetch(path) {
        // walk through the repository recursively
        try {
            // see https://docs.github.com/cn/rest/repos/contents#get-contents
            const data = await $http.get({
                url: `${BASE_URL}/repos/${user}/${repo}/contents/${encodeURIComponent(path)}`,
                headers: {
                    Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36",
                }
            }).then(resp => JSON.parse(resp.body));
            const next = [];
            data.forEach(async item => {
                if (item.type === "dir") {
                    next.push(fetch(item.path));
                }
                if (item.name.endsWith(".plugin")) {
                    fetchPluginMeta(item.download_url)
                        .then(plugin => plugins.push(plugin))
                        .catch(err => {
                            $.error(`Failed to fetch plugin: ${item.download_url}, reason: ${err}`);
                        });
                }
            });
            await Promise.all(next);
        } catch (err) {
            throw new Error(`Error fetching plugins from repository: ${user}/${repo}/${branch}, reason: ${err}`);
        }
    }
    
    await Promise.all(paths.map(async p => fetch(p)));

    return plugins;
}

/**
 * Fetch the metadata of a plugin
 * @param {String} pluginURL
 */
async function fetchPluginMeta(pluginURL) {
    try {
        if (!pluginURL.endsWith('plugin')) throw new Error('Invalid URL!');

        const data = await $http.get({
            url: pluginURL,
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36",
            }
        }).then(resp => resp.body);

        // some plugins do not have a name, use the file name instead
        const filename = /[^/]*$/.exec(pluginURL)[0];

        const metadata = {};
        data.split("\n")
            .filter(line => line.startsWith("#!"))
            .forEach(line => {
                line = line.trim();
                const matches = /^#!(\w+)=(.*)$/.exec(line);
                if (matches) {
                    const key = matches[1].trim();
                    const value = matches[2].trim();
                    metadata[key] = value;
                }
            });

        return {
            url: pluginURL,
            name: metadata.name || filename,
            description: metadata.desc,
            icon: metadata.icon,
            open_url: metadata.openUrl,
            homepage: metadata.homepage,
            manual: metadata.manual,
        }
    } catch (e) {
        throw new Error(`Error fetching plugin info from ${pluginURL}, reason: ${e}`);
    }
}

function ENV() {
    const isQX = typeof $task !== "undefined";
    const isLoon = typeof $loon !== "undefined";
    const isSurge = typeof $httpClient !== "undefined" && !isLoon;
    const isJSBox = typeof require == "function" && typeof $jsbox != "undefined";
    const isNode = typeof require == "function" && !isJSBox;
    const isRequest = typeof $request !== "undefined";
    const isScriptable = typeof importModule !== "undefined";
    return { isQX, isLoon, isSurge, isNode, isJSBox, isRequest, isScriptable };
}

function HTTP(defaultOptions = { baseURL: "" }) {
    const { isQX, isLoon, isSurge, isScriptable, isNode } = ENV();
    const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];
    const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

    function send(method, options) {
        options = typeof options === "string" ? { url: options } : options;
        const baseURL = defaultOptions.baseURL;
        if (baseURL && !URL_REGEX.test(options.url || "")) {
            options.url = baseURL ? baseURL + options.url : options.url;
        }
        options = { ...defaultOptions, ...options };
        const timeout = options.timeout;
        const events = {
            ...{
                onRequest: () => {
                },
                onResponse: (resp) => resp,
                onTimeout: () => {
                },
            },
            ...options.events,
        };

        events.onRequest(method, options);

        let worker;
        if (isQX) {
            worker = $task.fetch({
                method,
                url: options.url,
                headers: options.headers,
                body: options.body,
            });
        } else if (isLoon || isSurge || isNode) {
            worker = new Promise((resolve, reject) => {
                const request = isNode ? require("request") : $httpClient;
                request[method.toLowerCase()](options, (err, response, body) => {
                    if (err) reject(err);
                    else
                        resolve({
                            statusCode: response.status || response.statusCode,
                            headers: response.headers,
                            body,
                        });
                });
            });
        } else if (isScriptable) {
            const request = new Request(options.url);
            request.method = method;
            request.headers = options.headers;
            request.body = options.body;
            worker = new Promise((resolve, reject) => {
                request
                    .loadString()
                    .then((body) => {
                        resolve({
                            statusCode: request.response.statusCode,
                            headers: request.response.headers,
                            body,
                        });
                    })
                    .catch((err) => reject(err));
            });
        }

        let timeoutid;
        const timer = timeout
            ? new Promise((_, reject) => {
                timeoutid = setTimeout(() => {
                    events.onTimeout();
                    return reject(
                        `${method} URL: ${options.url} exceeds the timeout ${timeout} ms`
                    );
                }, timeout);
            })
            : null;

        return (timer
            ? Promise.race([timer, worker]).then((res) => {
                clearTimeout(timeoutid);
                return res;
            })
            : worker
        ).then((resp) => events.onResponse(resp));
    }

    const http = {};
    methods.forEach(
        (method) =>
            (http[method.toLowerCase()] = (options) => send(method, options))
    );
    return http;
}

function Base64Code() {
    // constants
    const b64chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const b64tab = (function (bin) {
        const t = {};
        let i = 0;
        const l = bin.length;
        for (; i < l; i++) t[bin.charAt(i)] = i;
        return t;
    })(b64chars);
    const fromCharCode = String.fromCharCode;
    // encoder stuff
    const cb_utob = function (c) {
        let cc;
        if (c.length < 2) {
            cc = c.charCodeAt(0);
            return cc < 0x80
                ? c
                : cc < 0x800
                    ? fromCharCode(0xc0 | (cc >>> 6)) + fromCharCode(0x80 | (cc & 0x3f))
                    : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
                    fromCharCode(0x80 | ((cc >>> 6) & 0x3f)) +
                    fromCharCode(0x80 | (cc & 0x3f));
        } else {
            cc =
                0x10000 +
                (c.charCodeAt(0) - 0xd800) * 0x400 +
                (c.charCodeAt(1) - 0xdc00);
            return (
                fromCharCode(0xf0 | ((cc >>> 18) & 0x07)) +
                fromCharCode(0x80 | ((cc >>> 12) & 0x3f)) +
                fromCharCode(0x80 | ((cc >>> 6) & 0x3f)) +
                fromCharCode(0x80 | (cc & 0x3f))
            );
        }
    };
    const re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
    const utob = function (u) {
        return u.replace(re_utob, cb_utob);
    };
    const cb_encode = function (ccc) {
        const padlen = [0, 2, 1][ccc.length % 3],
            ord =
                (ccc.charCodeAt(0) << 16) |
                ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8) |
                (ccc.length > 2 ? ccc.charCodeAt(2) : 0),
            chars = [
                b64chars.charAt(ord >>> 18),
                b64chars.charAt((ord >>> 12) & 63),
                padlen >= 2 ? "=" : b64chars.charAt((ord >>> 6) & 63),
                padlen >= 1 ? "=" : b64chars.charAt(ord & 63),
            ];
        return chars.join("");
    };
    const btoa = function (b) {
        return b.replace(/[\s\S]{1,3}/g, cb_encode);
    };
    this.encode = function (u) {
        const isUint8Array =
            Object.prototype.toString.call(u) === "[object Uint8Array]";
        return isUint8Array ? u.toString("base64") : btoa(utob(String(u)));
    };
    const uriencode = function (u, urisafe) {
        return !urisafe
            ? _encode(u)
            : _encode(String(u))
                .replace(/[+\/]/g, function (m0) {
                    return m0 === "+" ? "-" : "_";
                })
                .replace(/=/g, "");
    };
    const encodeURI = function (u) {
        return uriencode(u, true);
    };
    // decoder stuff
    const re_btou = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
    const cb_btou = function (cccc) {
        switch (cccc.length) {
            case 4:
                const cp =
                    ((0x07 & cccc.charCodeAt(0)) << 18) |
                    ((0x3f & cccc.charCodeAt(1)) << 12) |
                    ((0x3f & cccc.charCodeAt(2)) << 6) |
                    (0x3f & cccc.charCodeAt(3)),
                    offset = cp - 0x10000;
                return (
                    fromCharCode((offset >>> 10) + 0xd800) +
                    fromCharCode((offset & 0x3ff) + 0xdc00)
                );
            case 3:
                return fromCharCode(
                    ((0x0f & cccc.charCodeAt(0)) << 12) |
                    ((0x3f & cccc.charCodeAt(1)) << 6) |
                    (0x3f & cccc.charCodeAt(2))
                );
            default:
                return fromCharCode(
                    ((0x1f & cccc.charCodeAt(0)) << 6) | (0x3f & cccc.charCodeAt(1))
                );
        }
    };
    const btou = function (b) {
        return b.replace(re_btou, cb_btou);
    };
    const cb_decode = function (cccc) {
        const len = cccc.length,
            padlen = len % 4,
            n =
                (len > 0 ? b64tab[cccc.charAt(0)] << 18 : 0) |
                (len > 1 ? b64tab[cccc.charAt(1)] << 12 : 0) |
                (len > 2 ? b64tab[cccc.charAt(2)] << 6 : 0) |
                (len > 3 ? b64tab[cccc.charAt(3)] : 0),
            chars = [
                fromCharCode(n >>> 16),
                fromCharCode((n >>> 8) & 0xff),
                fromCharCode(n & 0xff),
            ];
        chars.length -= [0, 0, 2, 1][padlen];
        return chars.join("");
    };
    const _atob = function (a) {
        return a.replace(/\S{1,4}/g, cb_decode);
    };
    const atob = function (a) {
        return _atob(String(a).replace(/[^A-Za-z0-9\+\/]/g, ""));
    };
    const _decode = function (u) {
        return btou(_atob(u));
    };
    this.decode = function (a) {
        return _decode(
            String(a)
                .replace(/[-_]/g, function (m0) {
                    return m0 === "-" ? "+" : "/";
                })
                .replace(/[^A-Za-z0-9\+\/]/g, "")
        )
            .replace(/&gt;/g, ">")
            .replace(/&lt;/g, "<");
    };
    this.safeEncode = function (a) {
        return this.encode(a.replace(/\+/g, "-").replace(/\//g, "_"));
    };
    this.safeDecode = function (a) {
        return this.decode(a.replace(/-/g, "+").replace(/_/g, "/"));
    };
}
