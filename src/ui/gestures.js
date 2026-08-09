/* ============================================================
   Gestures — the pointer, and the way back
   ------------------------------------------------------------
   Every verb the app has is reachable by a gesture and by a
   button. These are the gestures. Each one claims the pointer
   only once its direction is unambiguous, so scrolling is never
   stolen from the surface underneath.
   ============================================================ */

import { useState, useEffect, useRef } from "react";

/* ---------- swipe + long press ----------
   Right is the affirmative action, left is the corrective one, a long press
   opens everything else. In a list that means done and delete; on the home
   ledger it means done and snooze. The gesture only claims the pointer once it
   is unambiguously horizontal, so vertical scrolling is never stolen.
   A row that offers no action in one direction simply springs back.        */
export const SWIPE_T = 76;

const SWIPE_CAP = 150;

export function useSwipe(haptics) {
  const [st, setSt] = useState({ id: null, dx: 0, anim: false });
  const sw = useRef(null);
  const lp = useRef(null);
  const out = useRef(null);
  const noTap = useRef(0);
  /* A long press ends with a pointerup that must not also read as a tap, however
     long the finger stayed down — otherwise the release immediately undoes the
     selection the press just made. */
  const lpFired = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(lp.current);
      clearTimeout(out.current);
    },
    [],
  );

  const rest = () => setSt({ id: null, dx: 0, anim: false });
  const buzz = (ms) => {
    if (!haptics) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
      /* no haptics here */
    }
  };

  const bind = (id, o) => ({
    onPointerDown: (e) => {
      if (o.disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      sw.current = {
        id,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        live: false,
        target: e.currentTarget,
        pid: e.pointerId,
      };
      clearTimeout(lp.current);
      lpFired.current = false;
      if (o.onLongPress) {
        lp.current = setTimeout(() => {
          sw.current = null;
          lpFired.current = true;
          noTap.current = Date.now();
          buzz(12);
          rest();
          o.onLongPress();
        }, 420);
      }
    },
    onPointerMove: (e) => {
      const s = sw.current;
      if (!s || s.id !== id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) clearTimeout(lp.current);
      /* A row that only wants the long press never enters the drag machinery,
         so scrolling past it costs nothing. */
      if (o.pressOnly) return;
      if (!s.live) {
        if (Math.abs(dx) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          sw.current = null;
          return;
        }
        s.live = true;
        try {
          if (s.target.setPointerCapture) s.target.setPointerCapture(s.pid);
        } catch (err) {
          /* capture unsupported */
        }
      }
      const raw = Math.max(-SWIPE_CAP * 1.6, Math.min(SWIPE_CAP * 1.6, dx));
      s.dx =
        Math.abs(raw) > SWIPE_CAP
          ? Math.sign(raw) * (SWIPE_CAP + (Math.abs(raw) - SWIPE_CAP) * 0.35)
          : raw;
      setSt({ id, dx: s.dx, anim: false });
    },
    onPointerUp: () => {
      clearTimeout(lp.current);
      const s = sw.current;
      sw.current = null;
      if (lpFired.current) {
        lpFired.current = false;
        noTap.current = Date.now();
        return;
      }
      if (!s || s.id !== id || !s.live) return;
      noTap.current = Date.now();
      /* onDone/onDelete are the list's names for the two directions; onRight
         and onLeft are the general ones. A missing handler means that side of
         the row does nothing, so the row springs back instead of flying off. */
      const run = s.dx > 0 ? o.onRight || o.onDone : o.onLeft || o.onDelete;
      if (Math.abs(s.dx) >= SWIPE_T && run) {
        buzz(8);
        setSt({ id, dx: s.dx > 0 ? 460 : -460, anim: true });
        clearTimeout(out.current);
        out.current = setTimeout(() => {
          rest();
          run();
        }, 190);
      } else {
        setSt({ id, dx: 0, anim: true });
      }
    },
    onPointerCancel: () => {
      clearTimeout(lp.current);
      sw.current = null;
      setSt({ id, dx: 0, anim: true });
    },
  });

  /* A gesture that has just ended must not also register as a tap. */
  const tapBlocked = () => Date.now() - noTap.current < 320;
  const dxFor = (id) => (st.id === id ? st.dx : 0);

  return { bind, dxFor, anim: st.anim, tapBlocked, buzz };
}

/* ---------- drag a sheet away ----------
   A full-screen sheet on a phone is dismissed by pulling it down, not by
   hunting for a Close button in the corner. The drag is claimed only when the
   move is clearly downward, so a sideways or upward start still belongs to
   whatever is underneath.                                                   */
const SHEET_T = 96;

export function useSheetDrag(onClose) {
  const [dy, setDy] = useState(0);
  const [anim, setAnim] = useState(false);
  const st = useRef(null);
  const cur = useRef(0);
  cur.current = dy;

  const land = (close) => {
    setAnim(true);
    setDy(0);
    if (close) onClose();
  };

  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      /* The head carries buttons; a press that starts on one is that button's. */
      if (e.target.closest && e.target.closest("button,input,select,textarea"))
        return;
      st.current = {
        x: e.clientX,
        y: e.clientY,
        live: false,
        target: e.currentTarget,
        pid: e.pointerId,
      };
      setAnim(false);
    },
    onPointerMove: (e) => {
      const s = st.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const y = e.clientY - s.y;
      if (!s.live) {
        if (Math.abs(dx) > Math.abs(y) || y < -6) {
          st.current = null;
          return;
        }
        if (y < 7) return;
        s.live = true;
        try {
          if (s.target.setPointerCapture) s.target.setPointerCapture(s.pid);
        } catch (err) {
          /* capture unsupported */
        }
      }
      setDy(Math.max(0, y));
    },
    onPointerUp: () => {
      const s = st.current;
      st.current = null;
      if (!s || !s.live) return;
      land(cur.current > SHEET_T);
    },
    onPointerCancel: () => {
      st.current = null;
      if (cur.current) land(false);
    },
  };

  const style = dy
    ? {
        transform: `translateY(${dy}px)`,
        transition: anim ? "transform .2s cubic-bezier(.2,.8,.2,1)" : "none",
      }
    : {
        transition: anim ? "transform .2s cubic-bezier(.2,.8,.2,1)" : "none",
      };

  return { bind, style, dragging: dy > 0 };
}

/* ---------- page left and right ----------
   The calendar steps a period per swipe. Bound on the whole view rather than on
   a strip, because most of a calendar is buttons and a gesture you have to aim
   at is not a gesture — a click that follows a real swipe is swallowed in the
   capture phase instead.                                                     */
const PAGE_T = 62;

export function usePager(onPrev, onNext, buzz, opts = {}) {
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(false);
  const st = useRef(null);
  const cur = useRef(0);
  const blocked = useRef(0);
  cur.current = dx;

  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      /* Typing beats paging: a field keeps its own pointer. */
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      /* opts.ignore keeps the gesture off anything that swipes for itself —
         a page and the rows inside it cannot both own a horizontal drag. */
      if (opts.ignore && e.target.closest && e.target.closest(opts.ignore))
        return;
      /* opts.edge makes this a back gesture rather than a paging one: it only
         starts within that many pixels of the left edge. */
      if (opts.edge != null) {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX - r.left > opts.edge) return;
      }
      st.current = {
        x: e.clientX,
        y: e.clientY,
        live: false,
        target: e.currentTarget,
        pid: e.pointerId,
      };
      setAnim(false);
    },
    onPointerMove: (e) => {
      const s = st.current;
      if (!s) return;
      const x = e.clientX - s.x;
      const y = e.clientY - s.y;
      if (!s.live) {
        if (Math.abs(x) < 12) return;
        if (Math.abs(y) > Math.abs(x)) {
          st.current = null;
          return;
        }
        s.live = true;
        try {
          if (s.target.setPointerCapture) s.target.setPointerCapture(s.pid);
        } catch (err) {
          /* capture unsupported */
        }
      }
      /* Damped: the grid does not follow the finger one to one, it leans. */
      setDx(Math.max(-120, Math.min(120, x * 0.4)));
    },
    onPointerUp: () => {
      const s = st.current;
      st.current = null;
      if (!s || !s.live) return;
      blocked.current = Date.now();
      const d = cur.current;
      setAnim(true);
      setDx(0);
      if (Math.abs(d) >= PAGE_T * 0.4) {
        if (buzz) buzz(8);
        if (d > 0) onPrev();
        else onNext();
      }
    },
    onPointerCancel: () => {
      st.current = null;
      setAnim(true);
      setDx(0);
    },
    /* The slots and day cells under the finger are buttons; a swipe across them
       must not also open whatever it passed over. */
    onClickCapture: (e) => {
      if (Date.now() - blocked.current < 320) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  const style = {
    transform: dx ? `translateX(${dx}px)` : undefined,
    transition: anim ? "transform .22s cubic-bezier(.2,.8,.2,1)" : "none",
  };

  return { bind, style };
}

/* ---------- the system back button ----------
   Everything that opens above the page — a sheet, the quick-action menu, a
   confirm, the list detail — can already be dismissed by hand, by its own
   button or by a drag. What none of them answered was the *system* back:
   Android's button, the browser's arrow, the edge gesture. Without one, back
   at any depth left the app entirely, which with a sheet open is never what
   was meant.

   The open layers are rebuilt every render, outermost first, and mirrored into
   session history one entry per layer. A pop closes the top layer. A layer
   closed by hand takes its entry back out with `history.go`, and the popstate
   that follows is swallowed rather than read as a second press.

   History is the only mechanism used, deliberately. It is what the browser's
   own back drives, and under Capacitor the WebView counts those entries as
   `canGoBack` — so `web/native.js` can forward the hardware button to
   `history.back()` without either half knowing what is on the stack. Where the
   API is missing or refused, as in a sandboxed frame, the hook goes quiet and
   the on-screen buttons carry on alone. */
export function useSystemBack(layers) {
  const depth = layers.length;
  /* Read at pop time, not at push time: the closer must act on the layers as
     they are when the button is pressed, not as they were when it opened. */
  const stack = useRef(layers);
  stack.current = layers;
  const pushed = useRef(0);
  const swallow = useRef(0);
  const live = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener)
      return undefined;
    const onPop = () => {
      if (swallow.current > 0) {
        swallow.current -= 1;
        return;
      }
      /* Past our own entries: this back belongs to whatever came before the
         app, and letting it through is the point. */
      if (pushed.current <= 0) return;
      pushed.current -= 1;
      const top = stack.current[stack.current.length - 1];
      if (top) top();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!live.current || typeof window === "undefined" || !window.history)
      return;
    try {
      while (pushed.current < depth) {
        pushed.current += 1;
        /* No URL argument: the address bar is not part of this. */
        window.history.pushState({ headsUpDepth: pushed.current }, "");
      }
      if (pushed.current > depth) {
        const drop = pushed.current - depth;
        pushed.current = depth;
        swallow.current += drop;
        window.history.go(-drop);
      }
    } catch (err) {
      live.current = false;
      pushed.current = 0;
      swallow.current = 0;
    }
  }, [depth]);
}
