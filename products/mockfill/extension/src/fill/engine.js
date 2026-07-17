// MockFill engine: classify form fields and fill them with realistic fake
// data. Pure DOM + math — no chrome.* APIs — so the same file runs injected
// into real pages and loaded directly in the test harness.
(() => {
  // Deterministic RNG (mulberry32) so Pro "seed mode" reproduces exact runs.
  function makeRNG(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const FIRST = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie", "Dana", "Sam", "Robin", "Charlie", "Frankie", "Drew", "Elliot", "Harper", "Rowan", "Sage", "Emerson"];
  const LAST = ["Smith", "Johnson", "Miller", "Garcia", "Davis", "Martinez", "Lopez", "Wilson", "Anderson", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Walker", "Hall", "Young", "King", "Wright", "Hill"];
  const STREETS = ["Maple Street", "Oak Avenue", "Cedar Lane", "Pine Road", "Elm Drive", "Willow Way", "Birch Boulevard", "Chestnut Court", "Spruce Terrace", "Juniper Place"];
  const CITIES = ["Springfield", "Riverton", "Fairview", "Lakeside", "Georgetown", "Ashland", "Milford", "Clayton", "Dayton", "Brookfield"];
  const STATES = ["AL", "AZ", "CA", "CO", "FL", "GA", "IL", "MA", "NY", "OH", "OR", "TX", "WA"];
  const COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia"];
  const COMPANIES = ["Acme Corp", "Globex", "Initech", "Umbrella Labs", "Stark Industries", "Wayne Enterprises", "Hooli", "Pied Piper", "Vandelay Industries", "Wonka Co"];
  const JOBS = ["Software Engineer", "Product Manager", "QA Analyst", "Designer", "Data Scientist", "Marketing Manager", "Accountant", "Support Specialist"];
  const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt labore dolore magna aliqua enim minim veniam quis nostrud exercitation ullamco laboris nisi aliquip".split(" ");

  // Industry-standard, publicly documented TEST card numbers (Luhn-valid,
  // never chargeable). This is a QA tool — real card data is never used.
  const TEST_CARDS = {
    visa: "4242424242424242",
    mastercard: "5555555555554444",
    amex: "378282246310005",
    discover: "6011111111111117"
  };

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function digits(rng, n) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(rng() * 10);
    return s;
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function luhnValid(num) {
    const s = String(num).replace(/\D/g, "");
    let sum = 0;
    let dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let d = +s[i];
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return s.length > 0 && sum % 10 === 0;
  }

  // Generators receive (rng, settings, ctx) and return a string.
  const GENERATORS = {
    firstName: (r) => pick(r, FIRST),
    lastName: (r) => pick(r, LAST),
    fullName: (r) => `${pick(r, FIRST)} ${pick(r, LAST)}`,
    email: (r, s) => {
      const domain = (s && s.emailDomain) || "example.com";
      return `${pick(r, FIRST).toLowerCase()}.${pick(r, LAST).toLowerCase()}${digits(r, 3)}@${domain}`;
    },
    // 555-01XX block is reserved for fictional use.
    phone: (r) => `(${pick(r, ["202", "303", "415", "512", "617", "718", "808"])}) 555-01${digits(r, 2)}`,
    username: (r) => `${pick(r, FIRST).toLowerCase()}_${pick(r, LAST).toLowerCase()}${digits(r, 2)}`,
    password: (r) => `Aa1!${Array.from({ length: 8 }, () => pick(r, "abcdefghjkmnpqrstuvwxyz23456789".split(""))).join("")}`,
    url: (r) => `https://www.${pick(r, COMPANIES).toLowerCase().replace(/[^a-z]/g, "")}.example.com`,
    company: (r) => pick(r, COMPANIES),
    jobTitle: (r) => pick(r, JOBS),
    streetAddress: (r) => `${100 + Math.floor(r() * 9800)} ${pick(r, STREETS)}`,
    addressLine2: (r) => `Apt ${1 + Math.floor(r() * 60)}`,
    city: (r) => pick(r, CITIES),
    state: (r) => pick(r, STATES),
    zip: (r) => digits(r, 5),
    country: (r) => pick(r, COUNTRIES),
    age: (r) => String(18 + Math.floor(r() * 50)),
    number: (r, _s, ctx) => {
      const min = ctx && ctx.min !== "" && ctx.min != null ? Number(ctx.min) : 1;
      const max = ctx && ctx.max !== "" && ctx.max != null ? Number(ctx.max) : Math.max(min + 99, 100);
      return String(min + Math.floor(r() * (max - min + 1)));
    },
    word: (r) => pick(r, WORDS),
    sentence: (r) => {
      const n = 6 + Math.floor(r() * 8);
      const w = Array.from({ length: n }, () => pick(r, WORDS));
      w[0] = w[0][0].toUpperCase() + w[0].slice(1);
      return w.join(" ") + ".";
    },
    paragraph: (r) => Array.from({ length: 3 }, () => GENERATORS.sentence(r)).join(" "),
    cardNumber: (r, s) => TEST_CARDS[(s && s.cardBrand) || "visa"] || TEST_CARDS.visa,
    cardName: (r) => `${pick(r, FIRST)} ${pick(r, LAST)}`.toUpperCase(),
    cardExpiry: (r) => {
      const now = new Date();
      const m = 1 + Math.floor(r() * 12);
      return `${pad2(m)}/${String(now.getFullYear() + 2).slice(2)}`;
    },
    cardExpiryMonth: (r) => pad2(1 + Math.floor(r() * 12)),
    cardExpiryYear: (r) => String(new Date().getFullYear() + 2),
    cardCvc: (r) => digits(r, 3),
    birthdate: (r) => {
      const now = new Date();
      const y = now.getFullYear() - 18 - Math.floor(r() * 47);
      return `${y}-${pad2(1 + Math.floor(r() * 12))}-${pad2(1 + Math.floor(r() * 28))}`;
    },
    date: (r) => {
      const d = new Date(Date.now() + (Math.floor(r() * 60) - 30) * 86400000);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    },
    time: (r) => `${pad2(Math.floor(r() * 24))}:${pad2(Math.floor(r() * 60))}`,
    month: (r) => {
      const d = new Date();
      return `${d.getFullYear()}-${pad2(1 + Math.floor(r() * 12))}`;
    },
    week: (r) => `${new Date().getFullYear()}-W${pad2(1 + Math.floor(r() * 52))}`,
    color: (r) => "#" + Array.from({ length: 6 }, () => pick(r, "0123456789abcdef".split(""))).join("")
  };

  // Classification: autocomplete attribute wins, then type, then fuzzy match
  // on name/id/placeholder/label text.
  const AUTOCOMPLETE_MAP = {
    "given-name": "firstName",
    "additional-name": "firstName",
    "family-name": "lastName",
    name: "fullName",
    email: "email",
    tel: "phone",
    "tel-national": "phone",
    username: "username",
    "new-password": "password",
    "current-password": "password",
    organization: "company",
    "organization-title": "jobTitle",
    "street-address": "streetAddress",
    "address-line1": "streetAddress",
    "address-line2": "addressLine2",
    "address-level2": "city",
    "address-level1": "state",
    "postal-code": "zip",
    country: "country",
    "country-name": "country",
    "cc-number": "cardNumber",
    "cc-name": "cardName",
    "cc-exp": "cardExpiry",
    "cc-exp-month": "cardExpiryMonth",
    "cc-exp-year": "cardExpiryYear",
    "cc-csc": "cardCvc",
    bday: "birthdate",
    url: "url"
  };

  const NAME_PATTERNS = [
    [/\b(first[\s_-]?name|fname|given)\b/i, "firstName"],
    [/\b(last[\s_-]?name|lname|surname|family)\b/i, "lastName"],
    [/\b(full[\s_-]?name)\b/i, "fullName"],
    [/\b(e-?mail)\b/i, "email"],
    [/\b(phone|mobile|tel(ephone)?)\b/i, "phone"],
    [/\b(user[\s_-]?name|login|handle)\b/i, "username"],
    [/\b(pass(word|phrase)?|pwd)\b/i, "password"],
    [/\b(company|organi[sz]ation|employer)\b/i, "company"],
    [/\b(job|title|role|position)\b/i, "jobTitle"],
    [/\b(address[\s_-]?(line)?[\s_-]?2|apt|suite|unit)\b/i, "addressLine2"],
    [/\b(street|address)\b/i, "streetAddress"],
    [/\b(city|town|locality)\b/i, "city"],
    [/\b(state|province|region)\b/i, "state"],
    [/\b(zip|postal)\b/i, "zip"],
    [/\b(country)\b/i, "country"],
    [/\b(card[\s_-]?(number|no|num)|cc[\s_-]?num|pan)\b/i, "cardNumber"],
    [/\b(cvc|cvv|csc|security[\s_-]?code)\b/i, "cardCvc"],
    [/\b(exp(iry|iration)?[\s_-]?(date)?)\b/i, "cardExpiry"],
    [/\b(birth|dob|born)\b/i, "birthdate"],
    [/\b(age)\b/i, "age"],
    [/\b(web[\s_-]?site|url|homepage|link)\b/i, "url"],
    [/\b(message|comment|description|notes?|bio|about|feedback|summary)\b/i, "paragraph"]
  ];

  function labelTextFor(el) {
    const doc = el.ownerDocument;
    if (el.id) {
      const lab = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return lab.textContent || "";
    }
    const parent = el.closest("label");
    return parent ? parent.textContent || "" : "";
  }

  function rawDescriptor(el) {
    return [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), labelTextFor(el)]
      .filter(Boolean)
      .join(" ")
      .slice(0, 300);
  }

  // snake_case, kebab-case and camelCase become word-separated so \b
  // patterns match (job_title → "job title", cardNumber → "card Number").
  function descriptor(el) {
    return rawDescriptor(el)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ");
  }

  function classify(el) {
    const ac = (el.getAttribute("autocomplete") || "").toLowerCase().trim();
    if (AUTOCOMPLETE_MAP[ac]) return AUTOCOMPLETE_MAP[ac];

    const type = (el.type || "").toLowerCase();
    if (type === "email") return "email";
    if (type === "tel") return "phone";
    if (type === "url") return "url";
    if (type === "password") return "password";
    if (type === "date") return /birth|dob/i.test(descriptor(el)) ? "birthdate" : "date";
    if (type === "time") return "time";
    if (type === "month") return "month";
    if (type === "week") return "week";
    if (type === "color") return "color";
    if (type === "number" || type === "range") {
      const d = descriptor(el);
      for (const [re, kind] of NAME_PATTERNS) if (re.test(d)) return kind === "phone" || kind === "zip" || kind === "age" ? kind : "number";
      return "number";
    }

    const d = descriptor(el);
    for (const [re, kind] of NAME_PATTERNS) if (re.test(d)) return kind;
    if (el.tagName === "TEXTAREA") return "paragraph";
    return "sentence";
  }

  // Set value the way frameworks expect: through the native setter, then
  // real input/change events so React/Vue/Angular listeners see the change.
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true, cancelable: type !== "input" }));
  }

  function fillTextLike(el, value) {
    const max = el.maxLength && el.maxLength > 0 ? el.maxLength : Infinity;
    const v = String(value).slice(0, max === Infinity ? undefined : max);
    el.focus();
    setNativeValue(el, v);
    fire(el, "input");
    fire(el, "change");
    el.blur && el.blur();
    return v;
  }

  function matchCustomRule(el, rules) {
    if (!Array.isArray(rules)) return null;
    // Users write patterns against their real field names, so match both the
    // raw descriptor (internal_ref) and the normalized one (internal ref).
    const raw = rawDescriptor(el);
    const norm = descriptor(el);
    for (const rule of rules) {
      if (!rule || !rule.pattern) continue;
      let re;
      try {
        re = new RegExp(rule.pattern, "i");
      } catch {
        continue;
      }
      if (re.test(raw) || re.test(norm)) return rule;
    }
    return null;
  }

  const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

  function fillableElements(root) {
    return Array.from(root.querySelectorAll("input, textarea, select")).filter((el) => {
      if (el.disabled || el.readOnly) return false;
      if (el.tagName === "INPUT" && SKIP_TYPES.has((el.type || "").toLowerCase())) return false;
      if (el.dataset && el.dataset.mockfill === "skip") return false;
      if (el.closest("[data-mockfill='skip']")) return false;
      return true;
    });
  }

  // Fills every form control in `root`. Returns { filled, byKind }.
  function fillDocument(root, settings = {}) {
    const seedMode = !!(settings.pro && settings.seedEnabled && settings.seed);
    const rng = makeRNG(seedMode ? hashSeed(String(settings.seed)) : (Math.random() * 2 ** 32) >>> 0);
    const doneRadioGroups = new Set();
    let filled = 0;
    const byKind = {};

    for (const el of fillableElements(root)) {
      const tag = el.tagName;
      const type = (el.type || "").toLowerCase();

      const rule = settings.pro ? matchCustomRule(el, settings.customRules) : null;
      if (rule && rule.action === "skip") continue;

      if (tag === "SELECT") {
        const options = Array.from(el.options).filter((o) => !o.disabled && o.value !== "");
        if (!options.length) continue;
        if (el.multiple) {
          for (const o of el.options) o.selected = false;
          pick(rng, options).selected = true;
        } else {
          setNativeValue(el, pick(rng, options).value);
        }
        fire(el, "input");
        fire(el, "change");
        filled++;
        byKind.select = (byKind.select || 0) + 1;
        continue;
      }

      if (type === "checkbox") {
        // Consent-style boxes always get checked so validation passes.
        const alwaysCheck = settings.checkAllBoxes || /\b(agree|terms|accept|consent|privacy|subscribe)\b/i.test(descriptor(el));
        const wantChecked = alwaysCheck || rng() < 0.5;
        if (el.checked !== wantChecked) {
          el.focus();
          el.click(); // real click keeps framework state in sync
        }
        filled++;
        byKind.checkbox = (byKind.checkbox || 0) + 1;
        continue;
      }

      if (type === "radio") {
        const key = el.name || el.id || Math.random();
        if (doneRadioGroups.has(key)) continue;
        doneRadioGroups.add(key);
        const group = el.name ? Array.from(el.ownerDocument.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)).filter((r) => !r.disabled) : [el];
        const chosen = pick(rng, group);
        chosen.focus();
        chosen.click();
        filled++;
        byKind.radio = (byKind.radio || 0) + 1;
        continue;
      }

      let kind = classify(el);
      let value;
      if (rule) {
        if (rule.action === "value") value = rule.value != null ? String(rule.value) : "";
        else if (rule.action === "preset" && GENERATORS[rule.preset]) {
          kind = rule.preset;
          value = GENERATORS[kind](rng, settings, el);
        }
      }
      if (value === undefined) {
        // Card fields only get test numbers when Pro card fill is on;
        // otherwise they get harmless digits.
        if (kind === "cardNumber" && !(settings.pro && settings.fillCards)) value = digits(rng, 16);
        else if (!GENERATORS[kind]) value = GENERATORS.sentence(rng);
        else value = GENERATORS[kind](rng, settings, el);
      }

      // Range inputs need numeric values inside min/max.
      if (type === "range") {
        const min = el.min !== "" ? Number(el.min) : 0;
        const max = el.max !== "" ? Number(el.max) : 100;
        value = String(min + Math.floor(rng() * (max - min + 1)));
      }

      fillTextLike(el, value);
      filled++;
      byKind[kind] = (byKind[kind] || 0) + 1;
    }
    return { filled, byKind };
  }

  globalThis.MockFillEngine = {
    VERSION: "1.0.0",
    makeRNG,
    hashSeed,
    classify,
    descriptor,
    fillDocument,
    luhnValid,
    GENERATORS,
    TEST_CARDS
  };
})();
