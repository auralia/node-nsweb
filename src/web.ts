/**
 * Copyright (C) 2017 Auralia
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Promise} from "es6-promise";
import * as https from "https";

/**
 * The version of nsweb.
 */
export const VERSION = "0.1.0";

/**
 * This error is thrown after a failed request to the NationStates website and
 * contains additional information about the failed request.
 */
export class RequestError extends Error {
    /**
     * The message associated with the error.
     */
    public message: string;
    /**
     * The HTTP response code returned by the NationStates website.
     */
    public responseCode?: number;
    /**
     * The HTTP response text returned by the NationStates website.
     */
    public responseText?: string;

    /**
     * Initializes a new instance of the ApiError class.
     *
     * @param message The message associated with the error.
     * @param responseCode The HTTP response code returned by the NationStates
     *                     website.
     * @param responseText The HTTP response text returned by the NationStates
     *                     website.
     */
    constructor(message: string, responseCode?: number, responseText?: string) {
        super(message);
        this.message = message;
        this.responseCode = responseCode;
        this.responseText = responseText;
    }
}

/**
 * Provides access to some parts of NationStates not exposed through the
 * standard API.
 */
export class NsWeb {
    private _userAgent: string;
    private _delay: boolean;
    private _requestDelayMillis: number;

    private readonly _queue: {
        func: () => void;
        reject: (err: any) => void;
    }[];
    private _interval: any;
    private _lastRequestTime: number;
    private _requestInProgress: boolean;

    private _blockExistingRequests: boolean;
    private _blockNewRequests: boolean;
    private _cleanup: boolean;

    /**
     * Initializes a new instance of the NsWeb class.
     *
     * @param userAgent A string identifying you to NationStates. Using the
     *                  name of your main nation is recommended.
     * @param delay Whether a delay is introduced before requests. Defaults to
     *              true.
     * @param requestDelayMillis The delay before requests in milliseconds.
     *                           Defaults to 6000.
     * @param allowImmediateRequests Allows requests immediately after this
     *                               NsWeb instance is initialized.
     */
    constructor(userAgent: string,
                delay: boolean = true,
                requestDelayMillis: number = 6000,
                allowImmediateRequests: boolean = true)
    {
        this.userAgent = userAgent;
        this.delay = delay;
        this.requestDelayMillis = requestDelayMillis;

        this._queue = [];
        if (allowImmediateRequests) {
            this._lastRequestTime = Date.now() - this.requestDelayMillis;
        } else {
            this._lastRequestTime = Date.now();
        }
        this._requestInProgress = false;

        this.initInterval();
        this.blockExistingRequests = false;
        this.blockNewRequests = false;
        this._cleanup = false;
    }

    /**
     * Gets a string identifying you to NationStates.
     */
    public get userAgent() {
        return this._userAgent;
    }

    /**
     * Sets a string identifying you to NationStates. Using the name of your
     * main nation is recommended.
     */
    public set userAgent(userAgent: string) {
        if (typeof userAgent !== "string") {
            throw new Error("A valid user agent must be defined in order to"
                            + " use the NationStates API");
        }
        this._userAgent = `node-nsweb ${VERSION} (maintained by Auralia,`
                          + ` currently used by "${userAgent}")`;
    }

    /**
     * Gets whether a delay is introduced before requests.
     */
    public get delay() {
        return this._delay;
    }

    /**
     * Sets a value indicating whether a delay is introduced before requests.
     *
     * Setting this value re-initializes the scheduler.
     */
    public set delay(delay: boolean) {
        this._delay = delay;
        this.initInterval();
    }

    /**
     * Gets the delay before requests in milliseconds.
     */
    public get requestDelayMillis() {
        return this._requestDelayMillis;
    }

    /**
     * Sets the delay before requests in milliseconds. Must be greater than
     * or equal to 6000.
     */
    public set requestDelayMillis(requestDelayMillis: number) {
        if (requestDelayMillis < 6000) {
            throw new RangeError("Delay must be greater than or equal to"
                                 + " 6000");
        }
        this._requestDelayMillis = requestDelayMillis;
    }

    /**
     * Gets whether this NsWeb instance is blocked from performing any further
     * requests.
     */
    public get blockExistingRequests() {
        return this._blockExistingRequests;
    }

    /**
     * Sets whether this NsWeb instance is blocked from performing any further
     * requests.
     */
    public set blockExistingRequests(blockExistingRequests: boolean) {
        this._blockExistingRequests = blockExistingRequests;
    }

    /**
     * Gets whether new requests are blocked from being added to the queue.
     */
    public get blockNewRequests() {
        return this._blockNewRequests;
    }

    /**
     * Sets whether new requests are blocked from being added to the queue.
     */
    public set blockNewRequests(blockNewRequests: boolean) {
        this._blockNewRequests = blockNewRequests;
    }

    /**
     * Gets whether a request is in progress.
     */
    public get requestInProgress() {
        return this._requestInProgress;
    }

    /**
     * Gets whether there is at least one request in the queue.
     */
    public get requestsQueued() {
        return this._queue.length !== 0;
    }

    /**
     * Cancels all requests in the queue.
     */
    public clearQueue(): void {
        while (this._queue.length > 0) {
            this._queue.pop()!.reject(new Error(
                "Request cancelled: clearQueue function was called"));
        }
    }

    /**
     * Cancels all requests in the API queue and turns off the API scheduler.
     *
     * After this function is called, no further requests can be made using
     * this API instance, including requests currently in the queue.
     */
    public cleanup(): void {
        clearInterval(this._interval);
        this.clearQueue();
        this._cleanup = true;
    }

    /**
     * Attempts to log into NationStates with the specified nation name and
     * password.
     *
     * @param nation The nation name to log in with.
     * @param password The password to log in with.
     * @return A promise returning true if the log in attempt succeeded or
     *         false if it failed.
     */
    public loginRequest(nation: string, password: string): Promise<boolean> {
        return Promise.resolve().then(() => {
            let data = "logging_in=1";
            data += "&nation=" + encodeURIComponent(NsWeb.toId(nation));
            data += "&password=" + encodeURIComponent(password);

            return this.loginRestoreRequest(data).then(headers => {
                return headers["set-cookie"]
                           .filter((str: string) => {
                               return str.indexOf("pin=") === 0;
                           })
                           .length === 1
            });
        });
    }

    /**
     * Attempts to restore the specified NationStates nation using the
     * specified password.
     *
     * This call affects parts of NationStates other than the specified nation.
     * Automating this request is a violation of NationStates script rules.
     *
     * @param nation The nation name to log in with.
     * @param password The password to log in with.
     * @return A promise returning true if the restore attempt succeeded or
     *         false if it failed.
     */
    public restoreRequest(nation: string, password: string): Promise<boolean> {
        return Promise.resolve().then(() => {
            let data = "logging_in=1";
            data += "&nation=" + encodeURIComponent(NsWeb.toId(nation));
            data += "&restore_nation=" + encodeURIComponent(" Restore "
                    + NsWeb.toId(nation) + " ");
            data += "&restore_password=" + encodeURIComponent(password);

            return this.loginRestoreRequest(data).then(headers => {
                return headers["set-cookie"]
                           .filter((str: string) => {
                               return str.indexOf("pin=") === 0;
                           })
                           .length === 1
            });
        });
    }

    /**
     * Initializes the API scheduler.
     */
    private initInterval(): void {
        clearInterval(this._interval);
        if (this.delay) {
            this._interval = setInterval(() => {
                if (this.requestInProgress
                    || this._queue.length === 0
                    || this.blockExistingRequests)
                {
                    return;
                }

                let nextReq = this._queue[0];
                if (Date.now() - this._lastRequestTime
                    > this.requestDelayMillis)
                {
                    this._requestInProgress = true;
                    nextReq.func();
                    this._queue.shift();
                }
            }, 0);
        } else {
            this._interval = setInterval(() => {
                if (this._queue.length === 0
                    || this.blockExistingRequests)
                {
                    return;
                }

                let nextReq = this._queue.shift()!;
                nextReq.func();
            }, 0);
        }
    }

    /**
     * Creates a POST request to the NationStates website with the specified
     * data.
     *
     * @param data The specified data.
     *
     * @return A promise returning the headers from the response.
     */
    private loginRestoreRequest(data: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.blockNewRequests) {
                throw new Error("Request blocked: blockNewRequests property is"
                                + " set to true");
            }
            if (this._cleanup) {
                throw new Error("Request blocked: cleanup function has been"
                                + " called and no further requests can be"
                                + " made using this API instance");
            }

            let headers: any = {
                "User-Agent": this.userAgent,
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(data)
            };

            const func = () => {
                let request = https.request(
                    {
                        host: "www.nationstates.net",
                        path: "/",
                        method: "POST",
                        headers
                    },
                    res => {
                        let data = "";
                        res.on("data", chunk => {
                            data += chunk;
                        });
                        res.on("end", () => {
                            this._requestInProgress = false;
                            this._lastRequestTime = Date.now();

                            // Accept response code 302 on login and restore
                            if (res.statusCode === 200
                                || res.statusCode === 302)
                            {
                                resolve(res.headers);
                            } else {
                                reject(new RequestError(
                                    `Request failed: API returned HTTP`
                                    + ` response code ${res.statusCode}`,
                                    res.statusCode,
                                    data));
                            }
                        });
                    }
                ).on("error", reject);

                request.write(data);
                request.end();
            };
            this._queue.push({func, reject});
        });
    }

    /**
     * Converts names to a fixed form: all lowercase, with spaces replaced
     * with underscores.
     *
     * @param name The name to convert.
     *
     * @return The converted name.
     */
    private static toId(name: string) {
        return name.replace("_", " ").trim().toLowerCase().replace(" ", "_");
    }
}
