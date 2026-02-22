/**
 * MedScribe - Voice recording + Patient-friendly summary
 * Integrated with Clinical Assistance AI backend
 */
class MedScribeRecorder {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.transcription = '';
    this.finalTranscript = '';
    this.shouldAutoRestart = false;
    this.lastSummary = '';
    this.lastMedications = [];

    this.recordButton = document.getElementById('recordButton');
    this.stopButton = document.getElementById('stopButton');
    this.generateSummaryButton = document.getElementById('generateSummaryButton');
    this.downloadReportButton = document.getElementById('downloadReportButton');
    this.statusText = document.getElementById('statusText');
    this.transcriptionBox = document.getElementById('transcription');
    this.summaryBox = document.getElementById('summary');
    this.reportsContainer = document.getElementById('reportsContainer');
    this.reportCountEl = document.getElementById('reportCount');
    this.pharmacySection = document.getElementById('pharmacyFinderSection');
    this.medicationsList = document.getElementById('medicationsList');
    this.findPharmaciesBtn = document.getElementById('findPharmaciesBtn');
    this.pharmacyStatus = document.getElementById('pharmacyStatus');
    this.pharmacyResults = document.getElementById('pharmacyResults');

    if (this.recordButton) {
      this.initializeSpeechRecognition();
      this.attachEventListeners();
      if (this.findPharmaciesBtn) {
        this.findPharmaciesBtn.addEventListener('click', (e) => { e.preventDefault(); this.findNearbyPharmacies(); });
      }
    }
    this.setupTabs();
    this.syncReportsToTab();
    this.setupSchedule();
    this.setupUploads();
    this.setupTheme();
    this.setupProfile();
    this.setupPreferences();
    this.setupChecklist();
    this.updateProfileStats();
    this.setupProfileLinks();
  }

  setupTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem('medscribe_theme') || 'light';
    root.setAttribute('data-theme', saved);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem('medscribe_theme', next);
        const cb = document.getElementById('profileNightMode');
        if (cb) cb.checked = next === 'dark';
      });
    }
  }

  setupProfile() {
    const profile = JSON.parse(localStorage.getItem('medscribe_profile') || '{}');
    const nameInput = document.getElementById('profileNameInput');
    const initialsInput = document.getElementById('profileInitialsInput');
    const emailInput = document.getElementById('profileEmailInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const emergencyInput = document.getElementById('profileEmergencyInput');
    if (nameInput) nameInput.value = profile.name || '';
    if (initialsInput) initialsInput.value = profile.initials || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (phoneInput) phoneInput.value = profile.phone || '';
    if (emergencyInput) emergencyInput.value = profile.emergency || '';
    this.applyProfile();
    const form = document.getElementById('profileForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          name: nameInput?.value?.trim() || 'Patient',
          initials: (initialsInput?.value?.trim() || 'MC').slice(0, 4).toUpperCase(),
          email: emailInput?.value?.trim() || '',
          phone: phoneInput?.value?.trim() || '',
          emergency: emergencyInput?.value?.trim() || ''
        };
        localStorage.setItem('medscribe_profile', JSON.stringify(data));
        this.applyProfile();
        alert('Profile saved.');
      });
    }
  }

  applyProfile() {
    const profile = JSON.parse(localStorage.getItem('medscribe_profile') || '{}');
    const name = profile.name || 'Maria';
    const initials = (profile.initials || 'MC').slice(0, 4).toUpperCase();
    const greeting = document.querySelector('.greeting-name');
    if (greeting) greeting.textContent = 'Hi, ' + name + ' \u{1F44B}';
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = name;
    const profileAvatar = document.getElementById('profileAvatar');
    const headerAvatar = document.getElementById('headerAvatar');
    if (profileAvatar) profileAvatar.textContent = initials || '?';
    if (headerAvatar) headerAvatar.textContent = initials || '?';
  }

  setupPreferences() {
    const root = document.documentElement;
    const theme = localStorage.getItem('medscribe_theme') || 'light';
    const font = localStorage.getItem('medscribe_font') || 'default';
    const motion = localStorage.getItem('medscribe_motion') || 'default';
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-font', font === 'large' ? 'large' : 'default');
    root.setAttribute('data-motion', motion === 'reduced' ? 'reduced' : 'default');
    const nightCheck = document.getElementById('profileNightMode');
    const fontCheck = document.getElementById('profileLargeFont');
    const motionCheck = document.getElementById('profileReducedMotion');
    if (nightCheck) {
      nightCheck.checked = theme === 'dark';
      nightCheck.addEventListener('change', () => {
        const next = nightCheck.checked ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        localStorage.setItem('medscribe_theme', next);
      });
    }
    if (fontCheck) {
      fontCheck.checked = font === 'large';
      fontCheck.addEventListener('change', () => {
        const next = fontCheck.checked ? 'large' : 'default';
        root.setAttribute('data-font', next);
        localStorage.setItem('medscribe_font', next);
      });
    }
    if (motionCheck) {
      motionCheck.checked = motion === 'reduced';
      motionCheck.addEventListener('change', () => {
        const next = motionCheck.checked ? 'reduced' : 'default';
        root.setAttribute('data-motion', next);
        localStorage.setItem('medscribe_motion', next);
      });
    }
  }

  setupChecklist() {
    const form = document.getElementById('checklistForm');
    const ids = [
      'checklistReason', 'checklistSymptoms', 'checklistConditions', 'checklistMeds', 'checklistAllergies',
      'checklistMother', 'checklistFather', 'checklistSiblings', 'checklistChildren', 'checklistMaternalGP', 'checklistPaternalGP', 'checklistOtherFamily',
      'checklistFamHeart', 'checklistFamDiabetes', 'checklistFamCancer', 'checklistFamStroke', 'checklistFamHighBP', 'checklistFamMental', 'checklistFamAsthma', 'checklistFamOther',
      'checklistFamilyOther', 'checklistQuestions', 'checklistProviders', 'checklistSupport',
      'checklistId', 'checklistInsurance', 'checklistCopay'
    ];
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {};
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          data[id] = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
        });
        localStorage.setItem('medscribe_checklist', JSON.stringify(data));
        this.generateDoctorSummary(data);
        document.getElementById('doctorSummarySection').style.display = 'block';
        document.getElementById('doctorSummarySection').scrollIntoView({ behavior: 'smooth' });
      });
    }
    document.getElementById('sendToDoctorBtn')?.addEventListener('click', () => this.sendToDoctor());
    document.getElementById('downloadSummaryBtn')?.addEventListener('click', () => this.downloadDoctorSummary());
    document.getElementById('printSummaryBtn')?.addEventListener('click', () => window.print());
    this.loadChecklistForm();
  }

  loadChecklistForm() {
    const data = JSON.parse(localStorage.getItem('medscribe_checklist') || '{}');
    const ids = [
      'checklistReason', 'checklistSymptoms', 'checklistConditions', 'checklistMeds', 'checklistAllergies',
      'checklistMother', 'checklistFather', 'checklistSiblings', 'checklistChildren', 'checklistMaternalGP', 'checklistPaternalGP', 'checklistOtherFamily',
      'checklistFamHeart', 'checklistFamDiabetes', 'checklistFamCancer', 'checklistFamStroke', 'checklistFamHighBP', 'checklistFamMental', 'checklistFamAsthma', 'checklistFamOther',
      'checklistFamilyOther', 'checklistQuestions', 'checklistProviders', 'checklistSupport',
      'checklistId', 'checklistInsurance', 'checklistCopay'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const v = data[id];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (v !== undefined) el.value = v;
    });
    const sec = document.getElementById('doctorSummarySection');
    if (sec && Object.keys(data).some(k => data[k] && data[k] !== '' && data[k] !== false)) {
      this.generateDoctorSummary(data);
      sec.style.display = 'block';
    }
  }

  generateDoctorSummary(data) {
    const profile = JSON.parse(localStorage.getItem('medscribe_profile') || '{}');
    const name = profile.name || 'Patient';
    const parts = [];
    const add = (title, content) => { if (content) parts.push({ title, content }); };
    add('Chief complaint', data.checklistReason);
    add('Symptoms', data.checklistSymptoms);
    add('Chronic conditions', data.checklistConditions);
    add('Medications', data.checklistMeds);
    add('Allergies', data.checklistAllergies);
    const familyParts = [];
    if (data.checklistMother) familyParts.push('Mother: ' + data.checklistMother);
    if (data.checklistFather) familyParts.push('Father: ' + data.checklistFather);
    if (data.checklistSiblings) familyParts.push('Siblings: ' + data.checklistSiblings);
    if (data.checklistChildren) familyParts.push('Children: ' + data.checklistChildren);
    if (data.checklistMaternalGP) familyParts.push('Maternal grandparents: ' + data.checklistMaternalGP);
    if (data.checklistPaternalGP) familyParts.push('Paternal grandparents: ' + data.checklistPaternalGP);
    if (data.checklistOtherFamily) familyParts.push('Other family: ' + data.checklistOtherFamily);
    const famConditions = [];
    if (data.checklistFamHeart) famConditions.push('Heart disease');
    if (data.checklistFamDiabetes) famConditions.push('Diabetes');
    if (data.checklistFamCancer) famConditions.push('Cancer');
    if (data.checklistFamStroke) famConditions.push('Stroke');
    if (data.checklistFamHighBP) famConditions.push('High blood pressure');
    if (data.checklistFamMental) famConditions.push('Depression/anxiety');
    if (data.checklistFamAsthma) famConditions.push('Asthma/allergies');
    if (data.checklistFamOther && data.checklistFamilyOther) famConditions.push(data.checklistFamilyOther);
    if (famConditions.length) familyParts.push('Conditions in family: ' + famConditions.join(', '));
    if (familyParts.length) add('Family medical history', familyParts.join('\n'));
    add('Questions for doctor', data.checklistQuestions);
    add('Other providers', data.checklistProviders);
    add('Support person', data.checklistSupport);
    const admin = [];
    if (data.checklistId) admin.push('Photo ID ready');
    if (data.checklistInsurance) admin.push('Insurance updated');
    if (data.checklistCopay) admin.push('Copay ready');
    if (admin.length) add('Administrative', admin.join(' · '));
    if (parts.length === 0) {
      document.getElementById('doctorSummary').innerHTML = '<p class="pharmacy-no-meds">Complete the form above and click Save &amp; Generate Doctor Summary.</p>';
      return;
    }
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    let html = '<div class="ds-header" style="margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--primary);"><strong>' + (name.replace(/</g,'&lt;')) + '</strong> · Pre-visit summary · ' + dateStr + '</div>';
    parts.forEach(p => {
      const c = String(p.content).replace(/\n/g, '<br>').replace(/</g, '&lt;');
      html += '<div class="ds-section"><div class="ds-title">' + p.title + '</div><div class="ds-content">' + c + '</div></div>';
    });
    document.getElementById('doctorSummary').innerHTML = html;
  }

  sendToDoctor() {
    const box = document.getElementById('doctorSummary');
    if (!box) return;
    const text = box.innerText || '';
    if (!text.trim()) {
      alert('Generate a summary first by completing the form and clicking Save.');
      return;
    }
    const profile = JSON.parse(localStorage.getItem('medscribe_profile') || '{}');
    const name = profile.name || 'Patient';
    const subject = encodeURIComponent('Pre-Visit Summary – ' + name + ' – ' + new Date().toLocaleDateString());
    const body = encodeURIComponent(
      'Please find my pre-visit summary below:\n\n' +
      '—\n\n' + text + '\n\n—\n\nSent from MedScribe Patient Portal'
    );
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
  }

  downloadDoctorSummary() {
    const box = document.getElementById('doctorSummary');
    if (!box) return;
    const text = box.innerText || '';
    const name = (JSON.parse(localStorage.getItem('medscribe_profile') || '{}').name || 'Patient').replace(/[^a-zA-Z0-9]/g, '-');
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'PreVisit-Summary-' + name + '-' + date + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  syncPreferenceCheckboxes() {
    const t = localStorage.getItem('medscribe_theme') || 'light';
    const f = localStorage.getItem('medscribe_font') || 'default';
    const m = localStorage.getItem('medscribe_motion') || 'default';
    const nightCheck = document.getElementById('profileNightMode');
    const fontCheck = document.getElementById('profileLargeFont');
    const motionCheck = document.getElementById('profileReducedMotion');
    if (nightCheck) nightCheck.checked = t === 'dark';
    if (fontCheck) fontCheck.checked = f === 'large';
    if (motionCheck) motionCheck.checked = m === 'reduced';
  }

  setupTabs() {
    const bnavItems = document.querySelectorAll('.bottom-nav .bnav-item[data-tab]');
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');
    const switchTo = (tabId, source) => {
      bnavItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabId));
      navLinks.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tabId));
      panels.forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');
      if (tabId === 'tabRx') this.setupRxTab();
      if (tabId === 'tabSchedule') this.renderScheduleList();
      if (tabId === 'tabChecklist') this.loadChecklistForm();
      if (tabId === 'tabDocuments') this.renderUploadList();
      if (tabId === 'tabProfile') {
        this.updateProfileStats();
        this.syncPreferenceCheckboxes();
      }
    };
    bnavItems.forEach(item => {
      item.addEventListener('click', (e) => { e.preventDefault(); switchTo(item.getAttribute('data-tab'), item); });
    });
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => { e.preventDefault(); switchTo(link.getAttribute('data-tab'), link); });
    });
  }

  setupUploads() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('uploadInput');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); this.handleFiles(e.dataTransfer?.files); });
    input.addEventListener('change', (e) => { this.handleFiles(e.target.files); e.target.value = ''; });
    this.renderUploadList();
  }

  handleFiles(files) {
    if (!files?.length) return;
    const MAX_SIZE = 2 * 1024 * 1024;
    const STORE_THRESHOLD = 400 * 1024;
    let uploads = JSON.parse(localStorage.getItem('medscribe_uploads') || '[]');
    const processOne = (f) => {
      if (f.size > MAX_SIZE) { alert(f.name + ' exceeds 2MB'); return; }
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      if (f.size < STORE_THRESHOLD) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const data = ev.target?.result;
          const item = { id, name: f.name, type: f.type, size: f.size, date: new Date().toISOString(), data };
          uploads = JSON.parse(localStorage.getItem('medscribe_uploads') || '[]');
          uploads.push(item);
          try {
            localStorage.setItem('medscribe_uploads', JSON.stringify(uploads));
            this.renderUploadList();
            this.updateProfileStats();
          } catch (err) { alert('Storage full. Try smaller files.'); }
        };
        reader.readAsDataURL(f);
      } else {
        uploads.push({ id, name: f.name, type: f.type, size: f.size, date: new Date().toISOString() });
        try {
          localStorage.setItem('medscribe_uploads', JSON.stringify(uploads));
          this.renderUploadList();
          this.updateProfileStats();
        } catch (err) { alert('Storage full.'); }
      }
    };
    for (let i = 0; i < files.length; i++) processOne(files[i]);
  }

  renderUploadList() {
    const list = document.getElementById('uploadList');
    if (!list) return;
    const uploads = JSON.parse(localStorage.getItem('medscribe_uploads') || '[]');
    if (!uploads.length) { list.innerHTML = '<p class="pharmacy-no-meds">No documents uploaded yet.</p>'; return; }
    list.innerHTML = uploads.map(u => {
      const d = new Date(u.date);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const sizeStr = u.size < 1024 ? u.size + ' B' : (u.size / 1024).toFixed(1) + ' KB';
      const hasData = !!u.data;
      const id = String(u.id).replace(/"/g, '&quot;');
      const downloadBtn = hasData ? `<button type="button" class="rpt-btn outline" style="padding:6px 12px;font-size:0.75rem;" data-download-id="${id}">Download</button>` : '';
      return `<div class="upload-item"><div class="upload-item-info"><div class="upload-item-name">${(u.name||'').replace(/</g,'&lt;')}</div><div class="upload-item-meta">${dateStr} · ${sizeStr}${hasData?'':' (metadata only)'}</div></div><div class="upload-item-actions">${downloadBtn}<button type="button" class="schedule-card-delete" data-remove-id="${id}">Remove</button></div></div>`;
    }).join('');
    list.querySelectorAll('[data-download-id]').forEach(btn => btn.onclick = () => this.downloadUpload(btn.getAttribute('data-download-id')));
    list.querySelectorAll('[data-remove-id]').forEach(btn => btn.onclick = () => this.removeUpload(btn.getAttribute('data-remove-id')));
  }

  downloadUpload(id) {
    const uploads = JSON.parse(localStorage.getItem('medscribe_uploads') || '[]');
    const u = uploads.find(x => String(x.id) === String(id));
    if (!u?.data) return;
    const a = document.createElement('a');
    a.href = u.data;
    a.download = u.name || 'document';
    a.click();
  }

  removeUpload(id) {
    let uploads = JSON.parse(localStorage.getItem('medscribe_uploads') || '[]');
    uploads = uploads.filter(x => String(x.id) !== String(id));
    localStorage.setItem('medscribe_uploads', JSON.stringify(uploads));
    this.renderUploadList();
    this.updateProfileStats();
  }

  setupProfileLinks() {
    document.querySelectorAll('.profile-link[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tabId = el.getAttribute('data-tab');
        const navItem = document.querySelector(`.bnav-item[data-tab="${tabId}"]`);
        if (navItem) navItem.click();
      });
    });
  }

  updateProfileStats() {
    const reportEl = document.getElementById('profileReportCount');
    const docEl = document.getElementById('profileDocCount');
    const scheduleEl = document.getElementById('profileScheduleCount');
    if (reportEl) reportEl.textContent = document.querySelectorAll('#reportsContainer .report-card').length || 0;
    if (docEl) docEl.textContent = (JSON.parse(localStorage.getItem('medscribe_uploads') || '[]')).length || 0;
    if (scheduleEl) {
      const schedules = JSON.parse(localStorage.getItem('medscribe_schedules') || '[]');
      const now = new Date();
      scheduleEl.textContent = schedules.filter(s => new Date(s.date + 'T' + s.time) >= now).length || 0;
    }
  }

  setupSchedule() {
    const form = document.getElementById('scheduleForm');
    const list = document.getElementById('scheduleList');
    if (!form || !list) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('scheduleDate')?.value;
      const time = document.getElementById('scheduleTime')?.value;
      const type = document.getElementById('scheduleType')?.value || 'General';
      const notes = document.getElementById('scheduleNotes')?.value || '';
      if (!date || !time) return;
      const schedules = JSON.parse(localStorage.getItem('medscribe_schedules') || '[]');
      schedules.push({ id: Date.now(), date, time, type, notes });
      schedules.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
      localStorage.setItem('medscribe_schedules', JSON.stringify(schedules));
      form.reset();
      this.renderScheduleList();
    });
    this.renderScheduleList();
  }

  renderScheduleList() {
    const list = document.getElementById('scheduleList');
    if (!list) return;
    const schedules = JSON.parse(localStorage.getItem('medscribe_schedules') || '[]');
    const now = new Date();
    const upcoming = schedules.filter(s => new Date(s.date + 'T' + s.time) >= now);
    if (upcoming.length === 0) {
      list.innerHTML = '<p class="pharmacy-no-meds">No upcoming checkups scheduled.</p>';
      return;
    }
    list.innerHTML = upcoming.map(s => {
      const d = new Date(s.date + 'T' + s.time);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `<div class="schedule-card" data-id="${s.id}">
        <div class="schedule-card-info">
          <div class="schedule-card-title">${(s.type || 'Checkup').replace(/</g,'&lt;')}</div>
          <div class="schedule-card-meta">${dateStr} at ${timeStr}${s.notes ? ' · ' + (s.notes.replace(/</g,'&lt;')) : ''}</div>
        </div>
        <button type="button" class="schedule-card-delete" onclick="window.medScribe?.removeSchedule(${s.id})">Remove</button>
      </div>`;
    }).join('');
  }

  removeSchedule(id) {
    let schedules = JSON.parse(localStorage.getItem('medscribe_schedules') || '[]');
    schedules = schedules.filter(s => s.id !== id);
    localStorage.setItem('medscribe_schedules', JSON.stringify(schedules));
    this.renderScheduleList();
  }

  syncReportsToTab() {
    const source = document.getElementById('reportsContainer');
    const target = document.getElementById('reportsContainerTab');
    if (source && target) target.innerHTML = source.innerHTML;
  }

  setupRxTab() {
    const btn = document.getElementById('findPharmaciesBtnRx');
    const medsList = document.getElementById('rxMedicationsList');
    const status = document.getElementById('pharmacyStatusRx');
    const results = document.getElementById('pharmacyResultsRx');
    if (medsList && this.lastMedications?.length) {
      const links = this.lastMedications.map(m => ({ name: m, goodrx_url: `https://www.goodrx.com/search?q=${encodeURIComponent((m.split(' ')[0] || m))}` }));
      medsList.innerHTML = links.map(l => `<span class="med-badge"><span>${(l.name || '').replace(/</g,'&lt;')}</span> · <a href="${l.goodrx_url}" target="_blank" rel="noopener">Check prices</a></span>`).join('');
    } else if (medsList) {
      medsList.innerHTML = '<p class="pharmacy-no-meds">Record a visit and generate a summary to see medications here, or use Find Nearby Pharmacies.</p>';
    }
    if (btn) btn.onclick = (e) => { e.preventDefault(); this.findNearbyPharmaciesRx(); };
  }

  async findNearbyPharmaciesRx() {
    const status = document.getElementById('pharmacyStatusRx');
    const results = document.getElementById('pharmacyResultsRx');
    const btn = document.getElementById('findPharmaciesBtnRx');
    if (!btn || !results || !status) return;
    btn.disabled = true;
    status.textContent = 'Getting your location...';
    let lat, lon;
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error('Geolocation not supported'));
        else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch (err) {
      status.textContent = 'Location denied or unavailable.';
      btn.disabled = false;
      return;
    }
    status.textContent = 'Finding pharmacies...';
    const meds = this.lastMedications || [];
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: 20000 });
    if (meds.length) params.set('medications', meds.join(','));
    const apiUrl = (window.location.origin || '') + '/api/pharmacy-finder?' + params.toString();
    try {
      const res = await fetch(apiUrl);
      let data = {};
      try { data = await res.json(); } catch (_) { data = {}; }
      if (!res.ok) {
        status.textContent = data.error || 'Could not fetch pharmacies.';
        results.innerHTML = '<p class="pharmacy-no-meds">' + (data.error || 'Error').replace(/</g, '&lt;') + '</p>';
      } else {
        const count = data.pharmacies?.length || 0;
        status.textContent = count > 0 ? `Found ${count} pharmacies within ${data.radius_km || 20} km` : (data.error || 'No pharmacies found.');
        if (!data.pharmacies?.length) {
          results.innerHTML = '<p class="pharmacy-no-meds">' + (data.error || 'No pharmacies found nearby. Try again.').replace(/</g, '&lt;') + '</p>';
        } else {
          const medLinks = data.medication_price_links || [];
          const medLine = medLinks.length ? medLinks.map(l => `<a href="${l.goodrx_url}" target="_blank" rel="noopener">${l.name}</a>`).join(' · ') : '';
          results.innerHTML = data.pharmacies.map(p => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat + ',' + p.lon)}`;
            const medBlock = medLine ? `<div class="pharmacy-card-meds"><strong>Check prices:</strong> ${medLine}<div class="pharmacy-note">Call pharmacy to confirm medication is in stock.</div></div>` : '';
            return `<div class="pharmacy-card"><div class="pharmacy-card-name">${(p.name||'').replace(/</g,'&lt;')}</div><div class="pharmacy-card-addr">${(p.address||'Address not available').replace(/</g,'&lt;')}</div><div class="pharmacy-card-dist">${p.distance_km} km away</div>${medBlock}<div class="pharmacy-card-map"><a href="${mapUrl}" target="_blank" rel="noopener">Open in Google Maps</a></div></div>`;
          }).join('');
        }
      }
    } catch (err) {
      status.textContent = 'Error: ' + (err.message || 'Network error');
      results.innerHTML = '<p class="pharmacy-no-meds">' + (err.message || 'Network error. Is the server running?').replace(/</g, '&lt;') + '</p>';
    }
    btn.disabled = false;
  }

  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.statusText.textContent = 'Voice not supported. Use Chrome or Edge.';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.statusText.textContent = 'Recording...';
      this.statusText.classList.add('recording');
      this.recordButton.disabled = true;
      this.stopButton.disabled = false;
      this.generateSummaryButton.disabled = true;
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      this.finalTranscript += final;
      this.transcription = this.finalTranscript + interim;
      this.updateTranscription();
    };

    this.recognition.onerror = (event) => {
      this.isRecording = false;
      this.statusText.textContent = 'Error: ' + event.error;
      this.statusText.classList.remove('recording');
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        alert('Voice error: ' + event.error);
      }
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      if (this.shouldAutoRestart) {
        setTimeout(() => {
          if (this.shouldAutoRestart && !this.isRecording) {
            try { this.recognition.start(); } catch (e) { this.shouldAutoRestart = false; }
          }
        }, 100);
      } else {
        this.statusText.textContent = this.finalTranscript.trim() ? 'Stopped' : 'Ready';
        this.statusText.classList.remove('recording');
        this.recordButton.disabled = false;
        this.stopButton.disabled = true;
        this.generateSummaryButton.disabled = !this.finalTranscript.trim();
        if (this.finalTranscript.trim()) this.generateSummary();
      }
    };
  }

  attachEventListeners() {
    this.recordButton.addEventListener('click', (e) => { e.preventDefault(); this.startRecording(); });
    this.stopButton.addEventListener('click', (e) => { e.preventDefault(); this.stopRecording(); });
    this.generateSummaryButton.addEventListener('click', (e) => { e.preventDefault(); this.generateSummary(); });
    if (this.downloadReportButton) {
      this.downloadReportButton.addEventListener('click', (e) => { e.preventDefault(); this.downloadReport(); });
    }
  }

  async startRecording() {
    this.statusText.textContent = 'Requesting microphone...';
    this.recordButton.disabled = true;

    if (!this.recognition) {
      this.recordButton.disabled = false;
      alert('Voice recognition not supported. Use Chrome or Edge.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.recordButton.disabled = false;
      alert('Microphone access not available.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      this.recordButton.disabled = false;
      this.statusText.textContent = 'Ready';
      alert('Microphone permission denied. Please allow access.');
      return;
    }

    this.finalTranscript = '';
    this.transcription = '';
    this.updateTranscription();
    this.shouldAutoRestart = true;
    try {
      this.recognition.start();
    } catch (e) {
      this.recordButton.disabled = false;
      alert('Failed to start: ' + (e.message || 'Try again.'));
    }
  }

  stopRecording() {
    this.shouldAutoRestart = false;
    if (this.recognition && this.isRecording) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.isRecording = false;
    this.recordButton.disabled = false;
    this.stopButton.disabled = true;
    this.generateSummaryButton.disabled = !this.finalTranscript.trim();
  }

  formatReportSummary(text) {
    if (!text || typeof text !== 'string') return '';
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = text.split(/\*\*(Summary of Visit|Terms Explained|Recommendations)\*\*/i);
    let html = '';
    for (let i = 1; i < parts.length; i += 2) {
      const sectionName = parts[i];
      const body = (parts[i + 1] || '').trim();
      const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
      if (sectionName && sectionName.toLowerCase().includes('summary')) {
        html += '<div class="report-section"><h3 class="report-h3">Summary of Visit</h3><p class="report-summary-p">' + esc(body).replace(/\n/g, '<br>') + '</p></div>';
      } else if (sectionName && sectionName.toLowerCase().includes('terms')) {
        const items = lines.filter(l => /^[-•]/.test(l)).map(l => {
          const m = l.replace(/^[-•]\s*/, '').match(/^(.+?)\s*=\s*(.+)$/);
          if (m) return '<li class="report-term-item"><span class="report-term-name">' + esc(m[1].trim()) + '</span> <span class="report-term-def">' + esc(m[2].trim()) + '</span></li>';
          return '<li>' + esc(l.replace(/^[-•]\s*/, '')) + '</li>';
        });
        html += '<div class="report-section"><h3 class="report-h3">Terms Explained</h3><ul class="report-terms-list">' + items.join('') + '</ul></div>';
      } else if (sectionName && sectionName.toLowerCase().includes('recommendation')) {
        const items = lines.filter(l => /^[-•]/.test(l)).map(l => '<li>' + esc(l.replace(/^[-•]\s*/, '')) + '</li>');
        html += '<div class="report-section"><h3 class="report-h3">Recommendations</h3><ul class="report-bullet-list">' + items.join('') + '</ul></div>';
      }
    }
    if (!html) return esc(text).replace(/\n/g, '<br>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return html;
  }

  updateTranscription() {
    if (!this.transcriptionBox) return;
    if (this.transcription.trim()) {
      const esc = this.transcription.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      this.transcriptionBox.innerHTML = '<p>' + esc + '</p>';
    } else {
      this.transcriptionBox.innerHTML = '<span class="placeholder">Live transcription will appear here...</span>';
    }
  }

  async generateSummary() {
    if (!this.finalTranscript.trim()) {
      alert('No transcription to summarize.');
      return;
    }

    this.generateSummaryButton.disabled = true;
        this.summaryBox.innerHTML = '<span class="placeholder loading">Generating summary...</span>';

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: this.finalTranscript })
      });
      const data = await res.json();

      if (res.ok && data.summary) {
        this.lastSummary = data.summary;
        this.lastMedications = data.medications || [];
        const formatted = data.summary.replace(/\n/g, '<br>');
        this.summaryBox.innerHTML = '<div class="report-summary-text" style="border:none;padding:0;margin:0;">' + formatted + '</div>';
        if (this.downloadReportButton) this.downloadReportButton.disabled = false;
        this.addReportCard(data.summary);
        this.updateReportCount();
        this.updatePharmacySection(this.lastMedications, data.medication_price_links || []);
      } else {
        this.summaryBox.innerHTML = '<span style="color:var(--accent);">Error: ' + (data.error || 'Failed to generate summary') + '</span>';
      }
    } catch (err) {
      this.summaryBox.innerHTML = '<span class="error-msg">' + err.message + '</span>';
    } finally {
      this.generateSummaryButton.disabled = false;
    }
  }

  addReportCard(summaryText) {
    if (!this.reportsContainer) return;
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const card = document.createElement('div');
    card.className = 'report-card';
    card.setAttribute('onclick', 'this.classList.toggle(\'open\')');
    card.innerHTML = `
      <div class="report-card-header">
        <div class="report-date-pill">${dateStr}</div>
        <div class="report-card-info">
          <div class="report-card-title">Recorded Visit</div>
          <div class="report-card-doctor">Voice recording · Patient-friendly summary</div>
        </div>
        <span class="report-type-badge badge-voice">Voice</span>
        <svg class="expand-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="report-card-body">
        <div class="report-body-inner">
          <div class="report-summary-formatted">${this.formatReportSummary(summaryText) || summaryText.replace(/\n/g, '<br>')}</div>
          <div class="report-actions">
            <button class="rpt-btn primary" onclick="event.stopPropagation();window.medScribe?.downloadReport();">Download Report</button>
          </div>
        </div>
      </div>
    `;
    this.reportsContainer.insertBefore(card, this.reportsContainer.firstChild);
    this.syncReportsToTab();
  }

  updatePharmacySection(medications, priceLinks) {
    if (!this.pharmacySection || !this.medicationsList) return;
    this.pharmacySection.style.display = 'block';
    this.pharmacySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (this.pharmacyResults) this.pharmacyResults.innerHTML = '';
    if (this.pharmacyStatus) this.pharmacyStatus.textContent = '';
    const meds = medications || [];
    const links = priceLinks && priceLinks.length ? priceLinks : meds.map(m => ({ name: m, goodrx_url: `https://www.goodrx.com/search?q=${encodeURIComponent((m.split(' ')[0] || m))}` }));
    if (meds.length === 0) {
      this.medicationsList.innerHTML = '<p class="pharmacy-no-meds">No medications detected. You can still find nearby pharmacies below.</p>';
    } else {
      this.medicationsList.innerHTML = links.map(l =>
        `<span class="med-badge"><span>${(l.name || '').replace(/</g,'&lt;')}</span> · <a href="${l.goodrx_url}" target="_blank" rel="noopener">Check prices</a></span>`
      ).join('');
    }
  }

  async findNearbyPharmacies() {
    if (!this.findPharmaciesBtn || !this.pharmacyResults || !this.pharmacyStatus) return;
    this.findPharmaciesBtn.disabled = true;
    this.pharmacyStatus.textContent = 'Getting your location...';

    let lat, lon;
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch (err) {
      this.pharmacyStatus.textContent = 'Location denied or unavailable. Allow location access to find nearby pharmacies.';
      this.findPharmaciesBtn.disabled = false;
      return;
    }

    this.pharmacyStatus.textContent = 'Finding pharmacies...';
    const meds = this.lastMedications || [];
    const params = new URLSearchParams({ lat, lon, radius: 20000 });
    if (meds.length) params.set('medications', meds.join(','));

    try {
      const res = await fetch(`/api/pharmacy-finder?${params}`);
      const data = await res.json();
      if (!res.ok) {
        this.pharmacyStatus.textContent = data.error || 'Could not fetch pharmacies.';
        this.pharmacyResults.innerHTML = '';
        this.findPharmaciesBtn.disabled = false;
        return;
      }

      this.pharmacyStatus.textContent = `Found ${data.pharmacies?.length || 0} pharmacies within ${data.radius_km} km`;
      if (!data.pharmacies || data.pharmacies.length === 0) {
        this.pharmacyResults.innerHTML = '<p style="color:var(--text-muted);">No pharmacies found nearby. Try a larger radius or different location.</p>';
      } else {
        const medLinks = data.medication_price_links || [];
        const medPriceLine = medLinks.length ? medLinks.map(l => {
          const price = l.reference_price ? ` ${l.reference_price}` : '';
          return `${l.name}${price} · <a href="${l.goodrx_url}" target="_blank" rel="noopener">Check prices</a>`;
        }).join(' &nbsp;|&nbsp; ') : '';
        this.pharmacyResults.innerHTML = data.pharmacies.map(p => {
          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat + ',' + p.lon)}`;
          const medBlock = medPriceLine ? `<div class="pharmacy-card-meds"><strong>Check prices:</strong> ${medPriceLine}<div class="pharmacy-note">Call pharmacy to confirm medication is in stock.</div></div>` : '';
          return `<div class="pharmacy-card">
            <div class="pharmacy-card-name">${(p.name || '').replace(/</g,'&lt;')}</div>
            <div class="pharmacy-card-addr">${(p.address || 'Address not available').replace(/</g,'&lt;')}</div>
            <div class="pharmacy-card-dist">${p.distance_km} km away</div>
            ${medBlock}
            <div class="pharmacy-card-map"><a href="${mapUrl}" target="_blank" rel="noopener">Open in Google Maps</a></div>
          </div>`;
        }).join('');
      }
    } catch (err) {
      this.pharmacyStatus.textContent = 'Error: ' + (err.message || 'Could not load pharmacies. Check connection.');
      this.pharmacyResults.innerHTML = '<p class="pharmacy-no-meds">' + (err.message || 'Network error. Make sure the server is running and try again.').replace(/</g, '&lt;') + '</p>';
    }
    this.findPharmaciesBtn.disabled = false;
  }

  updateReportCount() {
    if (this.reportCountEl) {
      const cards = this.reportsContainer?.querySelectorAll('.report-card') || [];
      this.reportCountEl.textContent = cards.length;
    }
  }

  downloadReport() {
    if (!this.lastSummary) {
      alert('No summary to download. Generate one first.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const content = `PATIENT-FRIENDLY CHECKUP SUMMARY\nGenerated: ${new Date().toLocaleString()}\n\n${'='.repeat(50)}\n\n${this.lastSummary}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MedScribe-Summary-${date}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    window.medScribe = new MedScribeRecorder();
    window.medScribe.updateReportCount();
  } catch (e) {
    console.error('MedScribe init error:', e);
  }
});
