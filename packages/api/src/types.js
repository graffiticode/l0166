// Minimal structural type constructors for the checker
// Types are plain objects with a `kind` discriminator

export const t = {
  number() { return { kind: 'number' }; },
  string() { return { kind: 'string' }; },
  bool() { return { kind: 'bool' }; },
  json() { return { kind: 'json' }; },
  any() { return { kind: 'any' }; },

  list(elem) { return { kind: 'list', elem }; },
  record(fields = {}, open = true) { return { kind: 'record', fields, open }; },
  fn(params = [], ret = { kind: 'any' }) { return { kind: 'fn', params, ret }; },
  enum(values = []) { return { kind: 'enum', values: Array.from(values) }; },
};

// Pretty-printer (optional helper for errors, unused for now)
export function pp(type) {
  if (!type) return 'unknown';
  switch (type.kind) {
    case 'number':
    case 'string':
    case 'bool':
    case 'json':
    case 'any':
      return type.kind;
    case 'list':
      return `list<${pp(type.elem)}>`;
    case 'record': {
      const fields = Object.entries(type.fields || {})
        .map(([k, v]) => `${k}: ${pp(v)}`)
        .join(', ');
      return `{ ${fields}${type.open ? ', ...' : ''} }`;
    }
    case 'fn':
      return `<${type.params.map(pp).join(' ')}: ${pp(type.ret)}>`;
    case 'enum':
      return `enum{${(type.values || []).join('|')}}`;
    default:
      return 'unknown';
  }
}

