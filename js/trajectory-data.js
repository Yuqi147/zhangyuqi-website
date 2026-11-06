/* Geographic life trajectory CSV parsing and map helpers.
 * All visits live in data/life-trajectory.csv; no visit data is duplicated here.
 * A blank or “Present” end value means an ongoing stay.
 */
(() => {
  'use strict';

  const categories = {
    study: { label: 'Study / work', color: '#ef646b', priority: 3 },
    travel: { label: 'Travel', color: '#f2c45c', priority: 2 },
    live: { label: 'Live', color: '#69c79b', priority: 1 },
    transfer: { label: 'Transfer', color: '#5dcddd', priority: 0 }
  };

  const gridSize = 0.5;
  const requiredColumns = ['id', 'city', 'state_province', 'country', 'purpose', 'start', 'end', 'longitude', 'latitude'];

  function csvError(row, message) {
    return new Error(`CSV row ${row}: ${message}`);
  }

  // A state machine preserves quoted commas, escaped quotes, and embedded newlines.
  // Row numbers identify the record's starting physical line, including blank lines.
  function readCSVRows(input) {
    if (typeof input !== 'string') throw new TypeError('CSV input must be text.');
    const text = input.replace(/^\uFEFF/, '');
    const records = [];
    let fields = [];
    let field = '';
    let quoted = false;
    let afterQuote = false;
    let line = 1;
    let rowLine = 1;

    function finishField() {
      fields.push(field);
      field = '';
      afterQuote = false;
    }

    function finishRow() {
      finishField();
      if (fields.some(value => value.trim() !== '')) records.push({ fields, line: rowLine });
      fields = [];
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; afterQuote = true; }
        } else {
          field += char;
          if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line++;
        }
      } else if (char === ',') {
        finishField();
      } else if (char === '\r' || char === '\n') {
        finishRow();
        if (char === '\r' && text[i + 1] === '\n') i++;
        line++;
        rowLine = line;
      } else if (afterQuote) {
        if (char !== ' ' && char !== '\t') throw csvError(rowLine, 'unexpected text after a closing quote.');
      } else if (char === '"') {
        if (field !== '') throw csvError(rowLine, 'a quote must start a field; escape a literal quote as "" inside a quoted field.');
        quoted = true;
      } else {
        field += char;
      }
    }
    if (quoted) throw csvError(rowLine, 'quoted field is not closed.');
    if (field !== '' || fields.length || afterQuote) finishRow();
    return records;
  }

  function validDate(value) {
    if (/^\d{4}-\d{2}$/.test(value)) return validDate(value + '-01');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
  }

  function parseCSV(text) {
    const records = readCSVRows(text);
    if (!records.length) throw csvError(1, 'the file is empty; add the header and stay rows.');
    const headerRow = records.shift();
    const headers = headerRow.fields.map(value => value.trim().toLowerCase());
    if (headers.some(header => !header)) throw csvError(headerRow.line, 'column names cannot be blank.');
    if (new Set(headers).size !== headers.length) throw csvError(headerRow.line, 'column names must be unique.');
    const missing = requiredColumns.filter(column => !headers.includes(column));
    if (missing.length) throw csvError(headerRow.line, `missing required columns: ${missing.join(', ')}.`);
    const purposeKey = value => value.toLowerCase().replace(/\s+/g, '');
    const purposeNames = new Map(Object.entries(categories).flatMap(([key, category]) =>
      [[purposeKey(key), key], [purposeKey(category.label), key]]));
    purposeNames.set('live(weekends)', 'live');
    const ids = new Map();

    return records.map(({ fields, line }) => {
      if (fields.length !== headers.length) {
        throw csvError(line, `expected ${headers.length} columns, found ${fields.length}; quote values containing commas.`);
      }
      const values = Object.fromEntries(headers.map((header, index) => [header, fields[index].trim()]));
      ['id', 'city', 'state_province', 'country', 'purpose', 'start'].forEach(column => {
        if (!values[column]) throw csvError(line, `${column} cannot be blank.`);
      });
      if (ids.has(values.id)) throw csvError(line, `id "${values.id}" is already used on row ${ids.get(values.id)}.`);
      ids.set(values.id, line);
      const purpose = purposeNames.get(purposeKey(values.purpose));
      if (!purpose) throw csvError(line, 'purpose must be study, travel, live, or transfer (their displayed labels also work).');
      if (!validDate(values.start)) throw csvError(line, 'start must be a real date in YYYY-MM or YYYY-MM-DD format.');
      const end = !values.end || /^present$/i.test(values.end) ? null : values.end;
      if (end && !validDate(end)) throw csvError(line, 'end must be a real month or date, Present, or blank.');
      if (end && (end.length === 7 ? end + '-31' : end) < values.start) throw csvError(line, 'end cannot be earlier than start.');
      const coordinate = (column, limit) => {
        const raw = values[column];
        const value = Number(raw);
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(value) || Math.abs(value) > limit) {
          throw csvError(line, `${column} must be a number between ${-limit} and ${limit}.`);
        }
        return value;
      };
      return {
        id: values.id, city: values.city, region: values.state_province, country: values.country,
        purpose, start: values.start, end,
        ...(purposeKey(values.purpose) === 'live(weekends)' ? { purposeLabel: 'Live (weekends)' } : {}),
        longitude: coordinate('longitude', 180), latitude: coordinate('latitude', 90),
        ...(values.city_zh ? { cityZh: values.city_zh } : {}),
        ...(values.state_province_zh ? { regionZh: values.state_province_zh } : {}),
        ...(values.region1 ? { region1: values.region1 } : {}),
        ...(values.region2 ? { region2: values.region2 } : {})
      };
    });
  }

  function cellFor(stay) {
    const { longitude, latitude } = stay;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
        longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new RangeError('A location must have valid longitude and latitude.');
    }
    // Floor, rather than truncate, keeps western/southern coordinates in their cells.
    // The antimeridian wraps to -180; the north pole belongs to the last latitude cell.
    const west = Math.floor((longitude === 180 ? -180 : longitude) / gridSize) * gridSize;
    const south = Math.min(Math.floor(latitude / gridSize) * gridSize, 90 - gridSize);
    return {
      id: `${west.toFixed(1)},${south.toFixed(1)}`,
      west, south, east: west + gridSize, north: south + gridSize
    };
  }

  function groupStays(records, level) {
    if (!['first', 'second', 'precise'].includes(level)) {
      throw new RangeError('Map level must be first, second, or precise.');
    }
    const priority = purpose => level !== 'first' && purpose === 'live'
      ? Infinity
      : categories[purpose].priority;
    const groups = new Map();
    records.forEach(stay => {
      if (!Object.hasOwn(categories, stay.purpose)) {
        throw new RangeError(`Unknown stay purpose: ${stay.purpose}`);
      }
      const cell = level === 'precise' ? cellFor(stay) : null;
      const id = cell ? cell.id : stay[level === 'first' ? 'region1' : 'region2'];
      // Missing administrative geometry must not prevent the precise view or log.
      if (!id) return;
      if (!groups.has(id)) {
        groups.set(id, { id, purpose: stay.purpose, stays: [], ...(cell ? { cell } : {}) });
      }
      const group = groups.get(id);
      group.stays.push(stay);
      if (priority(stay.purpose) > priority(group.purpose)) {
        group.purpose = stay.purpose;
      }
    });
    return [...groups.values()];
  }

  function toCSV(records) {
    const escapeCell = value => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      [...requiredColumns, 'city_zh', 'state_province_zh', 'region1', 'region2'],
      ...records.map(stay => [
        stay.id, stay.city, stay.region, stay.country, stay.purposeLabel || stay.purpose,
        stay.start, stay.end ?? 'Present', stay.longitude, stay.latitude,
        stay.cityZh ?? '', stay.regionZh ?? '', stay.region1 ?? '', stay.region2 ?? ''
      ])
    ];
    return rows.map(row => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
  }

  globalThis.LifeTrajectoryData = { categories, gridSize, parseCSV, groupStays, cellFor, toCSV };
})();
