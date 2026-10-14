/*
 * CollabRealtime: tiny WebSocket client for the whiteboard (server:
 * modules/session/consumers.py). It mirrors the parts of the supabase-js
 * channel API the board scripts use, so they stay unchanged:
 *
 *   const ch = CollabRealtime.channel(sessionId);
 *   ch.on("broadcast", { event: "stroke" }, ({ payload }) => {...});
 *   ch.on("presence", { event: "sync" }, () => ch.presenceState());
 *   ch.subscribe(status => { if (status === "SUBSCRIBED") ch.track({...}); });
 *   ch.send({ type: "broadcast", event: "stroke", payload: {...} });
 *
 * Reconnects automatically with backoff; close code 4403 means "not allowed"
 * and stops reconnecting.
 */
(function () {
  "use strict";

  const MAX_QUEUE = 200;
  const FORBIDDEN = 4403;

  function BoardChannel(sessionId) {
    const scheme = window.location.protocol === "https:" ? "wss://" : "ws://";
    this.url = `${scheme}${window.location.host}/ws/board/${sessionId}/`;
    this.handlers = [];
    this.presence = {};
    this.queue = [];
    this.trackMeta = null;
    this.statusCb = null;
    this.ws = null;
    this.retry = 0;
    this.closedByUser = false;
    this.state = "closed";
  }

  BoardChannel.prototype.on = function (kind, filter, cb) {
    this.handlers.push({ kind, event: filter && filter.event, cb });
    return this;
  };

  BoardChannel.prototype.subscribe = function (cb) {
    this.statusCb = typeof cb === "function" ? cb : null;
    this._connect();
    return this;
  };

  BoardChannel.prototype._status = function (s) {
    try { this.statusCb && this.statusCb(s); } catch (e) { console.warn("realtime status handler failed", e); }
  };

  BoardChannel.prototype._dispatch = function (kind, event, arg) {
    this.handlers.forEach(h => {
      if (h.kind === kind && (!h.event || h.event === event)) {
        try { h.cb(arg); } catch (e) { console.warn(`realtime ${kind}:${event} handler failed`, e); }
      }
    });
  };

  BoardChannel.prototype._connect = function () {
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      console.warn("WebSocket unavailable", e);
      this._status("CHANNEL_ERROR");
      return;
    }
    this.ws = ws;
    this.state = "joining";

    ws.onopen = () => {
      this.state = "joined";
      this.retry = 0;
      if (this.trackMeta) this._raw({ type: "track", meta: this.trackMeta });
      const pending = this.queue.splice(0);
      pending.forEach(m => this._raw(m));
      this._status("SUBSCRIBED");
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "broadcast") {
        this._dispatch("broadcast", msg.event, { type: "broadcast", event: msg.event, payload: msg.payload });
      } else if (msg.type === "presence") {
        this.presence = msg.state || {};
        this._dispatch("presence", "sync", {});
      }
    };

    ws.onclose = (ev) => {
      this.state = "closed";
      this.ws = null;
      if (this.closedByUser) return;
      if (ev.code === FORBIDDEN) {
        this._status("CHANNEL_ERROR");
        return;
      }
      this._status("CLOSED");
      const delay = Math.min(10000, 500 * Math.pow(2, this.retry++));
      setTimeout(() => this._connect(), delay);
    };
  };

  BoardChannel.prototype._raw = function (msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  BoardChannel.prototype.send = function (msg) {
    const out = { type: "broadcast", event: msg && msg.event, payload: (msg && msg.payload) || {} };
    if (!this._raw(out) && this.queue.length < MAX_QUEUE) this.queue.push(out);
    return Promise.resolve("ok");
  };

  BoardChannel.prototype.track = function (meta) {
    this.trackMeta = meta || {};
    this._raw({ type: "track", meta: this.trackMeta });
    return Promise.resolve("ok");
  };

  BoardChannel.prototype.presenceState = function () {
    return this.presence;
  };

  BoardChannel.prototype.unsubscribe = function () {
    this.closedByUser = true;
    if (this.ws) this.ws.close();
  };

  window.CollabRealtime = {
    channel(sessionId) { return new BoardChannel(sessionId); }
  };
})();
