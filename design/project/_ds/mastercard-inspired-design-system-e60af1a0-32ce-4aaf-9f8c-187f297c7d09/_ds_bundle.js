/* @ds-bundle: {"format":4,"namespace":"MastercardInspiredDesignSystem_e60af1","components":[{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"Dialog","sourcePath":"components/surfaces/Dialog.jsx"}],"sourceHashes":{"components/feedback/Badge.jsx":"00fce997644f","components/feedback/Tag.jsx":"d14b853fbeed","components/feedback/Toast.jsx":"34a7ebdfb5a0","components/feedback/Tooltip.jsx":"7801988d380f","components/forms/Button.jsx":"447b414a243a","components/forms/Checkbox.jsx":"4a83a360e984","components/forms/IconButton.jsx":"4bfa8bdb92f1","components/forms/Input.jsx":"f49e09ddefe6","components/forms/Radio.jsx":"ea0280c75d7e","components/forms/Select.jsx":"64655af99e92","components/forms/Switch.jsx":"c5d6f7eefc39","components/navigation/Tabs.jsx":"63234744f3d5","components/surfaces/Card.jsx":"8025b3ec1609","components/surfaces/Dialog.jsx":"80f279e41e4c","ui_kits/marketing-site/components.jsx":"ffacedea79a0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MastercardInspiredDesignSystem_e60af1 = window.MastercardInspiredDesignSystem_e60af1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/feedback/Badge.jsx
try { (() => {
function Badge({
  children,
  tone = "neutral"
}) {
  const tones = {
    neutral: {
      background: "var(--white)",
      color: "var(--ink)"
    },
    ink: {
      background: "var(--ink)",
      color: "var(--canvas-cream)"
    },
    orange: {
      background: "var(--signal-orange)",
      color: "var(--white)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return React.createElement("span", {
    style: {
      ...t,
      borderRadius: "var(--radius-pill)",
      padding: "8px 20px",
      fontFamily: "var(--font-primary)",
      fontSize: 14,
      fontWeight: 500,
      display: "inline-block"
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
function Tag({
  children,
  dotColor = "var(--signal-orange-light)"
}) {
  return React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-primary)",
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: "0.56px",
      textTransform: "uppercase",
      color: "var(--ink)"
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: dotColor,
      display: "inline-block"
    }
  }), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  message,
  onClose
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      background: "var(--ink)",
      color: "var(--canvas-cream)",
      borderRadius: "var(--radius-stadium)",
      padding: "16px 28px",
      fontFamily: "var(--font-primary)",
      fontSize: 14,
      fontWeight: 450,
      boxShadow: "var(--shadow-2)",
      maxWidth: 420
    }
  }, React.createElement("span", null, message), onClose && React.createElement("button", {
    onClick: onClose,
    style: {
      background: "none",
      border: "none",
      color: "var(--canvas-cream)",
      cursor: "pointer",
      fontSize: 16
    }
  }, "×"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = useState(false);
  return React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-block"
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && React.createElement("span", {
    style: {
      position: "absolute",
      bottom: "125%",
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--ink)",
      color: "var(--canvas-cream)",
      padding: "6px 14px",
      borderRadius: "var(--radius-pill)",
      fontSize: 12,
      fontFamily: "var(--font-primary)",
      whiteSpace: "nowrap",
      boxShadow: "var(--shadow-1)"
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
const VARIANT_STYLES = {
  primary: {
    background: "var(--cta-primary-bg)",
    color: "var(--cta-primary-text)",
    border: "1.5px solid var(--cta-primary-bg)"
  },
  secondary: {
    background: "var(--cta-secondary-bg)",
    color: "var(--cta-secondary-text)",
    border: "1.5px solid var(--ink)"
  },
  consent: {
    background: "var(--cta-consent-bg)",
    color: "var(--cta-consent-text)",
    border: "none"
  }
};
function Button({
  variant = "primary",
  size = "default",
  disabled = false,
  children,
  onClick,
  style
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const padding = variant === "consent" ? "1px 30px" : size === "large" ? "16px 40px" : "6px 24px";
  const radius = variant === "consent" ? "var(--radius-consent)" : size === "large" ? "var(--radius-stadium)" : "var(--radius-button)";
  return React.createElement("button", {
    onClick,
    disabled,
    style: {
      fontFamily: "var(--font-primary)",
      fontSize: variant === "consent" ? "13px" : "var(--size-button)",
      fontWeight: variant === "secondary" ? 450 : 500,
      letterSpacing: "var(--ls-button)",
      padding,
      borderRadius: radius,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      transition: "transform 120ms ease, opacity 120ms ease",
      ...v,
      ...style
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = "scale(0.97)";
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = "scale(1)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = "scale(1)";
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked = false,
  onChange,
  label,
  style
}) {
  return React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `1.5px solid ${checked ? "var(--ink)" : "rgba(20,20,19,0.4)"}`,
      background: checked ? "var(--ink)" : "var(--white)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, checked && React.createElement("i", {
    "data-lucide": "check",
    style: {
      width: 13,
      height: 13,
      color: "var(--canvas-cream)"
    }
  })), label && React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 450,
      color: "var(--ink)"
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function IconButton({
  icon = "arrow-right",
  size = 40,
  variant = "outline",
  onClick,
  style
}) {
  const isOutline = variant === "outline";
  return React.createElement("button", {
    onClick,
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: variant === "solid" ? "var(--ink)" : "var(--white)",
      border: isOutline ? "1px solid var(--ink)" : "none",
      color: variant === "solid" ? "var(--white)" : "var(--ink)",
      cursor: "pointer",
      transition: "opacity 120ms ease",
      ...style
    },
    "data-lucide-icon": icon
  }, React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: Math.round(size * 0.4),
      height: Math.round(size * 0.4)
    }
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
const {
  useState
} = React;
function Input({
  placeholder = "Search",
  value,
  onChange,
  icon = "search",
  style
}) {
  const [focused, setFocused] = useState(false);
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--white)",
      border: `1px solid ${focused ? "var(--ink)" : "rgba(20,20,19,0.5)"}`,
      borderRadius: "var(--radius-pill)",
      padding: "12px 24px",
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, icon && React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 18,
      height: 18,
      color: "var(--slate)"
    }
  }), React.createElement("input", {
    placeholder,
    value,
    onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      border: "none",
      outline: "none",
      background: "transparent",
      fontSize: "16px",
      fontWeight: 450,
      color: "var(--ink)",
      width: "100%",
      fontFamily: "var(--font-primary)"
    }
  }));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  checked = false,
  onChange,
  label,
  style
}) {
  return React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, React.createElement("span", {
    onClick: () => onChange && onChange(true),
    style: {
      width: 20,
      height: 20,
      borderRadius: "50%",
      border: `1.5px solid ${checked ? "var(--ink)" : "rgba(20,20,19,0.4)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--white)"
    }
  }, checked && React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: "var(--ink)"
    }
  })), label && React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 450,
      color: "var(--ink)"
    }
  }, label));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useState
} = React;
function Select({
  options = [],
  value,
  onChange,
  dark = false,
  style
}) {
  const [open, setOpen] = useState(false);
  const current = value || options[0];
  return React.createElement("div", {
    style: {
      position: "relative",
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 20px",
      borderRadius: "var(--radius-pill)",
      background: dark ? "var(--ink)" : "var(--white)",
      color: dark ? "var(--white)" : "var(--ink)",
      border: dark ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(20,20,19,0.3)",
      fontSize: 14,
      fontWeight: 500,
      cursor: "pointer"
    }
  }, current, React.createElement("i", {
    "data-lucide": "chevron-down",
    style: {
      width: 14,
      height: 14
    }
  })), open && React.createElement("div", {
    style: {
      position: "absolute",
      top: "110%",
      left: 0,
      background: "var(--white)",
      borderRadius: 12,
      boxShadow: "var(--shadow-2)",
      overflow: "hidden",
      zIndex: 10,
      minWidth: "100%"
    }
  }, options.map(o => React.createElement("div", {
    key: o,
    onClick: () => {
      onChange && onChange(o);
      setOpen(false);
    },
    style: {
      padding: "10px 20px",
      fontSize: 14,
      color: "var(--ink)",
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, o))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked = false,
  onChange,
  style
}) {
  return React.createElement("button", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 44,
      height: 26,
      borderRadius: "var(--radius-pill)",
      border: "none",
      padding: 3,
      cursor: "pointer",
      background: checked ? "var(--ink)" : "rgba(20,20,19,0.2)",
      display: "flex",
      justifyContent: checked ? "flex-end" : "flex-start",
      transition: "background 150ms ease",
      ...style
    }
  }, React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "var(--white)",
      transition: "transform 150ms ease"
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const {
  useState
} = React;
function Tabs({
  items = [],
  defaultIndex = 0
}) {
  const [active, setActive] = useState(defaultIndex);
  return React.createElement("div", {
    style: {
      fontFamily: "var(--font-primary)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      background: "var(--white)",
      borderRadius: "var(--radius-pill)",
      padding: 6,
      width: "fit-content"
    }
  }, items.map((it, i) => React.createElement("button", {
    key: it,
    onClick: () => setActive(i),
    style: {
      border: "none",
      cursor: "pointer",
      padding: "10px 22px",
      borderRadius: "var(--radius-pill)",
      fontSize: 14,
      fontWeight: 500,
      background: active === i ? "var(--ink)" : "transparent",
      color: active === i ? "var(--canvas-cream)" : "var(--ink)",
      transition: "background 150ms ease"
    }
  }, it))));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function Card({
  shape = "portrait",
  image,
  eyebrow,
  title,
  ctaIcon = "arrow-right",
  style,
  children
}) {
  if (shape === "portrait") {
    return React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        fontFamily: "var(--font-primary)",
        width: 260,
        ...style
      }
    }, React.createElement("div", {
      style: {
        position: "relative",
        width: 260,
        height: 260,
        borderRadius: "50%",
        overflow: "hidden",
        background: image ? `center/cover url(${image})` : "linear-gradient(135deg,#e9c9a8,var(--surface-canvas))",
        boxShadow: "var(--shadow-2)"
      }
    }, React.createElement("div", {
      style: {
        position: "absolute",
        right: -10,
        bottom: -10,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "var(--white)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, React.createElement("i", {
      "data-lucide": ctaIcon,
      style: {
        width: 20,
        height: 20,
        color: "var(--ink)"
      }
    }))), eyebrow && React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.56px",
        textTransform: "uppercase",
        color: "var(--ink)"
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--signal-orange-light)"
      }
    }), eyebrow), title && React.createElement("span", {
      style: {
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: "-0.44px",
        color: "var(--ink)",
        textAlign: "center"
      }
    }, title));
  }
  return React.createElement("div", {
    style: {
      borderRadius: "var(--radius-stadium)",
      overflow: "hidden",
      position: "relative",
      width: 360,
      height: 400,
      background: image ? `center/cover url(${image})` : "var(--soft-bone)",
      boxShadow: "var(--shadow-2)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      padding: 24,
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Dialog.jsx
try { (() => {
function Dialog({
  open,
  onClose,
  title,
  children
}) {
  if (!open) return null;
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(20,20,19,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100
    },
    onClick: onClose
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--white)",
      borderRadius: "var(--radius-stadium)",
      padding: 40,
      maxWidth: 480,
      width: "90%",
      boxShadow: "var(--shadow-3)",
      fontFamily: "var(--font-primary)"
    }
  }, title && React.createElement("h3", {
    style: {
      fontSize: 24,
      fontWeight: 500,
      letterSpacing: "-0.48px",
      color: "var(--ink)",
      margin: "0 0 16px"
    }
  }, title), children));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Dialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing-site/components.jsx
try { (() => {
const {
  useState
} = React;
function Nav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const links = ["For you", "For business", "For the world", "For innovators", "News and trends"];
  return React.createElement("div", {
    style: {
      position: "sticky",
      top: 24,
      display: "flex",
      justifyContent: "center",
      zIndex: 50,
      fontFamily: "var(--font-primary)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 40,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(6px)",
      borderRadius: "var(--radius-pill)",
      padding: "16px 40px",
      boxShadow: "var(--shadow-1)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: "var(--ink)",
      letterSpacing: "-0.4px"
    }
  }, "Mastercard"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 32
    }
  }, links.map(l => React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: "var(--ink)",
      fontSize: 15,
      fontWeight: 500,
      textDecoration: "none"
    }
  }, l))), searchOpen ? React.createElement("input", {
    autoFocus: true,
    onBlur: () => setSearchOpen(false),
    placeholder: "Search",
    style: {
      border: "1px solid rgba(20,20,19,0.3)",
      borderRadius: "var(--radius-pill)",
      padding: "8px 18px",
      fontSize: 14,
      width: 160,
      fontFamily: "var(--font-primary)"
    }
  }) : React.createElement("button", {
    onClick: () => setSearchOpen(true),
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "1px solid var(--ink)",
      background: "transparent",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("i", {
    "data-lucide": "search",
    style: {
      width: 16,
      height: 16
    }
  }))));
}
window.Nav = Nav;
function Hero() {
  return React.createElement("section", {
    style: {
      padding: "64px 48px 0",
      fontFamily: "var(--font-primary)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 32,
      gap: 48
    }
  }, React.createElement("h1", {
    style: {
      fontSize: 64,
      fontWeight: 500,
      letterSpacing: "-1.28px",
      lineHeight: "64px",
      color: "var(--ink)",
      margin: 0,
      maxWidth: 640
    }
  }, "Priceless starts here"), React.createElement("p", {
    style: {
      fontSize: 16,
      fontWeight: 450,
      lineHeight: "22.4px",
      color: "var(--slate)",
      maxWidth: 320,
      margin: 0
    }
  }, "Powering payments, protecting people, and building the technology that connects a priceless world.")), React.createElement("div", {
    style: {
      borderRadius: "var(--radius-stadium)",
      height: "56vh",
      minHeight: 360,
      background: "linear-gradient(135deg,#2b2b2b,#141413)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("button", {
    style: {
      width: 80,
      height: 80,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.9)",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, React.createElement("i", {
    "data-lucide": "play",
    style: {
      width: 28,
      height: 28,
      color: "var(--ink)"
    }
  }))));
}
window.Hero = Hero;
const SERVICES = [{
  eyebrow: "Services",
  title: "Fraud & cyber protection",
  align: "flex-start",
  top: 0,
  color: "linear-gradient(135deg,#e9c9a8,#f3f0ee)"
}, {
  eyebrow: "Solutions",
  title: "Data & insights",
  align: "center",
  top: 80,
  color: "linear-gradient(135deg,#d8b48c,#f3f0ee)"
}, {
  eyebrow: "Innovation",
  title: "Open banking APIs",
  align: "flex-end",
  top: 20,
  color: "linear-gradient(135deg,#c99a6b,#f3f0ee)"
}];
function ServicePortraits() {
  return React.createElement("section", {
    style: {
      position: "relative",
      padding: "128px 48px",
      fontFamily: "var(--font-primary)",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      top: -20,
      left: -10,
      fontSize: 130,
      fontWeight: 500,
      color: "var(--ghost-cream)",
      whiteSpace: "nowrap",
      zIndex: 0
    }
  }, "Services"), React.createElement("svg", {
    style: {
      position: "absolute",
      left: "20%",
      top: 120,
      width: "60%",
      height: 200,
      zIndex: 0
    },
    viewBox: "0 0 800 200"
  }, React.createElement("path", {
    d: "M20,160 Q400,-40 780,140",
    stroke: "var(--signal-orange-light)",
    strokeWidth: 1.5,
    fill: "none"
  })), React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      justifyContent: "space-between",
      gap: 24
    }
  }, SERVICES.map(s => React.createElement("div", {
    key: s.title,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: s.align,
      gap: 20,
      marginTop: s.top,
      width: 280
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      width: 260,
      height: 260,
      borderRadius: "50%",
      background: s.color,
      boxShadow: "var(--shadow-2)"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      right: -10,
      bottom: -10,
      width: 52,
      height: 52,
      borderRadius: "50%",
      background: "var(--white)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("i", {
    "data-lucide": "arrow-right",
    style: {
      width: 20,
      height: 20,
      color: "var(--ink)"
    }
  }))), React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.56px",
      textTransform: "uppercase",
      color: "var(--ink)"
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "var(--signal-orange-light)"
    }
  }), s.eyebrow), React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: "-0.44px",
      color: "var(--ink)",
      textAlign: "center"
    }
  }, s.title)))));
}
window.ServicePortraits = ServicePortraits;
const SLIDES = [{
  tag: "Story",
  title: "The road to a cashless economy",
  color: "linear-gradient(160deg,#d9b48f,#8a5a3a)"
}, {
  tag: "Story",
  title: "Small business, big impact",
  color: "linear-gradient(160deg,#c9a37c,#6a4530)"
}, {
  tag: "Story",
  title: "Designing for everyone",
  color: "linear-gradient(160deg,#e0c4a0,#9a6a44)"
}];
function Carousel() {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  return React.createElement("section", {
    style: {
      padding: "64px 48px 128px",
      fontFamily: "var(--font-primary)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 32
    }
  }, React.createElement("div", {
    style: {
      borderRadius: "var(--radius-stadium)",
      width: 360,
      height: 420,
      background: s.color,
      boxShadow: "var(--shadow-2)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 32
    }
  }, React.createElement("span", {
    style: {
      alignSelf: "flex-start",
      background: "var(--white)",
      color: "var(--ink)",
      borderRadius: "var(--radius-pill)",
      padding: "8px 20px",
      fontSize: 13,
      fontWeight: 500
    }
  }, s.tag), React.createElement("span", {
    style: {
      color: "var(--white)",
      fontSize: 28,
      fontWeight: 500,
      letterSpacing: "-0.5px",
      lineHeight: 1.15
    }
  }, s.title)), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, React.createElement("button", {
    onClick: () => setI((i - 1 + SLIDES.length) % SLIDES.length),
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "1px solid var(--ink)",
      background: "transparent",
      cursor: "pointer"
    }
  }, "←"), React.createElement("button", {
    onClick: () => setI((i + 1) % SLIDES.length),
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "1px solid var(--ink)",
      background: "transparent",
      cursor: "pointer"
    }
  }, "→"))));
}
window.Carousel = Carousel;
const COLUMNS = [{
  header: "Need help?",
  items: [["message-circle", "Support center"], ["credit-card", "Report a lost card"], ["map-pin", "Find an ATM"], ["help-circle", "FAQs"]]
}, {
  header: "Company",
  items: [["", "About us"], ["", "Newsroom"], ["", "Careers"], ["", "Investor relations"]]
}, {
  header: "Products",
  items: [["", "Consumer"], ["", "Business"], ["", "Government"], ["", "Developers"]]
}, {
  header: "Legal",
  items: [["", "Privacy notice"], ["", "Terms of use"], ["", "Cookie notice"], ["", "Accessibility"]]
}];
function Footer() {
  const [lang, setLang] = useState("English");
  return React.createElement("footer", {
    style: {
      background: "var(--footer-ink)",
      color: "var(--white)",
      padding: "48px 100px 64px",
      fontFamily: "var(--font-primary)"
    }
  }, React.createElement("h2", {
    style: {
      fontSize: 36,
      fontWeight: 500,
      letterSpacing: "-0.72px",
      maxWidth: 560,
      margin: "0 0 64px"
    }
  }, "We're always here when you need us"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 32
    }
  }, COLUMNS.map(c => React.createElement("div", {
    key: c.header,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "0.56px",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.6)"
    }
  }, c.header), c.items.map(([icon, label]) => React.createElement("a", {
    key: label,
    href: "#",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "var(--white)",
      fontSize: 14,
      fontWeight: 450,
      textDecoration: "none"
    }
  }, icon && React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 16,
      height: 16
    }
  }), label))))), React.createElement("div", {
    style: {
      borderTop: "1px solid rgba(255,255,255,0.25)",
      marginTop: 48,
      paddingTop: 24,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 16
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.6)"
    }
  }, "© 2026 Mastercard. All rights reserved."), React.createElement("button", {
    onClick: () => setLang(lang === "English" ? "Español" : "English"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "transparent",
      color: "var(--white)",
      border: "1px solid rgba(255,255,255,0.4)",
      borderRadius: "var(--radius-pill)",
      padding: "8px 18px",
      fontSize: 13,
      cursor: "pointer"
    }
  }, lang, React.createElement("i", {
    "data-lucide": "chevron-down",
    style: {
      width: 12,
      height: 12
    }
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, ["LinkedIn", "Facebook", "X", "YouTube"].map(s => React.createElement("span", {
    key: s,
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: "var(--white)",
      textDecoration: "underline",
      cursor: "pointer"
    }
  }, s)))));
}
window.Footer = Footer;
function CookieBanner({
  onAccept,
  visible
}) {
  if (!visible) return null;
  return React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--white)",
      borderRadius: "var(--radius-stadium)",
      boxShadow: "var(--shadow-2)",
      padding: "24px 32px",
      display: "flex",
      alignItems: "center",
      gap: 24,
      maxWidth: 560,
      fontFamily: "var(--font-primary)",
      zIndex: 200
    }
  }, React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 450,
      color: "var(--ink)",
      margin: 0,
      flex: 1
    }
  }, "We use cookies to improve your experience and analyze site traffic."), React.createElement("button", {
    onClick: onAccept,
    style: {
      background: "var(--signal-orange)",
      color: "var(--white)",
      border: "none",
      borderRadius: "var(--radius-consent)",
      padding: "1px 30px",
      fontSize: 13,
      fontWeight: 400,
      cursor: "pointer",
      height: 32
    }
  }, "Accept all"));
}
window.CookieBanner = CookieBanner;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing-site/components.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

})();
