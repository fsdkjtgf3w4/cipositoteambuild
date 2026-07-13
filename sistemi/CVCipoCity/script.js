'use strict';
/* =========================================================
   CipoCity — Curriculum Vitae Editor
   100% frontend. Persistenza: localStorage.
   ========================================================= */

const STORAGE_KEY = 'cipocity_cvs_v1';
const CURRENT_KEY = 'cipocity_current_cv_v1';
const AUTOSAVE_DELAY = 500;

const LEVELS_LANG = ['Base', 'Intermedio', 'Avanzato', 'Madrelingua'];
const LEVELS_SKILL = ['Base', 'Intermedio', 'Avanzato', 'Esperto'];
const CATEGORIE_INFORMATICHE = ['Linguaggi di programmazione', 'Software', 'Sistemi operativi', 'Framework', 'Database', 'Strumenti professionali'];
const CATEGORIE_ALTRE = ['Competenze professionali', 'Capacità organizzative', 'Capacità comunicative', 'Certificazioni', 'Patenti', 'Corsi di formazione', 'Attestati'];

/* ---------------------------------------------------------
   Config per le sezioni ripetibili (usato dal modale generico)
   --------------------------------------------------------- */
const SECTION_CONFIG = {
  istruzione: {
    label: 'titolo di studio',
    listKey: 'istruzione',
    fields: [
      { key: 'istituto', label: 'Nome istituto', type: 'text', required: true },
      { key: 'titolo', label: 'Titolo conseguito', type: 'text', required: true },
      { key: 'dataInizio', label: 'Data inizio', type: 'month', required: true },
      { key: 'dataFine', label: 'Data fine', type: 'month' },
      { key: 'voto', label: 'Voto finale (opzionale)', type: 'text' },
      { key: 'descrizione', label: 'Descrizione (opzionale)', type: 'textarea', full: true },
    ],
    render(item) {
      return {
        title: escapeHtml(item.titolo || '(senza titolo)'),
        sub: `${escapeHtml(item.istituto || '')} ${item.voto ? '· voto ' + escapeHtml(item.voto) : ''}`,
        dates: formatRange(item.dataInizio, item.dataFine, false),
        desc: item.descrizione || '',
      };
    },
  },
  esperienze: {
    label: 'esperienza lavorativa',
    listKey: 'esperienze',
    fields: [
      { key: 'titolo', label: 'Titolo del lavoro', type: 'text', required: true },
      { key: 'datore', label: 'Datore di lavoro', type: 'text', required: true },
      { key: 'dataInizio', label: 'Data inizio', type: 'month', required: true },
      { key: 'dataFine', label: 'Data fine', type: 'month' },
      { key: 'corrente', label: 'Attualmente in corso', type: 'checkbox' },
      { key: 'descrizione', label: 'Attività svolte', type: 'textarea', required: true, full: true },
      { key: 'risultati', label: 'Risultati ottenuti (opzionale)', type: 'textarea', full: true },
    ],
    render(item) {
      return {
        title: escapeHtml(item.titolo || '(senza titolo)'),
        sub: escapeHtml(item.datore || ''),
        dates: formatRange(item.dataInizio, item.dataFine, item.corrente),
        desc: item.descrizione || '',
      };
    },
  },
  lingue: {
    label: 'lingua',
    listKey: 'lingue',
    fields: [
      { key: 'nome', label: 'Nome lingua', type: 'text', required: true },
      { key: 'comprensione', label: 'Comprensione', type: 'select', options: LEVELS_LANG },
      { key: 'lettura', label: 'Lettura', type: 'select', options: LEVELS_LANG },
      { key: 'scrittura', label: 'Scrittura', type: 'select', options: LEVELS_LANG },
      { key: 'conversazione', label: 'Conversazione', type: 'select', options: LEVELS_LANG },
      { key: 'produzioneOrale', label: 'Produzione orale', type: 'select', options: LEVELS_LANG },
    ],
    render(item) {
      return {
        title: escapeHtml(item.nome || '(senza nome)'),
        sub: `Comprensione: ${escapeHtml(item.comprensione || '—')} · Conversazione: ${escapeHtml(item.conversazione || '—')}`,
        dates: '',
        desc: '',
      };
    },
  },
  informatiche: {
    label: 'competenza informatica',
    listKey: 'competenzeInformatiche',
    fields: [
      { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIE_INFORMATICHE, required: true },
      { key: 'nome', label: 'Nome', type: 'text', required: true },
      { key: 'livello', label: 'Livello', type: 'select', options: LEVELS_SKILL },
      { key: 'descrizione', label: 'Descrizione (opzionale)', type: 'textarea', full: true },
    ],
    render(item) {
      return {
        title: escapeHtml(item.nome || '(senza nome)'),
        sub: `${escapeHtml(item.categoria || '')} · ${escapeHtml(item.livello || '—')}`,
        dates: '',
        desc: item.descrizione || '',
      };
    },
  },
  altre: {
    label: 'elemento',
    listKey: 'altreCompetenze',
    fields: [
      { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIE_ALTRE, required: true },
      { key: 'nome', label: 'Nome / titolo', type: 'text', required: true },
      { key: 'descrizione', label: 'Descrizione (opzionale)', type: 'textarea', full: true },
    ],
    render(item) {
      return {
        title: escapeHtml(item.nome || '(senza nome)'),
        sub: escapeHtml(item.categoria || ''),
        dates: '',
        desc: item.descrizione || '',
      };
    },
  },
};

/* ---------------------------------------------------------
   Stato applicazione
   --------------------------------------------------------- */
let cvs = [];
let currentCvId = null;
let saveTimer = null;
let sortableInstances = {};
let modalContext = null; // { sectionKey, itemId }

/* ---------------------------------------------------------
   Utility
   --------------------------------------------------------- */
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePlainText(str) {
  // Rimuove tag HTML da input testuali per evitare iniezioni indesiderate.
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML.replace(/&amp;/g, '&');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function monthYearLabel(value) {
  if (!value) return '';
  const [y, m] = value.split('-');
  if (!y || !m) return escapeHtml(value);
  const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return `${mesi[idx] || m}/${y}`;
}

function formatRange(start, end, current) {
  const s = monthYearLabel(start);
  if (current) return s ? `DA ${s} A CORRENTE` : 'CORRENTE';
  const e = monthYearLabel(end);
  if (s && e) return `DA ${s} A ${e}`;
  if (s) return `DA ${s}`;
  return e ? `A ${e}` : '';
}

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function flashSaveStatus(text, saving) {
  const el = document.getElementById('save-status');
  el.textContent = text;
  el.classList.toggle('saving', !!saving);
}

/* ---------------------------------------------------------
   Modello dati / storage
   --------------------------------------------------------- */
function blankCv(name) {
  return {
    id: uuid(),
    nomeInterno: name || 'Nuovo curriculum',
    creato: new Date().toISOString(),
    modificato: new Date().toISOString(),
    personal: {
      nome: '', dataNascita: '', luogoNascita: '',
      nazionalita: '', email: '', foto: '', serialeCI: '',
    },
    istruzione: [],
    esperienze: [],
    lingue: [],
    competenzeInformatiche: [],
    altreCompetenze: [],
    firma: '',
    firmaScale: 1,
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cvs = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Errore nel caricamento dei dati locali', e);
    cvs = [];
  }
  if (!Array.isArray(cvs) || cvs.length === 0) {
    cvs = [blankCv('Il mio curriculum')];
  }
  currentCvId = localStorage.getItem(CURRENT_KEY);
  if (!cvs.find((c) => c.id === currentCvId)) {
    currentCvId = cvs[0].id;
  }
}

function persist(showStatus) {
  clearTimeout(saveTimer);
  if (showStatus) flashSaveStatus('Salvataggio…', true);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cvs));
      localStorage.setItem(CURRENT_KEY, currentCvId);
      flashSaveStatus('Tutte le modifiche salvate', false);
    } catch (e) {
      console.error(e);
      flashSaveStatus('Errore di salvataggio (spazio locale esaurito?)', false);
      showToast('Impossibile salvare: spazio di archiviazione locale esaurito.', 'error');
    }
  }, AUTOSAVE_DELAY);
}

function getCurrentCv() {
  return cvs.find((c) => c.id === currentCvId) || null;
}

function touchCurrentCv() {
  const cv = getCurrentCv();
  if (cv) cv.modificato = new Date().toISOString();
}

/* ---------------------------------------------------------
   Gestione elenco CV
   --------------------------------------------------------- */
function renderCvSelect() {
  const sel = document.getElementById('cv-select');
  sel.innerHTML = '';
  cvs
    .slice()
    .sort((a, b) => new Date(b.modificato) - new Date(a.modificato))
    .forEach((cv) => {
      const opt = document.createElement('option');
      opt.value = cv.id;
      const displayName = (cv.personal.nome)
        ? `${cv.personal.nome}`.trim()
        : cv.nomeInterno;
      opt.textContent = displayName;
      if (cv.id === currentCvId) opt.selected = true;
      sel.appendChild(opt);
    });
}

function selectCv(id) {
  currentCvId = id;
  persist(false);
  fillFormFromCv();
  renderCvSelect();
  renderAllLists();
  renderPreview();
}

function newCv() {
  const cv = blankCv('Nuovo curriculum');
  cvs.push(cv);
  selectCv(cv.id);
  showToast('Nuovo curriculum creato.', 'success');
}

function duplicateCv() {
  const cv = getCurrentCv();
  if (!cv) return;
  const copy = JSON.parse(JSON.stringify(cv));
  copy.id = uuid();
  copy.nomeInterno = cv.nomeInterno + ' (copia)';
  copy.creato = new Date().toISOString();
  copy.modificato = new Date().toISOString();
  cvs.push(copy);
  selectCv(copy.id);
  showToast('Curriculum duplicato.', 'success');
}

function deleteCv() {
  if (cvs.length <= 1) {
    showToast('Deve rimanere almeno un curriculum.', 'error');
    return;
  }
  const cv = getCurrentCv();
  if (!cv) return;
  const name = (cv.personal.nome) ? `${cv.personal.nome}`.trim() : cv.nomeInterno;
  if (!confirm(`Eliminare definitivamente il curriculum "${name}"? L'operazione non è reversibile.`)) return;
  cvs = cvs.filter((c) => c.id !== cv.id);
  currentCvId = cvs[0].id;
  persist(false);
  fillFormFromCv();
  renderCvSelect();
  renderAllLists();
  renderPreview();
  showToast('Curriculum eliminato.', 'success');
}

function exportCv() {
  const cv = getCurrentCv();
  if (!cv) return;
  const blob = new Blob([JSON.stringify(cv, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (cv.personal.nome) ? `${cv.personal.nome}` : cv.nomeInterno;
  a.href = url;
  a.download = `Curriculum Vitae di CipoCity - ${name.replace(/[^\w\-]+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importCvFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.personal) {
        throw new Error('Formato non valido');
      }
      const cv = blankCv('Curriculum importato');
      cv.id = uuid();
      cv.personal = Object.assign(cv.personal, data.personal || {});
      cv.istruzione = Array.isArray(data.istruzione) ? data.istruzione.map(withId) : [];
      cv.esperienze = Array.isArray(data.esperienze) ? data.esperienze.map(withId) : [];
      cv.lingue = Array.isArray(data.lingue) ? data.lingue.map(withId) : [];
      cv.competenzeInformatiche = Array.isArray(data.competenzeInformatiche) ? data.competenzeInformatiche.map(withId) : [];
      cv.altreCompetenze = Array.isArray(data.altreCompetenze) ? data.altreCompetenze.map(withId) : [];
      cv.firma = typeof data.firma === 'string' ? data.firma : '';
      cv.firmaScale = typeof data.firmaScale === 'number' ? data.firmaScale : 1;
      cvs.push(cv);
      selectCv(cv.id);
      showToast('Curriculum importato con successo.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Il file selezionato non è un JSON di curriculum valido.', 'error');
    }
  };
  reader.onerror = () => showToast('Impossibile leggere il file selezionato.', 'error');
  reader.readAsText(file);
}

function withId(item) {
  return Object.assign({ id: uuid() }, item, { id: item.id || uuid() });
}

/* ---------------------------------------------------------
   Dati personali — binding form <-> stato
   --------------------------------------------------------- */
const PERSONAL_FIELDS = ['nome', 'dataNascita', 'luogoNascita', 'nazionalita', 'email', 'serialeCI'];

function fillFormFromCv() {
  const cv = getCurrentCv();
  if (!cv) return;
  PERSONAL_FIELDS.forEach((key) => {
    const el = document.getElementById('p-' + key);
    if (el) el.value = cv.personal[key] || '';
  });
  clearFieldError('p-nome');
  clearFieldError('p-email');
  clearFieldError('p-dataNascita');

  const img = document.getElementById('photo-img');
  const placeholder = document.getElementById('photo-placeholder');
  if (cv.personal.foto) {
    img.src = cv.personal.foto;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
  }

  const scaleInput = document.getElementById('signature-scale');
  scaleInput.value = cv.firmaScale || 1;
  redrawSignatureFromData();
}

function bindPersonalFieldEvents() {
  PERSONAL_FIELDS.forEach((key) => {
    const el = document.getElementById('p-' + key);
    if (!el) return;
    el.addEventListener('input', () => {
      const cv = getCurrentCv();
      if (!cv) return;
      const value = el.type === 'email' ? el.value.trim() : sanitizePlainText(el.value);
      cv.personal[key] = value;
      touchCurrentCv();
      validatePersonalField(key);
      persist(true);
      renderPreview();
      renderCvSelect();
    });
    el.addEventListener('blur', () => validatePersonalField(key));
  });
}

function setFieldError(inputId, message) {
  const field = document.getElementById(inputId)?.closest('.field');
  const msg = document.querySelector(`.error-msg[data-for="${inputId}"]`);
  if (field) field.classList.toggle('invalid', !!message);
  if (msg) msg.textContent = message || '';
}
function clearFieldError(inputId) { setFieldError(inputId, ''); }

function validatePersonalField(key) {
  const cv = getCurrentCv();
  if (!cv) return true;
  const val = cv.personal[key];
  if (key === 'nome' && !val.trim()) { setFieldError('p-nome', 'Il nome è obbligatorio.'); return false; }
  if (key === 'nome') clearFieldError('p-nome');
  if (key === 'email') {
    if (!val.trim()) { setFieldError('p-email', 'La CipoMail è obbligatoria.'); return false; }
    if (!isValidEmail(val)) { setFieldError('p-email', 'Formato email non valido.'); return false; }
    clearFieldError('p-email');
  }
  if (key === 'dataNascita' && val) {
    const d = new Date(val);
    if (isNaN(d.getTime()) || d > new Date()) { setFieldError('p-dataNascita', 'Data non valida.'); return false; }
    clearFieldError('p-dataNascita');
  }
  return true;
}

function validateAllPersonal() {
  let ok = true;
  ['nome', 'email', 'dataNascita'].forEach((k) => { if (!validatePersonalField(k)) ok = false; });
  return ok;
}

/* ---------------------------------------------------------
   Foto profilo — upload, ridimensionamento, compressione
   --------------------------------------------------------- */
function handlePhotoFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Seleziona un file immagine valido.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 400, maxH = 500;
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const cv = getCurrentCv();
      cv.personal.foto = dataUrl;
      touchCurrentCv();
      persist(true);
      fillFormFromCv();
      renderPreview();
    };
    img.onerror = () => showToast('Impossibile leggere l\'immagine selezionata.', 'error');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  const cv = getCurrentCv();
  if (!cv) return;
  cv.personal.foto = '';
  touchCurrentCv();
  persist(true);
  fillFormFromCv();
  renderPreview();
}

/* ---------------------------------------------------------
   Sezioni ripetibili — rendering elenco + modale generico
   --------------------------------------------------------- */
function renderAllLists() {
  Object.keys(SECTION_CONFIG).forEach(renderList);
}

function renderList(sectionKey) {
  const config = SECTION_CONFIG[sectionKey];
  const cv = getCurrentCv();
  const ul = document.getElementById('list-' + sectionKey);
  const emptyMsg = document.getElementById('empty-' + sectionKey);
  ul.innerHTML = '';
  const items = cv ? cv[config.listKey] : [];
  emptyMsg.style.display = items.length ? 'none' : 'block';

  items.forEach((item) => {
    const info = config.render(item);
    const li = document.createElement('li');
    li.className = 'item-card';
    li.dataset.id = item.id;
    li.innerHTML = `
      <span class="drag-handle" title="Trascina per riordinare">⠿</span>
      <div class="item-body">
        <div class="item-title">${info.title}</div>
        ${info.sub ? `<div class="item-sub">${info.sub}${info.dates ? ' · ' + escapeHtml(info.dates) : ''}</div>` : (info.dates ? `<div class="item-sub">${escapeHtml(info.dates)}</div>` : '')}
        ${info.desc ? `<div class="item-desc">${escapeHtml(truncate(info.desc, 140))}</div>` : ''}
      </div>
      <div class="item-actions">
        <button type="button" class="edit-btn" data-action="edit">Modifica</button>
        <button type="button" class="dup-btn" data-action="duplicate">Duplica</button>
        <button type="button" class="del-btn" data-action="delete">Elimina</button>
      </div>`;
    ul.appendChild(li);
  });

  if (sortableInstances[sectionKey]) sortableInstances[sectionKey].destroy();
  sortableInstances[sectionKey] = Sortable.create(ul, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: () => {
      const newOrderIds = Array.from(ul.children).map((li) => li.dataset.id);
      const cv2 = getCurrentCv();
      const list = cv2[config.listKey];
      const reordered = newOrderIds.map((id) => list.find((it) => it.id === id));
      cv2[config.listKey] = reordered;
      touchCurrentCv();
      persist(true);
      renderPreview();
    },
  });
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function openModal(sectionKey, itemId) {
  const config = SECTION_CONFIG[sectionKey];
  modalContext = { sectionKey, itemId: itemId || null };
  const cv = getCurrentCv();
  const item = itemId ? cv[config.listKey].find((i) => i.id === itemId) : {};

  document.getElementById('modal-title').textContent = itemId ? `Modifica ${config.label}` : `Aggiungi ${config.label}`;
  const form = document.getElementById('modal-form');
  form.innerHTML = '';

  config.fields.forEach((f) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'field' + (f.full ? ' full' : '');
    const inputId = 'm-' + f.key;

    if (f.type === 'checkbox') {
      wrapper.innerHTML = `
        <label for="${inputId}">&nbsp;</label>
        <div class="checkbox-row">
          <input type="checkbox" id="${inputId}" ${item[f.key] ? 'checked' : ''}>
          <label for="${inputId}" style="font-weight:400;">${escapeHtml(f.label)}</label>
        </div>`;
    } else if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${escapeHtml(o)}" ${item[f.key] === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
      wrapper.innerHTML = `<label for="${inputId}">${escapeHtml(f.label)}</label><select id="${inputId}"><option value="">—</option>${opts}</select>`;
    } else if (f.type === 'textarea') {
      wrapper.innerHTML = `<label for="${inputId}">${escapeHtml(f.label)}</label><textarea id="${inputId}" maxlength="2000">${escapeHtml(item[f.key] || '')}</textarea>`;
    } else {
      wrapper.innerHTML = `<label for="${inputId}">${escapeHtml(f.label)}</label><input type="${f.type}" id="${inputId}" maxlength="200" value="${escapeHtml(item[f.key] || '')}">`;
    }
    const errSpan = document.createElement('span');
    errSpan.className = 'error-msg';
    errSpan.dataset.for = inputId;
    if (f.type !== 'checkbox') wrapper.appendChild(errSpan);
    form.appendChild(wrapper);
  });

  document.getElementById('modal-overlay').hidden = false;

  // "attualmente in corso" -> disabilita data fine per esperienze
  if (sectionKey === 'esperienze') {
    const correnteEl = document.getElementById('m-corrente');
    const fineEl = document.getElementById('m-dataFine');
    const syncFine = () => { fineEl.disabled = correnteEl.checked; if (correnteEl.checked) fineEl.value = ''; };
    correnteEl.addEventListener('change', syncFine);
    syncFine();
  }
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  modalContext = null;
}

function saveModalForm(e) {
  e.preventDefault();
  if (!modalContext) return;
  const { sectionKey, itemId } = modalContext;
  const config = SECTION_CONFIG[sectionKey];
  const cv = getCurrentCv();
  let valid = true;
  const values = {};

  config.fields.forEach((f) => {
    const el = document.getElementById('m-' + f.key);
    let value;
    if (f.type === 'checkbox') value = el.checked;
    else value = sanitizePlainText(el.value.trim());
    values[f.key] = value;

    if (f.required && f.type !== 'checkbox' && !value) {
      setFieldError('m-' + f.key, 'Campo obbligatorio.');
      valid = false;
    } else {
      setFieldError('m-' + f.key, '');
    }
  });

  // Validazione coerenza date (inizio <= fine) quando entrambe presenti
  if (values.dataInizio && values.dataFine && values.dataInizio > values.dataFine) {
    setFieldError('m-dataFine', 'La data fine non può precedere la data inizio.');
    valid = false;
  }

  if (!valid) return;

  const list = cv[config.listKey];
  if (itemId) {
    const idx = list.findIndex((i) => i.id === itemId);
    list[idx] = Object.assign({}, list[idx], values);
  } else {
    list.push(Object.assign({ id: uuid() }, values));
  }
  touchCurrentCv();
  persist(true);
  renderList(sectionKey);
  renderPreview();
  renderCvSelect();
  closeModal();
}

function handleListAction(sectionKey, itemId, action) {
  const config = SECTION_CONFIG[sectionKey];
  const cv = getCurrentCv();
  const list = cv[config.listKey];
  if (action === 'edit') {
    openModal(sectionKey, itemId);
  } else if (action === 'duplicate') {
    const item = list.find((i) => i.id === itemId);
    const copy = Object.assign({}, item, { id: uuid() });
    list.push(copy);
    touchCurrentCv();
    persist(true);
    renderList(sectionKey);
    renderPreview();
  } else if (action === 'delete') {
    if (!confirm('Eliminare questa voce?')) return;
    cv[config.listKey] = list.filter((i) => i.id !== itemId);
    touchCurrentCv();
    persist(true);
    renderList(sectionKey);
    renderPreview();
  }
}

/* ---------------------------------------------------------
   Firma grafica
   --------------------------------------------------------- */
let sigCtx, sigDrawing = false, sigHasContent = false;

function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  sigCtx = canvas.getContext('2d');
  sigCtx.lineWidth = 2.2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = '#1c2b3a';

  const getPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  };

  const start = (evt) => { evt.preventDefault(); sigDrawing = true; const p = getPos(evt); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  const move = (evt) => {
    if (!sigDrawing) return;
    evt.preventDefault();
    const p = getPos(evt);
    sigCtx.lineTo(p.x, p.y);
    sigCtx.stroke();
    sigHasContent = true;
  };
  const end = () => {
    if (!sigDrawing) return;
    sigDrawing = false;
    saveSignature();
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
}

function saveSignature() {
  const cv = getCurrentCv();
  if (!cv) return;
  const canvas = document.getElementById('signature-pad');
  cv.firma = sigHasContent ? canvas.toDataURL('image/png') : '';
  touchCurrentCv();
  persist(true);
  renderPreview();
}

function clearSignature() {
  const canvas = document.getElementById('signature-pad');
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  sigHasContent = false;
  const cv = getCurrentCv();
  if (cv) { cv.firma = ''; touchCurrentCv(); persist(true); renderPreview(); }
}

function redrawSignatureFromData() {
  const canvas = document.getElementById('signature-pad');
  if (!sigCtx) return;
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  sigHasContent = false;
  const cv = getCurrentCv();
  if (cv && cv.firma) {
    const img = new Image();
    img.onload = () => { sigCtx.drawImage(img, 0, 0, canvas.width, canvas.height); sigHasContent = true; };
    img.src = cv.firma;
  }
}

/* ---------------------------------------------------------
   Anteprima in tempo reale (identica al PDF)
   --------------------------------------------------------- */
function renderPreview() {
  const cv = getCurrentCv();
  const container = document.getElementById('cv-preview');
  if (!cv) { container.innerHTML = '<p class="cv-empty-doc">Nessun curriculum selezionato.</p>'; return; }

  const p = cv.personal;
  const fullName = `${p.nome || ''}`.trim();
  const initials = ((p.nome || ' ')[0]).toUpperCase().trim();

  let html = '';
  html += `<div class="cv-header">`;
  if (p.foto) {
    html += `<img class="cv-photo" src="${p.foto}" alt="Foto profilo">`;
  } else {
    html += `<div class="cv-monogram">${escapeHtml(initials || '—')}</div>`;
  }
  html += `<div>
      <p class="cv-name">${escapeHtml(fullName || 'Nome')}</p>
      <p class="cv-title-doc">Curriculum Vitae di CipoCity</p>
      <div class="cv-contact-line">
        ${p.email ? `<span>${escapeHtml(p.email)}</span>` : ''}
        ${p.dataNascita ? `<span>Nato/a il ${escapeHtml(formatDate(p.dataNascita))}</span>` : ''}
        ${p.luogoNascita ? `<span>${escapeHtml(p.luogoNascita)}</span>` : ''}
        ${p.nazionalita ? `<span>${escapeHtml(p.nazionalita)}</span>` : ''}
        ${p.serialeCI ? `<span>CI n. ${escapeHtml(p.serialeCI)}</span>` : ''}
      </div>
    </div>`;
  html += `</div>`;

  html += renderTimelineSection('Istruzione e formazione', cv.istruzione, SECTION_CONFIG.istruzione);
  html += renderTimelineSection('Esperienze lavorative', cv.esperienze, SECTION_CONFIG.esperienze);
  html += renderLanguageSection(cv.lingue);
  html += renderTagSection('Competenze informatiche', cv.competenzeInformatiche, (i) => `${i.nome}${i.livello ? ' — ' + i.livello : ''}`);
  html += renderTagSection('Altre competenze', cv.altreCompetenze, (i) => `${i.nome}${i.categoria ? ' (' + i.categoria + ')' : ''}`);

  const hasAnyData = fullName || cv.istruzione.length || cv.esperienze.length || cv.lingue.length || cv.competenzeInformatiche.length || cv.altreCompetenze.length;
  if (!hasAnyData) {
    html = '<p class="cv-empty-doc">Compila i dati personali per iniziare a comporre il tuo Curriculum Vitae di CipoCity.</p>';
  }

  if (cv.firma) {
    const scale = cv.firmaScale || 1;
    html += `<div class="cv-signature-area"><img src="${cv.firma}" style="height:${46 * scale}px;" alt="Firma"></div>`;
  }

  container.innerHTML = html;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('it-IT');
}

function renderTimelineSection(title, items, config) {
  if (!items || !items.length) return '';
  let html = `<div class="cv-section"><p class="cv-section-title">${escapeHtml(title)}</p>`;
  items.forEach((item) => {
    const info = config.render(item);
    html += `<div class="cv-entry">
      <div class="cv-entry-head">
        <span class="cv-entry-title">${info.title}</span>
        <span class="cv-entry-dates">${escapeHtml(info.dates)}</span>
      </div>
      ${info.sub ? `<div class="cv-entry-sub">${info.sub}</div>` : ''}
      ${info.desc ? `<div class="cv-entry-desc">${escapeHtml(info.desc)}</div>` : ''}
      ${item.risultati ? `<div class="cv-entry-extra">Risultati: ${escapeHtml(item.risultati)}</div>` : ''}
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderLanguageSection(lingue) {
  if (!lingue || !lingue.length) return '';
  let html = `<div class="cv-section"><p class="cv-section-title">Lingue</p>
    <table class="cv-lang-table">
      <thead><tr><th>Lingua</th><th>Comprensione</th><th>Lettura</th><th>Scrittura</th><th>Conversazione</th><th>Produzione orale</th></tr></thead>
      <tbody>`;
  lingue.forEach((l) => {
    html += `<tr>
      <td>${escapeHtml(l.nome || '')}</td>
      <td>${escapeHtml(l.comprensione || '—')}</td>
      <td>${escapeHtml(l.lettura || '—')}</td>
      <td>${escapeHtml(l.scrittura || '—')}</td>
      <td>${escapeHtml(l.conversazione || '—')}</td>
      <td>${escapeHtml(l.produzioneOrale || '—')}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderTagSection(title, items, labelFn) {
  if (!items || !items.length) return '';
  let html = `<div class="cv-section"><p class="cv-section-title">${escapeHtml(title)}</p><div class="cv-skill-tags">`;
  items.forEach((item) => {
    html += `<span class="cv-skill-tag">${escapeHtml(labelFn(item))}</span>`;
  });
  html += `</div></div>`;
  return html;
}

/* ---------------------------------------------------------
   Generazione PDF
   --------------------------------------------------------- */
function generatePdf() {
  if (!validateAllPersonal()) {
    switchTab('personali');
    showToast('Completa i campi obbligatori nei Dati personali prima di generare il PDF.', 'error');
    return;
  }
  const cv = getCurrentCv();
  const source = document.getElementById('cv-preview');

  // Cloniamo il nodo per generare il PDF sempre in formato "desktop" (A4 pieno),
  // indipendentemente dalla modalità di anteprima attualmente selezionata.
  const clone = source.cloneNode(true);
  clone.style.width = '210mm';
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  showToast('Generazione PDF in corso…');

  const fileName = `Curriculum Vitae di CipoCity - ${(cv.personal.nome || '')} ${(cv.personal.nome || '')}`.trim().replace(/\s+/g, ' ') + '.pdf';
  const dateStr = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const opt = {
    margin: 0,
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.cv-entry', '.cv-section-title', '.cv-header'] },
  };

  html2pdf().set(opt).from(clone).toPdf().get('pdf').then((pdf) => {
    const pageCount = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Curriculum Vitae di CipoCity — Generato il ${dateStr}`, 10, pageHeight - 7);
      pdf.text(`Pagina ${i} di ${pageCount}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
      if (cv.firma) {
        try {
          const scale = cv.firmaScale || 1;
          const h = 12 * scale, w = 32 * scale;
          pdf.addImage(cv.firma, 'PNG', pageWidth - 10 - w, pageHeight - 26, w, h);
        } catch (e) { /* firma non disponibile per questa pagina, non bloccante */ }
      }
    }
  }).save().then(() => {
    document.body.removeChild(wrapper);
    showToast('PDF generato con successo.', 'success');
  }).catch((err) => {
    console.error(err);
    document.body.removeChild(wrapper);
    showToast('Si è verificato un errore nella generazione del PDF.', 'error');
  });
}

/* ---------------------------------------------------------
   Navigazione tab ed eventi generali
   --------------------------------------------------------- */
function switchTab(tabKey) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabKey));
  document.querySelectorAll('.tab-content').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + tabKey));
}

function bindGlobalEvents() {
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  document.getElementById('cv-select').addEventListener('change', (e) => selectCv(e.target.value));
  document.getElementById('btn-new-cv').addEventListener('click', newCv);
  document.getElementById('btn-duplicate-cv').addEventListener('click', duplicateCv);
  document.getElementById('btn-delete-cv').addEventListener('click', deleteCv);
  document.getElementById('btn-export').addEventListener('click', exportCv);
  document.getElementById('btn-generate-pdf').addEventListener('click', generatePdf);

  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file-input').click());
  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importCvFromFile(file);
    e.target.value = '';
  });

  document.getElementById('btn-photo-upload').addEventListener('click', () => document.getElementById('photo-input').click());
  document.getElementById('photo-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePhotoFile(file);
    e.target.value = '';
  });
  document.getElementById('btn-photo-remove').addEventListener('click', removePhoto);

  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.add, null));
  });

  document.querySelectorAll('.item-list').forEach((ul) => {
    ul.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const li = e.target.closest('.item-card');
      handleListAction(ul.dataset.section, li.dataset.id, actionBtn.dataset.action);
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('modal-form').addEventListener('submit', saveModalForm);

  document.getElementById('btn-signature-clear').addEventListener('click', clearSignature);
  document.getElementById('signature-scale').addEventListener('input', (e) => {
    const cv = getCurrentCv();
    if (!cv) return;
    cv.firmaScale = parseFloat(e.target.value);
    touchCurrentCv();
    persist(true);
    renderPreview();
  });

  document.querySelectorAll('.view-toggle .toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle .toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('preview-scroll').classList.toggle('mobile', btn.dataset.view === 'mobile');
    });
  });

  window.addEventListener('beforeunload', () => { /* autosave già gestito su ogni modifica */ });
}

/* ---------------------------------------------------------
   Bootstrap
   --------------------------------------------------------- */
function init() {
  loadFromStorage();
  bindGlobalEvents();
  bindPersonalFieldEvents();
  initSignaturePad();
  renderCvSelect();
  fillFormFromCv();
  renderAllLists();
  renderPreview();
}

document.addEventListener('DOMContentLoaded', init);
