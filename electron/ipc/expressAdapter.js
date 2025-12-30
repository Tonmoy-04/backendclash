function createExpressLikeRes() {
  const res = {
    _status: 200,
    _headers: {},
    _body: undefined,
    status(code) {
      this._status = Number(code) || 200;
      return this;
    },
    set(name, value) {
      this._headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    json(payload) {
      this._body = payload;
      return this;
    },
    send(payload) {
      this._body = payload;
      return this;
    }
  };
  return res;
}

function invokeExpressHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = createExpressLikeRes();

    let settled = false;
    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolve({ status: res._status, data: res._body, headers: res._headers });
    };
    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const next = (err) => {
      if (err) return settleReject(err);
      return settleResolve();
    };

    try {
      const maybePromise = handler(req, res, (err) => next(err));
      // If handler is async and returns a promise, resolve after completion.
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(settleResolve).catch(settleReject);
        return;
      }

      // Many Express handlers/middlewares end the response without calling next().
      // Resolve on the next tick so sync `next()` calls still win.
      setImmediate(settleResolve);
    } catch (e) {
      settleReject(e);
    }
  });
}

module.exports = {
  invokeExpressHandler
};
