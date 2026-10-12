// Client-side mirrors of the backend validation rules (see README "Backend CRUD API").

export const PROJECT_STATUSES = ['Pending', 'In Progress', 'Completed'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const isObjectId = (value) => typeof value === 'string' && OBJECT_ID_RE.test(value);

const trimmedLength = (value) => (typeof value === 'string' ? value.trim().length : 0);

/** Money: finite number >= min (default 0), at most two decimal places, up to 1e12 (backend limit). */
export const validateMoney = (value, { min = 0, label = 'Amount' } = {}) => {
  if (value === '' || value === null || value === undefined) return `${label} is required.`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a valid number.`;
  if (n < min) return min > 0 ? `${label} must be greater than zero.` : `${label} cannot be negative.`;
  if (n > 1e12) return `${label} is too large.`;
  if (Math.round(n * 100) / 100 !== n) return `${label} can have at most two decimal places.`;
  return null;
};

const requiredText = (max) => (label) => (value) => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return `${label} is required.`;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return null;
};

const optionalText = (max) => (label) => (value) => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v && v.length > max) return `${label} must be at most ${max} characters.`;
  return null;
};

const req = requiredText;
const opt = optionalText;

export const validateRegister = ({ name, email, password, confirm }) => {
  const errors = {};
  const nameErr = req(120)('Name')(name);
  if (nameErr) errors.name = nameErr;
  const emailErr =
    (!trimmedLength(email) && 'Email is required.') ||
    opt(254)('Email')(email) ||
    (!EMAIL_RE.test(email.trim()) && 'Enter a valid email address.') ||
    null;
  if (emailErr) errors.email = emailErr;
  if (!trimmedLength(password)) errors.password = 'Password is required.';
  else if ([...password].length < 12) errors.password = 'Password must be at least 12 characters.';
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'Password must be at most 72 UTF-8 bytes.';
  if (confirm && confirm !== password) errors.confirm = 'Passwords do not match.';
  return errors;
};

export const validateLogin = ({ email, password }) => {
  const errors = {};
  if (!trimmedLength(email)) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
};

export const validateClient = (input) => {
  const errors = {};
  const nameErr = req(120)('Name')(input.name);
  if (nameErr) errors.name = nameErr;
  const email = (input.email || '').trim();
  if (email) {
    if (email.length > 254) errors.email = 'Email must be at most 254 characters.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  }
  const phoneErr = opt(40)('Phone')(input.phone);
  if (phoneErr) errors.phone = phoneErr;
  const companyErr = opt(160)('Company')(input.company);
  if (companyErr) errors.company = companyErr;
  const notesErr = opt(5000)('Notes')(input.notes);
  if (notesErr) errors.notes = notesErr;
  return errors;
};

export const validateProject = (input) => {
  const errors = {};
  const nameErr = req(200)('Project name')(input.projectName);
  if (nameErr) errors.projectName = nameErr;
  if (!input.client) errors.client = 'Client is required.';
  else if (!isObjectId(input.client)) errors.client = 'Select a valid client.';
  const feeErr = validateMoney(input.fee, { min: 0, label: 'Fee' });
  if (feeErr) errors.fee = feeErr;
  if (!PROJECT_STATUSES.includes(input.status)) errors.status = 'Select a valid status.';
  const descriptionErr = opt(5000)('Description')(input.description);
  if (descriptionErr) errors.description = descriptionErr;
  if (input.startDate && input.dueDate && new Date(input.dueDate) < new Date(input.startDate)) {
    errors.dueDate = 'Due date must be on or after start date.';
  }
  return errors;
};

export const validatePayment = (input) => {
  const errors = {};
  if (!input.project) errors.project = 'Project is required.';
  else if (!isObjectId(input.project)) errors.project = 'Select a valid project.';
  const amountErr = validateMoney(input.amount, { min: 0.01, label: 'Amount' });
  if (amountErr) errors.amount = amountErr;
  const methodErr = req(80)('Payment method')(input.paymentMethod);
  if (methodErr) errors.paymentMethod = methodErr;
  const notesErr = opt(5000)('Notes')(input.notes);
  if (notesErr) errors.notes = notesErr;
  return errors;
};

/** Map backend `errors: [{field,message}]` arrays onto a form's field-error object. */
export const applyServerErrors = (apiError, knownFields = []) => {
  const errors = {};
  for (const e of apiError.errors || []) {
    if (e?.field && (knownFields.length === 0 || knownFields.includes(e.field))) errors[e.field] = e.message;
  }
  return errors;
};
