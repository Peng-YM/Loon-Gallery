/**
 * Loon plugin gallery

██╗      ██████╗  ██████╗ ███╗   ██╗     ██████╗  █████╗ ██╗     ██╗     ███████╗██████╗ ██╗   ██╗
██║     ██╔═══██╗██╔═══██╗████╗  ██║    ██╔════╝ ██╔══██╗██║     ██║     ██╔════╝██╔══██╗╚██╗ ██╔╝
██║     ██║   ██║██║   ██║██╔██╗ ██║    ██║  ███╗███████║██║     ██║     █████╗  ██████╔╝ ╚████╔╝ 
██║     ██║   ██║██║   ██║██║╚██╗██║    ██║   ██║██╔══██║██║     ██║     ██╔══╝  ██╔══██╗  ╚██╔╝  
███████╗╚██████╔╝╚██████╔╝██║ ╚████║    ╚██████╔╝██║  ██║███████╗███████╗███████╗██║  ██║   ██║   
╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝     ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝   ╚═╝   
                                                                                       
 */


const $ = API("loon-gallery", true);

const GITHUB_ACCESS_TOKEN = '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';

const PLUGIN_SOURCE_REPO_KEY = "sources-repos";
if (!$.read(PLUGIN_SOURCE_REPO_KEY)) $.write({}, PLUGIN_SOURCE_REPO_KEY);

const PLUGIN_KEY = "plugins";
if (!$.read(PLUGIN_KEY)) $.write({}, PLUGIN_KEY);

service();

function service() {
    const $app = express();

    $app.all("/", (req, res) => {
        res.set("location", "https://loon-gallery.vercel.app/").status(302).end();
    });

    $app.start();
}

/**
 * OpenAPI
 * https://github.com/Peng-YM/QuanX/blob/master/Tools/OpenAPI/README.md
 */
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

function API(name = "untitled", debug = false) {
    const { isQX, isLoon, isSurge, isNode, isJSBox, isScriptable } = ENV();
    return new (class {
        constructor(name, debug) {
            this.name = name;
            this.debug = debug;

            this.http = HTTP();
            this.env = ENV();

            this.node = (() => {
                if (isNode) {
                    const fs = require("fs");

                    return {
                        fs,
                    };
                } else {
                    return null;
                }
            })();
            this.initCache();

            const delay = (t, v) =>
                new Promise(function (resolve) {
                    setTimeout(resolve.bind(null, v), t);
                });

            Promise.prototype.delay = function (t) {
                return this.then(function (v) {
                    return delay(t, v);
                });
            };
        }

        // persistence
        // initialize cache
        initCache() {
            if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}");
            if (isLoon || isSurge)
                this.cache = JSON.parse($persistentStore.read(this.name) || "{}");

            if (isNode) {
                // create a json for root cache
                let fpath = "root.json";
                if (!this.node.fs.existsSync(fpath)) {
                    this.node.fs.writeFileSync(
                        fpath,
                        JSON.stringify({}),
                        { flag: "wx" },
                        (err) => console.log(err)
                    );
                }
                this.root = {};

                // create a json file with the given name if not exists
                fpath = `${this.name}.json`;
                if (!this.node.fs.existsSync(fpath)) {
                    this.node.fs.writeFileSync(
                        fpath,
                        JSON.stringify({}),
                        { flag: "wx" },
                        (err) => console.log(err)
                    );
                    this.cache = {};
                } else {
                    this.cache = JSON.parse(
                        this.node.fs.readFileSync(`${this.name}.json`)
                    );
                }
            }
        }

        // store cache
        persistCache() {
            const data = JSON.stringify(this.cache, null, 2);
            if (isQX) $prefs.setValueForKey(data, this.name);
            if (isLoon || isSurge) $persistentStore.write(data, this.name);
            if (isNode) {
                this.node.fs.writeFileSync(
                    `${this.name}.json`,
                    data,
                    { flag: "w" },
                    (err) => console.log(err)
                );
                this.node.fs.writeFileSync(
                    "root.json",
                    JSON.stringify(this.root, null, 2),
                    { flag: "w" },
                    (err) => console.log(err)
                );
            }
        }

        write(data, key) {
            this.log(`SET ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (isSurge || isLoon) {
                    return $persistentStore.write(data, key);
                }
                if (isQX) {
                    return $prefs.setValueForKey(data, key);
                }
                if (isNode) {
                    this.root[key] = data;
                }
            } else {
                this.cache[key] = data;
            }
            this.persistCache();
        }

        read(key) {
            this.log(`READ ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (isSurge || isLoon) {
                    return $persistentStore.read(key);
                }
                if (isQX) {
                    return $prefs.valueForKey(key);
                }
                if (isNode) {
                    return this.root[key];
                }
            } else {
                return this.cache[key];
            }
        }

        delete(key) {
            this.log(`DELETE ${key}`);
            if (key.indexOf("#") !== -1) {
                key = key.substr(1);
                if (isSurge || isLoon) {
                    return $persistentStore.write(null, key);
                }
                if (isQX) {
                    return $prefs.removeValueForKey(key);
                }
                if (isNode) {
                    delete this.root[key];
                }
            } else {
                delete this.cache[key];
            }
            this.persistCache();
        }

        // notification
        notify(title, subtitle = "", content = "", options = {}) {
            const openURL = options["open-url"];
            const mediaURL = options["media-url"];

            if (isQX) $notify(title, subtitle, content, options);
            if (isSurge) {
                $notification.post(
                    title,
                    subtitle,
                    content + `${mediaURL ? "\n多媒体:" + mediaURL : ""}`,
                    {
                        url: openURL,
                    }
                );
            }
            if (isLoon) {
                let opts = {};
                if (openURL) opts["openUrl"] = openURL;
                if (mediaURL) opts["mediaUrl"] = mediaURL;
                if (JSON.stringify(opts) === "{}") {
                    $notification.post(title, subtitle, content);
                } else {
                    $notification.post(title, subtitle, content, opts);
                }
            }
            if (isNode || isScriptable) {
                const content_ =
                    content +
                    (openURL ? `\n点击跳转: ${openURL}` : "") +
                    (mediaURL ? `\n多媒体: ${mediaURL}` : "");
                if (isJSBox) {
                    const push = require("push");
                    push.schedule({
                        title: title,
                        body: (subtitle ? subtitle + "\n" : "") + content_,
                    });
                } else {
                    console.log(`${title}\n${subtitle}\n${content_}\n\n`);
                }
            }
        }

        // other helper functions
        log(msg) {
            if (this.debug) console.log(`[${this.name}] LOG: ${msg}`);
        }

        info(msg) {
            console.log(`[${this.name}] INFO: ${msg}`);
        }

        error(msg) {
            console.log(`[${this.name}] ERROR: ${msg}`);
        }

        wait(millisec) {
            return new Promise((resolve) => setTimeout(resolve, millisec));
        }

        done(value = {}) {
            if (isQX || isLoon || isSurge) {
                $done(value);
            } else if (isNode && !isJSBox) {
                if (typeof $context !== "undefined") {
                    $context.headers = value.headers;
                    $context.statusCode = value.statusCode;
                    $context.body = value.body;
                }
            }
        }
    })(name, debug);
}

/**
 * Mini Express Framework
 * https://github.com/Peng-YM/QuanX/blob/master/Tools/OpenAPI/Express.js
 */
function express({ port } = { port: 3000 }) {
    const { isNode } = ENV();
    const DEFAULT_HEADERS = {
        "Content-Type": "text/plain;charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS,PATCH,PUT,DELETE",
        "Access-Control-Allow-Headers":
            "Origin, X-Requested-With, Content-Type, Accept",
    };

    // node support
    if (isNode) {
        const express_ = require("express");
        const bodyParser = require("body-parser");
        const app = express_();
        app.use(bodyParser.json({ verify: rawBodySaver }));
        app.use(bodyParser.urlencoded({ verify: rawBodySaver, extended: true }));
        app.use(bodyParser.raw({ verify: rawBodySaver, type: "*/*" }));
        app.use((req, res, next) => {
            res.set(DEFAULT_HEADERS);
            next();
        });

        // adapter
        app.start = () => {
            app.listen(port, () => {
                $.log(`Express started on port: ${port}`);
            });
        };
        return app;
    }

    // route handlers
    const handlers = [];

    // http methods
    const METHODS_NAMES = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS",
        "HEAD'",
        "ALL",
    ];

    // dispatch url to route
    const dispatch = (request, start = 0) => {
        let { method, url, headers, body } = request;
        if (/json/i.test(headers["Content-Type"])) {
            body = JSON.parse(body);
        }

        method = method.toUpperCase();
        const { path, query } = extractURL(url);

        // pattern match
        let handler = null;
        let i;
        let longestMatchedPattern = 0;
        for (i = start; i < handlers.length; i++) {
            if (handlers[i].method === "ALL" || method === handlers[i].method) {
                const { pattern } = handlers[i];
                if (patternMatched(pattern, path)) {
                    if (pattern.split("/").length > longestMatchedPattern) {
                        handler = handlers[i];
                        longestMatchedPattern = pattern.split("/").length;
                    }
                }
            }
        }
        if (handler) {
            // dispatch to next handler
            const next = () => {
                dispatch(method, url, i);
            };
            const req = {
                method,
                url,
                path,
                query,
                params: extractPathParams(handler.pattern, path),
                headers,
                body,
            };
            const res = Response();
            const cb = handler.callback;

            const errFunc = (err) => {
                res.status(500).json({
                    status: "failed",
                    message: `Internal Server Error: ${err}`,
                });
            };

            if (cb.constructor.name === "AsyncFunction") {
                cb(req, res, next).catch(errFunc);
            } else {
                try {
                    cb(req, res, next);
                } catch (err) {
                    errFunc(err);
                }
            }
        } else {
            // no route, return 404
            const res = Response();
            res.status(404).json({
                status: "failed",
                message: "ERROR: 404 not found",
            });
        }
    };

    const app = {};

    // attach http methods
    METHODS_NAMES.forEach((method) => {
        app[method.toLowerCase()] = (pattern, callback) => {
            // add handler
            handlers.push({ method, pattern, callback });
        };
    });

    // chainable route
    app.route = (pattern) => {
        const chainApp = {};
        METHODS_NAMES.forEach((method) => {
            chainApp[method.toLowerCase()] = (callback) => {
                // add handler
                handlers.push({ method, pattern, callback });
                return chainApp;
            };
        });
        return chainApp;
    };

    // start service
    app.start = () => {
        dispatch($request);
    };

    return app;

    /************************************************
     Utility Functions
     *************************************************/
    function rawBodySaver(req, res, buf, encoding) {
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || "utf8");
        }
    }

    function Response() {
        let statusCode = 200;
        const { isQX, isLoon, isSurge } = ENV();
        const headers = DEFAULT_HEADERS;
        const STATUS_CODE_MAP = {
            200: "HTTP/1.1 200 OK",
            201: "HTTP/1.1 201 Created",
            302: "HTTP/1.1 302 Found",
            307: "HTTP/1.1 307 Temporary Redirect",
            308: "HTTP/1.1 308 Permanent Redirect",
            404: "HTTP/1.1 404 Not Found",
            500: "HTTP/1.1 500 Internal Server Error",
        };
        return new (class {
            status(code) {
                statusCode = code;
                return this;
            }

            send(body = "") {
                const response = {
                    status: isQX ? STATUS_CODE_MAP[statusCode] : statusCode,
                    body,
                    headers,
                };
                if (isQX) {
                    $done(response);
                } else if (isLoon || isSurge) {
                    $done({
                        response,
                    });
                }
            }

            end() {
                this.send();
            }

            html(data) {
                this.set("Content-Type", "text/html;charset=UTF-8");
                this.send(data);
            }

            json(data) {
                this.set("Content-Type", "application/json;charset=UTF-8");
                $.info(headers);
                this.send(JSON.stringify(data));
            }

            set(key, val) {
                headers[key] = val;
                return this;
            }
        })();
    }

    function patternMatched(pattern, path) {
        if (pattern instanceof RegExp && pattern.test(path)) {
            return true;
        } else {
            // root pattern, match all
            if (pattern === "/") return true;
            // normal string pattern
            if (pattern.indexOf(":") === -1) {
                const spath = path.split("/");
                const spattern = pattern.split("/");
                for (let i = 0; i < spattern.length; i++) {
                    if (spath[i] !== spattern[i]) {
                        return false;
                    }
                }
                return true;
            }
            // string pattern with path parameters
            else if (extractPathParams(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    function extractURL(url) {
        // extract path
        const match = url.match(/https?:\/\/[^\/]+(\/[^?]*)/) || [];
        const path = match[1] || "/";

        // extract query string
        const split = url.indexOf("?");
        const query = {};
        if (split !== -1) {
            let hashes = url.slice(url.indexOf("?") + 1).split("&");
            for (let i = 0; i < hashes.length; i++) {
                hash = hashes[i].split("=");
                query[hash[0]] = hash[1];
            }
        }
        return {
            path,
            query,
        };
    }

    function extractPathParams(pattern, path) {
        if (pattern.indexOf(":") === -1) {
            return null;
        } else {
            const params = {};
            for (let i = 0, j = 0; i < pattern.length; i++, j++) {
                if (pattern[i] === ":") {
                    let key = [];
                    let val = [];
                    while (pattern[++i] !== "/" && i < pattern.length) {
                        key.push(pattern[i]);
                    }
                    while (path[j] !== "/" && j < path.length) {
                        val.push(path[j++]);
                    }
                    params[key.join("")] = val.join("");
                } else {
                    if (pattern[i] !== path[j]) {
                        return null;
                    }
                }
            }
            return params;
        }
    }
}